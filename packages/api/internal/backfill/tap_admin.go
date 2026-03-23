package backfill

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

type tapAdmin interface {
	RepoStatus(ctx context.Context, did string) (RepoStatus, error)
	AddRepos(ctx context.Context, dids []string) error
}

type RepoStatus struct {
	Found       bool
	Tracked     bool
	Backfilled  bool
	Backfilling bool
	State       string
}

// HTTPTapAdmin calls Tap admin endpoints for backfill orchestration.
type HTTPTapAdmin struct {
	baseURL  string
	password string
	client   *http.Client
}

func NewHTTPTapAdmin(tapURL, password string) (*HTTPTapAdmin, error) {
	baseURL, err := normalizeTapBaseURL(tapURL)
	if err != nil {
		return nil, err
	}
	return &HTTPTapAdmin{
		baseURL:  baseURL,
		password: password,
		client: &http.Client{
			Timeout: 15 * time.Second,
		},
	}, nil
}

func (t *HTTPTapAdmin) RepoStatus(ctx context.Context, did string) (RepoStatus, error) {
	endpoint := fmt.Sprintf("%s/info/%s", t.baseURL, url.PathEscape(did))
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return RepoStatus{}, fmt.Errorf("build tap info request: %w", err)
	}
	t.addAuth(req)

	resp, err := t.client.Do(req)
	if err != nil {
		return RepoStatus{}, fmt.Errorf("tap info request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		return RepoStatus{Found: false}, nil
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return RepoStatus{}, fmt.Errorf("tap info request failed: status %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return RepoStatus{}, fmt.Errorf("read tap info response: %w", err)
	}
	if len(bytes.TrimSpace(body)) == 0 {
		return RepoStatus{Found: true, Tracked: true}, nil
	}

	var payload map[string]any
	if err := json.Unmarshal(body, &payload); err != nil {
		return RepoStatus{}, fmt.Errorf("decode tap info response: %w", err)
	}

	status := RepoStatus{Found: true, Tracked: true}
	if tracked, ok := boolFromAnyWithPresence(payload, "tracked", "isTracked", "enabled", "registered"); ok {
		status.Tracked = tracked
	}
	status.Backfilled = boolFromAny(payload, "backfilled", "isBackfilled", "complete", "done")
	status.Backfilling = boolFromAny(payload, "backfilling", "inProgress", "in_progress", "pendingBackfill")
	status.State = stringFromAny(payload, "status", "state")

	if stateImpliesBackfilled(status.State) {
		status.Backfilled = true
	}
	if stateImpliesBackfilling(status.State) {
		status.Backfilling = true
	}
	return status, nil
}

func (t *HTTPTapAdmin) AddRepos(ctx context.Context, dids []string) error {
	if len(dids) == 0 {
		return nil
	}

	payload, err := json.Marshal(map[string][]string{"dids": dids})
	if err != nil {
		return fmt.Errorf("marshal repos add payload: %w", err)
	}

	endpoint := t.baseURL + "/repos/add"
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(payload))
	if err != nil {
		return fmt.Errorf("build repos add request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	t.addAuth(req)

	resp, err := t.client.Do(req)
	if err != nil {
		return fmt.Errorf("repos add request: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("repos add failed: status %d", resp.StatusCode)
	}
	return nil
}

func (t *HTTPTapAdmin) addAuth(req *http.Request) {
	if t.password == "" {
		return
	}
	token := base64.StdEncoding.EncodeToString([]byte("admin:" + t.password))
	req.Header.Set("Authorization", "Basic "+token)
}

func normalizeTapBaseURL(raw string) (string, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return "", fmt.Errorf("tap url is required")
	}
	u, err := url.Parse(raw)
	if err != nil {
		return "", fmt.Errorf("parse tap url: %w", err)
	}
	switch u.Scheme {
	case "ws":
		u.Scheme = "http"
	case "wss":
		u.Scheme = "https"
	case "http", "https":
	default:
		return "", fmt.Errorf("unsupported tap url scheme %q", u.Scheme)
	}

	u.RawQuery = ""
	u.Fragment = ""
	u.Path = strings.TrimSuffix(u.Path, "/")
	u.Path = strings.TrimSuffix(u.Path, "/channel")
	if u.Path == "/" {
		u.Path = ""
	}
	return strings.TrimSuffix(u.String(), "/"), nil
}

func boolFromAny(payload map[string]any, keys ...string) bool {
	v, _ := boolFromAnyWithPresence(payload, keys...)
	return v
}

func boolFromAnyWithPresence(payload map[string]any, keys ...string) (bool, bool) {
	for _, key := range keys {
		raw, ok := payload[key]
		if !ok {
			continue
		}
		switch v := raw.(type) {
		case bool:
			return v, true
		case float64:
			return v != 0, true
		case string:
			switch strings.ToLower(strings.TrimSpace(v)) {
			case "true", "1", "yes", "y", "active", "complete", "done", "backfilled", "backfilling", "in_progress", "in-progress":
				return true, true
			case "false", "0", "no", "n", "inactive":
				return false, true
			}
		}
	}
	return false, false
}

func stringFromAny(payload map[string]any, keys ...string) string {
	for _, key := range keys {
		raw, ok := payload[key]
		if !ok {
			continue
		}
		if value, ok := raw.(string); ok {
			return strings.TrimSpace(strings.ToLower(value))
		}
	}
	return ""
}

func stateImpliesBackfilled(state string) bool {
	switch strings.TrimSpace(strings.ToLower(state)) {
	case "backfilled", "complete", "completed", "done", "ready", "synced":
		return true
	default:
		return false
	}
}

func stateImpliesBackfilling(state string) bool {
	switch strings.TrimSpace(strings.ToLower(state)) {
	case "backfilling", "in-progress", "in_progress", "pending", "queued", "running":
		return true
	default:
		return false
	}
}
