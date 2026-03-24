package normalize

import "tangled.org/desertthunder.dev/twister/internal/store"

const collectionProfile = "sh.tangled.actor.profile"

// ProfileAdapter normalizes sh.tangled.actor.profile records.
// Title (author handle) is not available in the record payload — it is set by
// the indexer after identity-event handle resolution.
type ProfileAdapter struct{}

func (a *ProfileAdapter) Collection() string { return collectionProfile }
func (a *ProfileAdapter) RecordType() string { return "profile" }

func (a *ProfileAdapter) Searchable(record map[string]any) bool {
	return str(record, "description") != ""
}

func (a *ProfileAdapter) Normalize(event TapRecordEvent) (*store.Document, error) {
	r := event.Record
	rec := r.Record

	description := str(rec, "description")
	location := str(rec, "location")

	summary := description
	if location != "" {
		if summary != "" {
			summary = summary + " · " + location
		} else {
			summary = location
		}
	}

	return &store.Document{
		ID:         StableID(r.DID, r.Collection, r.RKey),
		DID:        r.DID,
		Collection: r.Collection,
		RKey:       r.RKey,
		ATURI:      BuildATURI(r.DID, r.Collection, r.RKey),
		CID:        r.CID,
		RecordType: a.RecordType(),
		Title:      "",
		Body:       description,
		Summary:    truncate(summary, 200),
		TagsJSON:   "[]",
	}, nil
}
