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

const (
	plcDirectoryBase = "https://plc.directory"
	followCollection = "sh.tangled.graph.follow"
)

type followFetcher interface {
	ListFollowSubjects(ctx context.Context, did string) ([]string, error)
}

// HTTPFollowFetcher resolves a DID's PDS endpoint and reads follow records
// directly from com.atproto.repo.listRecords.
type HTTPFollowFetcher struct {
	client *http.Client
}

func NewHTTPFollowFetcher() *HTTPFollowFetcher {
	return &HTTPFollowFetcher{
		client: &http.Client{Timeout: 15 * time.Second},
	}
}

func (f *HTTPFollowFetcher) ListFollowSubjects(ctx context.Context, did string) ([]string, error) {
	pdsEndpoint, err := f.resolvePDSEndpoint(ctx, did)
	if err != nil {
		return nil, err
	}

	seen := map[string]bool{}
	var subjects []string
	cursor := ""

	for {
		u, err := url.Parse(strings.TrimSuffix(pdsEndpoint, "/") + "/xrpc/com.atproto.repo.listRecords")
		if err != nil {
			return nil, fmt.Errorf("build listRecords url: %w", err)
		}
		q := u.Query()
		q.Set("repo", did)
		q.Set("collection", followCollection)
		q.Set("limit", "100")
		if cursor != "" {
			q.Set("cursor", cursor)
		}
		u.RawQuery = q.Encode()

		req, err := http.NewRequestWithContext(ctx, http.MethodGet, u.String(), nil)
		if err != nil {
			return nil, fmt.Errorf("build listRecords request: %w", err)
		}

		resp, err := f.client.Do(req)
		if err != nil {
			return nil, fmt.Errorf("listRecords request: %w", err)
		}

		var payload struct {
			Cursor  string `json:"cursor"`
			Records []struct {
				Value map[string]any `json:"value"`
			} `json:"records"`
		}
		if resp.StatusCode != http.StatusOK {
			_ = resp.Body.Close()
			return nil, fmt.Errorf("listRecords failed: status %d", resp.StatusCode)
		}
		if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
			_ = resp.Body.Close()
			return nil, fmt.Errorf("decode listRecords response: %w", err)
		}
		_ = resp.Body.Close()

		for _, rec := range payload.Records {
			subject, _ := rec.Value["subject"].(string)
			if !isDID(subject) || seen[subject] {
				continue
			}
			seen[subject] = true
			subjects = append(subjects, subject)
		}

		if payload.Cursor == "" || payload.Cursor == cursor {
			break
		}
		cursor = payload.Cursor
	}

	return subjects, nil
}

func (f *HTTPFollowFetcher) resolvePDSEndpoint(ctx context.Context, did string) (string, error) {
	var didDocURL string
	switch {
	case strings.HasPrefix(did, "did:plc:"):
		didDocURL = plcDirectoryBase + "/" + url.PathEscape(did)
	case strings.HasPrefix(did, "did:web:"):
		hostAndPath := strings.TrimPrefix(did, "did:web:")
		hostAndPath = strings.ReplaceAll(hostAndPath, ":", "/")
		didDocURL = "https://" + hostAndPath + "/.well-known/did.json"
	default:
		return "", fmt.Errorf("unsupported did type for pds resolution: %s", did)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, didDocURL, nil)
	if err != nil {
		return "", fmt.Errorf("build did doc request: %w", err)
	}
	resp, err := f.client.Do(req)
	if err != nil {
		return "", fmt.Errorf("did doc request: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("did doc lookup failed: status %d", resp.StatusCode)
	}

	var didDoc struct {
		Service []struct {
			Type            string `json:"type"`
			ServiceEndpoint string `json:"serviceEndpoint"`
		} `json:"service"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&didDoc); err != nil {
		return "", fmt.Errorf("decode did doc: %w", err)
	}

	for _, service := range didDoc.Service {
		if service.Type == "AtprotoPersonalDataServer" && strings.TrimSpace(service.ServiceEndpoint) != "" {
			return strings.TrimSpace(service.ServiceEndpoint), nil
		}
	}

	return "", fmt.Errorf("no atproto pds endpoint in did document")
}
