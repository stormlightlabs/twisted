package backfill

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"
)

type tapAdmin interface {
	IsTracked(ctx context.Context, did string) (bool, error)
	AddRepos(ctx context.Context, dids []string) error
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

func (t *HTTPTapAdmin) IsTracked(ctx context.Context, did string) (bool, error) {
	endpoint := fmt.Sprintf("%s/info/%s", t.baseURL, url.PathEscape(did))
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return false, fmt.Errorf("build tap info request: %w", err)
	}
	t.addAuth(req)

	resp, err := t.client.Do(req)
	if err != nil {
		return false, fmt.Errorf("tap info request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		return false, nil
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return false, fmt.Errorf("tap info request failed: status %d", resp.StatusCode)
	}
	return true, nil
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
