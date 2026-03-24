package xrpc

import (
	"context"
	"encoding/json"
	"fmt"
	"net/url"
	"strings"
)

// ResolveHandle resolves an AT Protocol handle to a DID via
// com.atproto.identity.resolveHandle.
func (c *Client) ResolveHandle(ctx context.Context, handle string) (string, error) {
	params := url.Values{"handle": {handle}}
	body, err := c.Call(ctx, strings.TrimSuffix(c.identityService, "/"), "com.atproto.identity.resolveHandle", params)
	if err != nil {
		return "", fmt.Errorf("resolve handle %q: %w", handle, err)
	}
	defer body.Close()

	var payload struct {
		DID string `json:"did"`
	}
	if err := json.NewDecoder(body).Decode(&payload); err != nil {
		return "", fmt.Errorf("decode resolve handle response: %w", err)
	}
	if !strings.HasPrefix(payload.DID, "did:") {
		return "", fmt.Errorf("resolve handle returned invalid did %q", payload.DID)
	}
	return payload.DID, nil
}
