package normalize

import (
	"encoding/json"
	"fmt"
	"strings"

	"tangled.org/desertthunder.dev/twister/internal/store"
)

// TapRecord is the inner record object from a Tap event.
type TapRecord struct {
	Live       bool           `json:"live"`
	Rev        string         `json:"rev"`
	DID        string         `json:"did"`
	Collection string         `json:"collection"`
	RKey       string         `json:"rkey"`
	Action     string         `json:"action"`
	CID        string         `json:"cid"`
	Record     map[string]any `json:"record"`
}

// TapIdentity is the identity payload from a Tap identity event.
type TapIdentity struct {
	DID      string `json:"did"`
	Handle   string `json:"handle"`
	IsActive bool   `json:"isActive"`
	Status   string `json:"status"`
}

// TapRecordEvent is the top-level event received from the Tap WebSocket.
type TapRecordEvent struct {
	ID       int64        `json:"id"`
	Type     string       `json:"type"`
	Record   *TapRecord   `json:"record,omitempty"`
	Identity *TapIdentity `json:"identity,omitempty"`
}

// RecordAdapter normalizes a Tap record event into a search Document.
type RecordAdapter interface {
	Collection() string
	RecordType() string
	Normalize(event TapRecordEvent) (*store.Document, error)
	Searchable(record map[string]any) bool
}

// StateUpdate represents a record_state change derived from a state/status record.
type StateUpdate struct {
	SubjectURI string
	State      string
}

// StateHandler processes state/status records that update record_state,
// not the documents table.
type StateHandler interface {
	Collection() string
	HandleState(event TapRecordEvent) (*StateUpdate, error)
}

// StableID returns the canonical document ID: did|collection|rkey.
func StableID(did, collection, rkey string) string {
	return fmt.Sprintf("%s|%s|%s", did, collection, rkey)
}

// BuildATURI constructs the AT-URI for a record.
func BuildATURI(did, collection, rkey string) string {
	return fmt.Sprintf("at://%s/%s/%s", did, collection, rkey)
}

// ParseATURI extracts the DID, collection, and rkey from an AT-URI of the
// form at://did:plc:abc123/sh.tangled.repo/3kb3fge5lm32x.
func ParseATURI(uri string) (did, collection, rkey string, err error) {
	trimmed := strings.TrimPrefix(uri, "at://")
	parts := strings.SplitN(trimmed, "/", 3)
	if len(parts) != 3 || parts[0] == "" {
		return "", "", "", fmt.Errorf("invalid AT-URI: %q", uri)
	}
	return parts[0], parts[1], parts[2], nil
}

// truncate returns s truncated to at most n bytes.
func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n]
}

// marshalTags serializes a value as JSON, returning "[]" on nil or error.
func marshalTags(v any) string {
	if v == nil {
		return "[]"
	}
	b, err := json.Marshal(v)
	if err != nil {
		return "[]"
	}
	return string(b)
}

// str safely extracts a string field from a map[string]any.
func str(m map[string]any, key string) string {
	if v, ok := m[key]; ok {
		if s, ok := v.(string); ok {
			return s
		}
	}
	return ""
}

func firstString(m map[string]any, keys ...string) string {
	for _, key := range keys {
		if v := str(m, key); v != "" {
			return v
		}
	}
	return ""
}

// nestedMap safely extracts a nested map[string]any from a map.
func nestedMap(m map[string]any, key string) map[string]any {
	if v, ok := m[key]; ok {
		if nested, ok := v.(map[string]any); ok {
			return nested
		}
	}
	return nil
}
