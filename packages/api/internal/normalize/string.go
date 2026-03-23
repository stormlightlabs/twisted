package normalize

import "tangled.org/desertthunder.dev/twister/internal/store"

const collectionString = "sh.tangled.string"

// StringAdapter normalizes sh.tangled.string records (code snippets/gists).
type StringAdapter struct{}

func (a *StringAdapter) Collection() string { return collectionString }
func (a *StringAdapter) RecordType() string { return "string" }

func (a *StringAdapter) Searchable(record map[string]any) bool {
	return str(record, "contents") != ""
}

func (a *StringAdapter) Normalize(event TapRecordEvent) (*store.Document, error) {
	r := event.Record
	rec := r.Record

	return &store.Document{
		ID:         StableID(r.DID, r.Collection, r.RKey),
		DID:        r.DID,
		Collection: r.Collection,
		RKey:       r.RKey,
		ATURI:      BuildATURI(r.DID, r.Collection, r.RKey),
		CID:        r.CID,
		RecordType: a.RecordType(),
		Title:      str(rec, "filename"),
		Body:       str(rec, "contents"),
		Summary:    str(rec, "description"),
		TagsJSON:   "[]",
		CreatedAt:  str(rec, "createdAt"),
	}, nil
}
