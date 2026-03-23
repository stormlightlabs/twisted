package normalize

import (
	"fmt"

	"tangled.org/desertthunder.dev/twister/internal/store"
)

const collectionIssue = "sh.tangled.repo.issue"

// IssueAdapter normalizes sh.tangled.repo.issue records.
type IssueAdapter struct{}

func (a *IssueAdapter) Collection() string { return collectionIssue }
func (a *IssueAdapter) RecordType() string { return "issue" }

func (a *IssueAdapter) Searchable(_ map[string]any) bool { return true }

func (a *IssueAdapter) Normalize(event TapRecordEvent) (*store.Document, error) {
	r := event.Record
	rec := r.Record

	title := str(rec, "title")
	body := str(rec, "body")
	repoURI := str(rec, "repo")

	repoDID := ""
	if repoURI != "" {
		did, _, _, err := ParseATURI(repoURI)
		if err != nil {
			return nil, fmt.Errorf("issue repo AT-URI: %w", err)
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
		Title:      title,
		Body:       body,
		Summary:    truncate(body, 200),
		RepoDID:    repoDID,
		TagsJSON:   "[]",
		CreatedAt:  str(rec, "createdAt"),
	}, nil
}
