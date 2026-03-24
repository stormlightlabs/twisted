package normalize

import (
	"fmt"

	"tangled.org/desertthunder.dev/twister/internal/store"
)

const collectionPull = "sh.tangled.repo.pull"

// PullAdapter normalizes sh.tangled.repo.pull records.
type PullAdapter struct{}

func (a *PullAdapter) Collection() string { return collectionPull }
func (a *PullAdapter) RecordType() string { return "pull" }

func (a *PullAdapter) Searchable(_ map[string]any) bool { return true }

func (a *PullAdapter) Normalize(event TapRecordEvent) (*store.Document, error) {
	r := event.Record
	rec := r.Record

	title := str(rec, "title")
	body := str(rec, "body")

	repoDID := ""
	target := nestedMap(rec, "target")
	if target != nil {
		repoURI := str(target, "repo")
		if repoURI != "" {
			did, _, _, err := ParseATURI(repoURI)
			if err != nil {
				return nil, fmt.Errorf("pull target repo AT-URI: %w", err)
			}
			repoDID = did
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
		Title:      title,
		Body:       body,
		Summary:    truncate(body, 200),
		RepoDID:    repoDID,
		TagsJSON:   "[]",
		CreatedAt:  str(rec, "createdAt"),
	}, nil
}
