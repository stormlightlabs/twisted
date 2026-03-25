package xrpc

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
)

// DIDDocument is a minimal representation of a DID document.
type DIDDocument struct {
	ID          string       `json:"id"`
	AlsoKnownAs []string    `json:"alsoKnownAs"`
	Service     []DIDService `json:"service"`
}

// DIDService is a single service entry in a DID document.
type DIDService struct {
	ID              string `json:"id"`
	Type            string `json:"type"`
	ServiceEndpoint string `json:"serviceEndpoint"`
}

// IdentityInfo is the resolved PDS endpoint and handle for a DID.
type IdentityInfo struct {
	DID    string
	PDS    string
	Handle string
}

// ResolveDIDDoc fetches and caches a DID document.
// Supports did:plc: (via PLC directory) and did:web: (via .well-known).
func (c *Client) ResolveDIDDoc(ctx context.Context, did string) (*DIDDocument, error) {
	if doc, ok := c.didCache.Get(did); ok {
		return &doc, nil
	}

	var docURL string
	switch {
	case strings.HasPrefix(did, "did:plc:"):
		docURL = c.plcDirectory + "/" + url.PathEscape(did)
	case strings.HasPrefix(did, "did:web:"):
		hostAndPath := strings.TrimPrefix(did, "did:web:")
		hostAndPath = strings.ReplaceAll(hostAndPath, ":", "/")
		docURL = "https://" + hostAndPath + "/.well-known/did.json"
	default:
		return nil, fmt.Errorf("unsupported did method: %s", did)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, docURL, nil)
	if err != nil {
		return nil, fmt.Errorf("build did doc request: %w", err)
	}
	if c.userAgent != "" {
		req.Header.Set("User-Agent", c.userAgent)
	}

	resp, err := c.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("did doc request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("did doc lookup failed: status %d", resp.StatusCode)
	}

	var doc DIDDocument
	if err := json.NewDecoder(resp.Body).Decode(&doc); err != nil {
		return nil, fmt.Errorf("decode did doc: %w", err)
	}

	c.didCache.Set(did, doc)
	return &doc, nil
}

// ResolveIdentity resolves a DID to its PDS endpoint and handle.
// Both fields are best-effort: callers that require PDS should check info.PDS != "".
func (c *Client) ResolveIdentity(ctx context.Context, did string) (*IdentityInfo, error) {
	doc, err := c.ResolveDIDDoc(ctx, did)
	if err != nil {
		return nil, err
	}

	info := &IdentityInfo{DID: did}

	for _, svc := range doc.Service {
		if svc.Type == "AtprotoPersonalDataServer" && strings.TrimSpace(svc.ServiceEndpoint) != "" {
			info.PDS = strings.TrimSpace(svc.ServiceEndpoint)
			break
		}
	}

	for _, aka := range doc.AlsoKnownAs {
		if strings.HasPrefix(aka, "at://") {
			info.Handle = strings.TrimPrefix(aka, "at://")
			break
		}
	}

	return info, nil
}
