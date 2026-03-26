package backfill

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

const listReposByCollectionNSID = "com.atproto.sync.listReposByCollection"

type lightrailRepoLister interface {
	ListReposByCollection(
		ctx context.Context, baseURL string, collections []string, limit int,
	) ([]string, error)
}

type listReposByCollectionResponse struct {
	Cursor string                  `json:"cursor"`
	Repos  []listReposByCollection `json:"repos"`
}

type listReposByCollection struct {
	DID string `json:"did"`
}

type HTTPLightrailClient struct {
	client *http.Client
}

func NewHTTPLightrailClient() *HTTPLightrailClient {
	return &HTTPLightrailClient{
		client: &http.Client{Timeout: 15 * time.Second},
	}
}

func (c *HTTPLightrailClient) ListReposByCollection(
	ctx context.Context, baseURL string, collections []string, limit int,
) ([]string, error) {
	baseURL = strings.TrimRight(strings.TrimSpace(baseURL), "/")
	if baseURL == "" {
		return nil, fmt.Errorf("lightrail url is required")
	}
	if limit <= 0 {
		limit = DefaultPageLimit
	}

	seen := make(map[string]bool)
	dids := make([]string, 0)
	cursor := ""
	for {
		resp, err := c.listReposByCollectionPage(ctx, baseURL, collections, limit, cursor)
		if err != nil {
			return nil, err
		}
		for _, repo := range resp.Repos {
			did := strings.TrimSpace(repo.DID)
			if did == "" || seen[did] {
				continue
			}
			seen[did] = true
			dids = append(dids, did)
		}
		if resp.Cursor == "" {
			return dids, nil
		}
		if resp.Cursor == cursor {
			return nil, fmt.Errorf("listReposByCollection repeated cursor %q", cursor)
		}
		cursor = resp.Cursor
	}
}

func (c *HTTPLightrailClient) listReposByCollectionPage(
	ctx context.Context, baseURL string, collections []string, limit int, cursor string,
) (*listReposByCollectionResponse, error) {
	params := url.Values{}
	for _, collection := range collections {
		collection = strings.TrimSpace(collection)
		if collection != "" {
			params.Add("collection", collection)
		}
	}
	if limit > 0 {
		params.Set("limit", fmt.Sprintf("%d", limit))
	}
	if cursor != "" {
		params.Set("cursor", cursor)
	}

	endpoint := baseURL + "/xrpc/" + listReposByCollectionNSID
	if encoded := params.Encode(); encoded != "" {
		endpoint += "?" + encoded
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, fmt.Errorf("build listReposByCollection request: %w", err)
	}

	resp, err := c.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("listReposByCollection request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 512))
		return nil, fmt.Errorf(
			"listReposByCollection failed: status %d: %s",
			resp.StatusCode,
			strings.TrimSpace(string(body)),
		)
	}

	var payload listReposByCollectionResponse
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		return nil, fmt.Errorf("decode listReposByCollection response: %w", err)
	}
	return &payload, nil
}
