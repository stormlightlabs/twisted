package normalize

import "tangled.org/desertthunder.dev/twister/internal/store"

const collectionRepo = "sh.tangled.repo"

// RepoAdapter normalizes sh.tangled.repo records.
type RepoAdapter struct{}

func (a *RepoAdapter) Collection() string { return collectionRepo }
func (a *RepoAdapter) RecordType() string { return "repo" }

func (a *RepoAdapter) Searchable(record map[string]any) bool {
	return str(record, "name") != ""
}

func (a *RepoAdapter) Normalize(event TapRecordEvent) (*store.Document, error) {
	r := event.Record
	rec := r.Record

	name := str(rec, "name")
	description := str(rec, "description")

	return &store.Document{
		ID:         StableID(r.DID, r.Collection, r.RKey),
		DID:        r.DID,
		Collection: r.Collection,
		RKey:       r.RKey,
		ATURI:      BuildATURI(r.DID, r.Collection, r.RKey),
		CID:        r.CID,
		RecordType: a.RecordType(),
		Title:      name,
		Body:       description,
		Summary:    truncate(description, 200),
		RepoDID:    r.DID,
		RepoName:   name,
		TagsJSON:   marshalTags(rec["topics"]),
		CreatedAt:  str(rec, "createdAt"),
	}, nil
}
