package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"tangled.org/desertthunder.dev/twister/internal/store"
)

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func errorBody(code, message string) map[string]string {
	return map[string]string{"error": code, "message": message}
}

func intParam(r *http.Request, key string, def int) (int, error) {
	v := r.URL.Query().Get(key)
	if v == "" {
		return def, nil
	}
	n, err := strconv.Atoi(v)
	if err != nil {
		return 0, err
	}
	return n, nil
}

type documentJSON struct {
	ID           string `json:"id"`
	DID          string `json:"did"`
	Collection   string `json:"collection"`
	RKey         string `json:"rkey"`
	ATURI        string `json:"at_uri"`
	CID          string `json:"cid"`
	RecordType   string `json:"record_type"`
	Title        string `json:"title"`
	Body         string `json:"body"`
	Summary      string `json:"summary,omitempty"`
	RepoName     string `json:"repo_name,omitempty"`
	AuthorHandle string `json:"author_handle,omitempty"`
	TagsJSON     string `json:"tags_json,omitempty"`
	Language     string `json:"language,omitempty"`
	WebURL       string `json:"web_url,omitempty"`
	CreatedAt    string `json:"created_at,omitempty"`
	UpdatedAt    string `json:"updated_at,omitempty"`
	IndexedAt    string `json:"indexed_at"`
}

func documentResponse(doc *store.Document) documentJSON {
	return documentJSON{
		ID:           doc.ID,
		DID:          doc.DID,
		Collection:   doc.Collection,
		RKey:         doc.RKey,
		ATURI:        doc.ATURI,
		CID:          doc.CID,
		RecordType:   doc.RecordType,
		Title:        doc.Title,
		Body:         doc.Body,
		Summary:      doc.Summary,
		RepoName:     doc.RepoName,
		AuthorHandle: doc.AuthorHandle,
		TagsJSON:     doc.TagsJSON,
		Language:     doc.Language,
		WebURL:       doc.WebURL,
		CreatedAt:    doc.CreatedAt,
		UpdatedAt:    doc.UpdatedAt,
		IndexedAt:    doc.IndexedAt,
	}
}

// isError is a type-safe errors.As replacement for pointer receiver targets.
func isError[T error](err error, target *T) bool {
	if err == nil {
		return false
	}

	type unwrapper interface{ Unwrap() error }
	for e := err; e != nil; {
		if t, ok := e.(T); ok {
			*target = t
			return true
		}
		if u, ok := e.(unwrapper); ok {
			e = u.Unwrap()
		} else {
			break
		}
	}
	return false
}

func resolveIssueState(stateMap map[string]string, issueURI string) string {
	raw := stateMap[issueURI]
	if strings.HasSuffix(raw, ".closed") {
		return "closed"
	}
	return "open"
}

func resolvePullStatus(statusMap map[string]string, pullURI string) string {
	raw := statusMap[pullURI]
	switch {
	case strings.HasSuffix(raw, ".merged"):
		return "merged"
	case strings.HasSuffix(raw, ".closed"):
		return "closed"
	default:
		return "open"
	}
}

// parseATURI splits an AT URI (at://did/collection/rkey) into its components.
func parseATURI(uri string) (did, collection, rkey string, err error) {
	trimmed := strings.TrimPrefix(uri, "at://")
	parts := strings.SplitN(trimmed, "/", 3)
	if len(parts) != 3 {
		return "", "", "", fmt.Errorf("invalid AT URI: %q", uri)
	}
	return parts[0], parts[1], parts[2], nil
}

func retryDelay(attempt int) time.Duration {
	if attempt < 1 {
		attempt = 1
	}
	base := time.Second * time.Duration(1<<min(attempt-1, 8))
	if base > 5*time.Minute {
		return 5 * time.Minute
	}
	return base
}

func truncateErr(err error) string {
	if err == nil {
		return ""
	}
	msg := err.Error()
	if len(msg) > 500 {
		return msg[:500]
	}
	return msg
}
