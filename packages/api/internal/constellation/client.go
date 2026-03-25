// Package constellation provides a client for the Constellation backlink API.
// Constellation is a public AT Protocol backlink index at https://constellation.microcosm.blue.
// It answers "who linked to this?" across the network, providing social signal counts
// (stars, followers, reactions) without requiring us to maintain our own counters.
package constellation

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

const (
	DefaultBaseURL  string        = "https://constellation.microcosm.blue"
	defaultTimeout  time.Duration = 10 * time.Second
	defaultCacheTTL time.Duration = 5 * time.Minute
)

// Source constants for common Tangled collections.
// Format: "collection:path" where path uses Constellation dot-notation (e.g. ".subject").
const (
	SourceStarURI     string = "sh.tangled.feed.star:.subject"
	SourceFollowDID   string = "sh.tangled.graph.follow:.subject"
	SourceReactionURI string = "sh.tangled.feed.reaction:.subject"
)

// Client is an HTTP client for the Constellation backlink API.
type Client struct {
	http       *http.Client
	baseURL    string
	userAgent  string
	countCache *ttlCache[int]
}

// Option configures a Client.
type Option func(*Client)

// WithBaseURL overrides the Constellation base URL.
func WithBaseURL(u string) Option {
	return func(c *Client) { c.baseURL = u }
}

// WithUserAgent sets the User-Agent header sent with every request.
// Constellation requires a user-agent identifying the project and a contact.
func WithUserAgent(ua string) Option {
	return func(c *Client) { c.userAgent = ua }
}

// WithTimeout sets the HTTP request timeout.
func WithTimeout(d time.Duration) Option {
	return func(c *Client) { c.http.Timeout = d }
}

// WithCacheTTL sets the TTL for cached count responses.
func WithCacheTTL(d time.Duration) Option {
	return func(c *Client) { c.countCache = newTTLCache[int](d) }
}

// NewClient creates a Constellation client with sensible defaults.
func NewClient(opts ...Option) *Client {
	c := &Client{
		http:       &http.Client{Timeout: defaultTimeout},
		baseURL:    DefaultBaseURL,
		userAgent:  "twister/1.0",
		countCache: newTTLCache[int](defaultCacheTTL),
	}
	for _, o := range opts {
		o(c)
	}
	return c
}

// BacklinksParams holds query parameters for backlink endpoints.
type BacklinksParams struct {
	// Subject is the target AT-URI or DID being linked to (required).
	Subject string
	// Source is the collection path, e.g. "sh.tangled.feed.star:subject.uri" (required).
	Source string
	// DID optionally filters results to a specific actor (repeatable in the raw API; here single-value).
	DID string
	// Limit is the max results to return (default 16, max 100).
	Limit int
	// Reverse reverses the ordering.
	Reverse bool
}

// BacklinkRecord is one entry returned by GetBacklinks.
type BacklinkRecord struct {
	DID        string `json:"did"`
	Collection string `json:"collection"`
	RKey       string `json:"rkey"`
}

// BacklinksResponse is returned by GetBacklinks.
type BacklinksResponse struct {
	Total          int            `json:"total"`
	LinkingRecords []BacklinkRecord `json:"linking_records"`
	Cursor         *string        `json:"cursor,omitempty"`
}

// GetBacklinksCount returns the count of records linking to the given subject.
// Results are cached with the configured TTL. Errors are returned without caching.
// p.Source must be in "collection:path" format, e.g. "sh.tangled.feed.star:.subject".
func (c *Client) GetBacklinksCount(ctx context.Context, p BacklinksParams) (int, error) {
	cacheKey := "count\x00" + p.Subject + "\x00" + p.Source
	if n, ok := c.countCache.Get(cacheKey); ok {
		return n, nil
	}

	collection, path, ok := strings.Cut(p.Source, ":")
	if !ok {
		return 0, fmt.Errorf("constellation: invalid source %q: expected collection:path", p.Source)
	}

	params := url.Values{}
	params.Set("target", p.Subject)
	params.Set("collection", collection)
	params.Set("path", path)

	var resp struct {
		Total int `json:"total"`
	}
	if err := c.getLinks(ctx, params, &resp); err != nil {
		return 0, err
	}

	c.countCache.Set(cacheKey, resp.Total)
	return resp.Total, nil
}

// GetBacklinks returns records linking to the given subject.
// Results are not cached because paginated lists change frequently.
// p.Source must be in "collection:path" format, e.g. "sh.tangled.feed.star:.subject".
func (c *Client) GetBacklinks(ctx context.Context, p BacklinksParams) (*BacklinksResponse, error) {
	collection, path, ok := strings.Cut(p.Source, ":")
	if !ok {
		return nil, fmt.Errorf("constellation: invalid source %q: expected collection:path", p.Source)
	}

	params := url.Values{}
	params.Set("target", p.Subject)
	params.Set("collection", collection)
	params.Set("path", path)
	if p.DID != "" {
		params.Set("did", p.DID)
	}
	if p.Limit > 0 {
		params.Set("limit", fmt.Sprintf("%d", p.Limit))
	}
	if p.Reverse {
		params.Set("reverse", "true")
	}

	var resp BacklinksResponse
	if err := c.getLinks(ctx, params, &resp); err != nil {
		return nil, err
	}
	return &resp, nil
}

func (c *Client) getLinks(ctx context.Context, params url.Values, out any) error {
	u := c.baseURL + "/links"
	if len(params) > 0 {
		u += "?" + params.Encode()
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u, nil)
	if err != nil {
		return fmt.Errorf("constellation: build request: %w", err)
	}
	if c.userAgent != "" {
		req.Header.Set("User-Agent", c.userAgent)
	}

	resp, err := c.http.Do(req)
	if err != nil {
		return fmt.Errorf("constellation: request /links: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		body, _ := io.ReadAll(resp.Body)
		var errResp struct {
			Message string `json:"message"`
		}
		if json.Unmarshal(body, &errResp) == nil && errResp.Message != "" {
			return fmt.Errorf("constellation: /links: status %d: %s", resp.StatusCode, errResp.Message)
		}
		return fmt.Errorf("constellation: /links: status %d", resp.StatusCode)
	}

	if err := json.NewDecoder(resp.Body).Decode(out); err != nil {
		return fmt.Errorf("constellation: /links: decode response: %w", err)
	}
	return nil
}
