package normalize

import "tangled.org/desertthunder.dev/twister/internal/store"

const collectionFollow = "sh.tangled.graph.follow"

// FollowAdapter normalizes follow edges for graph-backfill discovery.
type FollowAdapter struct{}

func (a *FollowAdapter) Collection() string { return collectionFollow }
func (a *FollowAdapter) RecordType() string { return "follow" }

func (a *FollowAdapter) Searchable(_ map[string]any) bool { return false }

func (a *FollowAdapter) Normalize(event TapRecordEvent) (*store.Document, error) {
	r := event.Record
	rec := r.Record
	subject := str(rec, "subject")

	return &store.Document{
		ID:         StableID(r.DID, r.Collection, r.RKey),
		DID:        r.DID,
		Collection: r.Collection,
		RKey:       r.RKey,
		ATURI:      BuildATURI(r.DID, r.Collection, r.RKey),
		CID:        r.CID,
		RecordType: a.RecordType(),
		Title:      subject,
		RepoDID:    subject,
		TagsJSON:   "[]",
		CreatedAt:  str(rec, "createdAt"),
	}, nil
}
