package index

import "strings"

const (
	ReadThroughOff     = "off"
	ReadThroughMissing = "missing"
	ReadThroughBroad   = "broad"
)

type Policy struct {
	indexed     allowlist
	readThrough allowlist
	mode        string
}

func NewPolicy(indexedCollections, readThroughCollections, mode string) Policy {
	if strings.TrimSpace(readThroughCollections) == "" {
		readThroughCollections = indexedCollections
	}
	return Policy{
		indexed:     parseAllowlist(indexedCollections),
		readThrough: parseAllowlist(readThroughCollections),
		mode:        normalizeMode(mode),
	}
}

func (p Policy) Allows(source, collection string) bool {
	if source == "read_through" {
		return p.readThrough.match(collection)
	}
	return p.indexed.match(collection)
}

func (p Policy) ReadThroughMode() string {
	return p.mode
}

func normalizeMode(mode string) string {
	switch strings.TrimSpace(strings.ToLower(mode)) {
	case ReadThroughOff, ReadThroughBroad:
		return strings.TrimSpace(strings.ToLower(mode))
	default:
		return ReadThroughMissing
	}
}

type allowlist struct {
	entries []string
}

func parseAllowlist(raw string) allowlist {
	if strings.TrimSpace(raw) == "" {
		return allowlist{}
	}
	parts := strings.FieldsFunc(raw, func(r rune) bool {
		return r == ',' || r == ' ' || r == '\n' || r == '\t'
	})
	entries := make([]string, 0, len(parts))
	for _, part := range parts {
		entry := strings.TrimSpace(part)
		if entry != "" {
			entries = append(entries, entry)
		}
	}
	return allowlist{entries: entries}
}

func (a allowlist) match(collection string) bool {
	if len(a.entries) == 0 {
		return true
	}
	for _, entry := range a.entries {
		if entry == collection {
			return true
		}
		if strings.HasSuffix(entry, "*") {
			prefix := strings.TrimSuffix(entry, "*")
			if strings.HasPrefix(collection, prefix) {
				return true
			}
		}
	}
	return false
}
