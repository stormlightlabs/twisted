package normalize

import (
	"fmt"

	"tangled.org/desertthunder.dev/twister/internal/store"
)

const collectionPullComment = "sh.tangled.repo.pull.comment"

// PullCommentAdapter normalizes pull comments for collaborator discovery.
type PullCommentAdapter struct{}

func (a *PullCommentAdapter) Collection() string { return collectionPullComment }
func (a *PullCommentAdapter) RecordType() string { return "pull_comment" }

func (a *PullCommentAdapter) Searchable(record map[string]any) bool {
	return str(record, "body") != ""
}

func (a *PullCommentAdapter) Normalize(event TapRecordEvent) (*store.Document, error) {
	r := event.Record
	rec := r.Record
	body := str(rec, "body")
	pullURI := str(rec, "pull")

	repoDID := ""
	if pullURI != "" {
		did, _, _, err := ParseATURI(pullURI)
		if err != nil {
			return nil, fmt.Errorf("pull comment pull AT-URI: %w", err)
		}
		repoDID = did
	}

	return &store.Document{
		ID:         StableID(r.DID, r.Collection, r.RKey),
		DID:        r.DID,
		Collection: r.Collection,
		RKey:       r.RKey,
		ATURI:      BuildATURI(r.DID, r.Collection, r.RKey),
		CID:        r.CID,
		RecordType: a.RecordType(),
		Body:       body,
		Summary:    truncate(body, 200),
		RepoDID:    repoDID,
		TagsJSON:   "[]",
		CreatedAt:  str(rec, "createdAt"),
	}, nil
}
