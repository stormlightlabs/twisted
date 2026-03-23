package backfill

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"time"
)

const defaultIdentityService = "https://public.api.bsky.app"

type handleResolver interface {
	Resolve(ctx context.Context, handle string) (string, error)
}

// HTTPHandleResolver resolves handles through com.atproto.identity.resolveHandle.
type HTTPHandleResolver struct {
	baseURL string
	client  *http.Client
}

func NewHTTPHandleResolver(baseURL string) *HTTPHandleResolver {
	if baseURL == "" {
		baseURL = defaultIdentityService
	}
	return &HTTPHandleResolver{
		baseURL: baseURL,
		client: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
}

func (r *HTTPHandleResolver) Resolve(ctx context.Context, handle string) (string, error) {
	u := r.baseURL + "/xrpc/com.atproto.identity.resolveHandle?handle=" + url.QueryEscape(handle)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u, nil)
	if err != nil {
		return "", fmt.Errorf("build resolve handle request: %w", err)
	}

	resp, err := r.client.Do(req)
	if err != nil {
		return "", fmt.Errorf("resolve handle request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("resolve handle failed: status %d", resp.StatusCode)
	}

	var payload struct {
		DID string `json:"did"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		return "", fmt.Errorf("decode resolve handle response: %w", err)
	}
	if !isDID(payload.DID) {
		return "", fmt.Errorf("resolve handle returned invalid did %q", payload.DID)
	}
	return payload.DID, nil
}
