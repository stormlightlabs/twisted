// Package xrpc provides a typed client for AT Protocol XRPC endpoints.
package xrpc

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"time"
)

// XRPCError is a non-success response from an XRPC endpoint.
type XRPCError struct {
	StatusCode int
	Message    string
}

func (e *XRPCError) Error() string {
	if e.Message != "" {
		return fmt.Sprintf("xrpc: status %d: %s", e.StatusCode, e.Message)
	}
	return fmt.Sprintf("xrpc: status %d", e.StatusCode)
}

// NotFoundError indicates a 404 response.
type NotFoundError struct {
	Message string
}

func (e *NotFoundError) Error() string {
	if e.Message != "" {
		return fmt.Sprintf("xrpc: not found: %s", e.Message)
	}
	return "xrpc: not found"
}

// RateLimitError indicates a 429 response with optional Retry-After.
type RateLimitError struct {
	RetryAfter time.Duration
}

func (e *RateLimitError) Error() string {
	if e.RetryAfter > 0 {
		return fmt.Sprintf("xrpc: rate limited, retry after %s", e.RetryAfter)
	}
	return "xrpc: rate limited"
}

// Option configures a Client.
type Option func(*Client)

// WithTimeout sets the HTTP client timeout.
func WithTimeout(d time.Duration) Option {
	return func(c *Client) { c.http.Timeout = d }
}

// WithUserAgent sets the User-Agent header.
func WithUserAgent(ua string) Option {
	return func(c *Client) { c.userAgent = ua }
}

// WithHTTPClient replaces the underlying http.Client.
func WithHTTPClient(hc *http.Client) Option {
	return func(c *Client) { c.http = hc }
}

// WithPLCDirectory sets the PLC directory base URL for DID resolution.
func WithPLCDirectory(url string) Option {
	return func(c *Client) { c.plcDirectory = url }
}

// WithIdentityService sets the identity service URL for handle resolution.
func WithIdentityService(url string) Option {
	return func(c *Client) { c.identityService = url }
}

// Client is a reusable XRPC HTTP client.
type Client struct {
	http            *http.Client
	userAgent       string
	plcDirectory    string
	identityService string
	didCache        *ttlCache[DIDDocument]
	repoNameCache   *ttlCache[string]
}

// NewClient creates a Client with the given options.
func NewClient(opts ...Option) *Client {
	c := &Client{
		http:            &http.Client{Timeout: 15 * time.Second},
		userAgent:       "twister/1.0",
		plcDirectory:    "https://plc.directory",
		identityService: "https://public.api.bsky.app",
		didCache:        newTTLCache[DIDDocument](1 * time.Hour),
		repoNameCache:   newTTLCache[string](1 * time.Hour),
	}
	for _, o := range opts {
		o(c)
	}
	return c
}

// Call performs a low-level XRPC GET request and returns the response body.
// The caller is responsible for closing the returned ReadCloser.
func (c *Client) Call(ctx context.Context, pdsURL, method string, params url.Values) (io.ReadCloser, error) {
	u := pdsURL + "/xrpc/" + method
	if len(params) > 0 {
		u += "?" + params.Encode()
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u, nil)
	if err != nil {
		return nil, fmt.Errorf("build xrpc request: %w", err)
	}
	if c.userAgent != "" {
		req.Header.Set("User-Agent", c.userAgent)
	}

	resp, err := c.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("xrpc request: %w", err)
	}

	if resp.StatusCode == http.StatusNotFound {
		resp.Body.Close()
		return nil, &NotFoundError{}
	}
	if resp.StatusCode == http.StatusTooManyRequests {
		resp.Body.Close()
		retryAfter := parseRetryAfter(resp.Header.Get("Retry-After"))
		return nil, &RateLimitError{RetryAfter: retryAfter}
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		body, _ := io.ReadAll(resp.Body)
		resp.Body.Close()
		msg := ""
		var errResp struct {
			Message string `json:"message"`
		}
		if json.Unmarshal(body, &errResp) == nil {
			msg = errResp.Message
		}
		return nil, &XRPCError{StatusCode: resp.StatusCode, Message: msg}
	}

	return resp.Body, nil
}

func parseRetryAfter(val string) time.Duration {
	if val == "" {
		return 0
	}
	if secs, err := strconv.Atoi(val); err == nil {
		return time.Duration(secs) * time.Second
	}
	if t, err := http.ParseTime(val); err == nil {
		d := time.Until(t)
		if d > 0 {
			return d
		}
	}
	return 0
}
