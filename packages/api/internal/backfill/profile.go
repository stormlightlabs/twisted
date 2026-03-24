package backfill

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"
)

const profileCollection = "sh.tangled.actor.profile"

// ProfileRecord holds the fetched profile data and resolved handle.
type ProfileRecord struct {
	Record map[string]any
	CID    string
	Handle string
}

type profileFetcher interface {
	FetchProfile(ctx context.Context, did string) (*ProfileRecord, error)
}

// HTTPProfileFetcher fetches sh.tangled.actor.profile records via XRPC
// and resolves handles from the DID document.
type HTTPProfileFetcher struct {
	client *http.Client
}

func NewHTTPProfileFetcher() *HTTPProfileFetcher {
	return &HTTPProfileFetcher{
		client: &http.Client{Timeout: 15 * time.Second},
	}
}

func (f *HTTPProfileFetcher) FetchProfile(ctx context.Context, did string) (*ProfileRecord, error) {
	pds, handle, err := f.resolveDIDDoc(ctx, did)
	if err != nil {
		return nil, fmt.Errorf("resolve did doc: %w", err)
	}

	u, err := url.Parse(strings.TrimSuffix(pds, "/") + "/xrpc/com.atproto.repo.getRecord")
	if err != nil {
		return nil, fmt.Errorf("build getRecord url: %w", err)
	}
	q := u.Query()
	q.Set("repo", did)
	q.Set("collection", profileCollection)
	q.Set("rkey", "self")
	u.RawQuery = q.Encode()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u.String(), nil)
	if err != nil {
		return nil, fmt.Errorf("build getRecord request: %w", err)
	}

	resp, err := f.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("getRecord request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		// No profile record — return handle only so identity can still be stored.
		return &ProfileRecord{Handle: handle}, nil
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("getRecord failed: status %d", resp.StatusCode)
	}

	var payload struct {
		CID   string         `json:"cid"`
		Value map[string]any `json:"value"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		return nil, fmt.Errorf("decode getRecord response: %w", err)
	}

	return &ProfileRecord{
		Record: payload.Value,
		CID:    payload.CID,
		Handle: handle,
	}, nil
}

// resolveDIDDoc fetches the DID document and returns (pdsEndpoint, handle, error).
func (f *HTTPProfileFetcher) resolveDIDDoc(ctx context.Context, did string) (string, string, error) {
	var didDocURL string
	switch {
	case strings.HasPrefix(did, "did:plc:"):
		didDocURL = plcDirectoryBase + "/" + url.PathEscape(did)
	case strings.HasPrefix(did, "did:web:"):
		hostAndPath := strings.TrimPrefix(did, "did:web:")
		hostAndPath = strings.ReplaceAll(hostAndPath, ":", "/")
		didDocURL = "https://" + hostAndPath + "/.well-known/did.json"
	default:
		return "", "", fmt.Errorf("unsupported did type: %s", did)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, didDocURL, nil)
	if err != nil {
		return "", "", fmt.Errorf("build did doc request: %w", err)
	}
	resp, err := f.client.Do(req)
	if err != nil {
		return "", "", fmt.Errorf("did doc request: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return "", "", fmt.Errorf("did doc lookup failed: status %d", resp.StatusCode)
	}

	var didDoc struct {
		AlsoKnownAs []string `json:"alsoKnownAs"`
		Service     []struct {
			Type            string `json:"type"`
			ServiceEndpoint string `json:"serviceEndpoint"`
		} `json:"service"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&didDoc); err != nil {
		return "", "", fmt.Errorf("decode did doc: %w", err)
	}

	var pds string
	for _, svc := range didDoc.Service {
		if svc.Type == "AtprotoPersonalDataServer" && strings.TrimSpace(svc.ServiceEndpoint) != "" {
			pds = strings.TrimSpace(svc.ServiceEndpoint)
			break
		}
	}
	if pds == "" {
		return "", "", fmt.Errorf("no atproto pds endpoint in did document")
	}

	var handle string
	for _, aka := range didDoc.AlsoKnownAs {
		if strings.HasPrefix(aka, "at://") {
			handle = strings.TrimPrefix(aka, "at://")
			break
		}
	}

	return pds, handle, nil
}
