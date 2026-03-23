package normalize

import (
	"fmt"

	"tangled.org/desertthunder.dev/twister/internal/store"
)

const collectionIssueComment = "sh.tangled.repo.issue.comment"

// IssueCommentAdapter normalizes issue comments for collaborator discovery.
type IssueCommentAdapter struct{}

func (a *IssueCommentAdapter) Collection() string { return collectionIssueComment }
func (a *IssueCommentAdapter) RecordType() string { return "issue_comment" }

func (a *IssueCommentAdapter) Searchable(record map[string]any) bool {
	return str(record, "body") != ""
}

func (a *IssueCommentAdapter) Normalize(event TapRecordEvent) (*store.Document, error) {
	r := event.Record
	rec := r.Record
	body := str(rec, "body")
	issueURI := str(rec, "issue")

	repoDID := ""
	if issueURI != "" {
		did, _, _, err := ParseATURI(issueURI)
		if err != nil {
			return nil, fmt.Errorf("issue comment issue AT-URI: %w", err)
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
