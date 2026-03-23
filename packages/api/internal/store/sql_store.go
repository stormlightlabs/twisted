package store

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"
)

// SQLStore implements Store against a libSQL database.
type SQLStore struct {
	db *sql.DB
}

// New wraps an open *sql.DB in a Store implementation.
func New(db *sql.DB) Store {
	return &SQLStore{db: db}
}

func (s *SQLStore) UpsertDocument(ctx context.Context, doc *Document) error {
	doc.IndexedAt = time.Now().UTC().Format(time.RFC3339)
	_, err := s.db.ExecContext(ctx, `
		INSERT INTO documents (
			id, did, collection, rkey, at_uri, cid, record_type,
			title, body, summary, repo_did, repo_name, author_handle,
			tags_json, language, created_at, updated_at, indexed_at, deleted_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(id) DO UPDATE SET
			did           = excluded.did,
			collection    = excluded.collection,
			rkey          = excluded.rkey,
			at_uri        = excluded.at_uri,
			cid           = excluded.cid,
			record_type   = excluded.record_type,
			title         = excluded.title,
			body          = excluded.body,
			summary       = excluded.summary,
			repo_did      = excluded.repo_did,
			repo_name     = excluded.repo_name,
			author_handle = excluded.author_handle,
			tags_json     = excluded.tags_json,
			language      = excluded.language,
			created_at    = excluded.created_at,
			updated_at    = excluded.updated_at,
			indexed_at    = excluded.indexed_at,
			deleted_at    = excluded.deleted_at`,
		doc.ID, doc.DID, doc.Collection, doc.RKey, doc.ATURI, doc.CID, doc.RecordType,
		doc.Title, doc.Body, doc.Summary, doc.RepoDID, doc.RepoName, doc.AuthorHandle,
		doc.TagsJSON, doc.Language, doc.CreatedAt, doc.UpdatedAt, doc.IndexedAt, nullableStr(doc.DeletedAt),
	)
	if err != nil {
		return fmt.Errorf("upsert document: %w", err)
	}
	return nil
}

func (s *SQLStore) GetDocument(ctx context.Context, id string) (*Document, error) {
	row := s.db.QueryRowContext(ctx, `
		SELECT id, did, collection, rkey, at_uri, cid, record_type,
		       title, body, summary, repo_did, repo_name, author_handle,
		       tags_json, language, created_at, updated_at, indexed_at, deleted_at
		FROM documents WHERE id = ?`, id)

	doc, err := scanDocument(row)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("get document: %w", err)
	}
	return doc, nil
}

func (s *SQLStore) MarkDeleted(ctx context.Context, id string) error {
	now := time.Now().UTC().Format(time.RFC3339)
	_, err := s.db.ExecContext(ctx,
		`UPDATE documents SET deleted_at = ? WHERE id = ?`, now, id)
	if err != nil {
		return fmt.Errorf("mark deleted: %w", err)
	}
	return nil
}

func (s *SQLStore) GetSyncState(ctx context.Context, consumer string) (*SyncState, error) {
	row := s.db.QueryRowContext(ctx, `
		SELECT consumer_name, cursor, high_water_mark, updated_at
		FROM sync_state WHERE consumer_name = ?`, consumer)

	ss := &SyncState{}
	var hwm sql.NullString
	err := row.Scan(&ss.ConsumerName, &ss.Cursor, &hwm, &ss.UpdatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("get sync state: %w", err)
	}
	ss.HighWaterMark = hwm.String
	return ss, nil
}

func (s *SQLStore) SetSyncState(ctx context.Context, consumer string, cursor string) error {
	now := time.Now().UTC().Format(time.RFC3339)
	_, err := s.db.ExecContext(ctx, `
		INSERT INTO sync_state (consumer_name, cursor, updated_at) VALUES (?, ?, ?)
		ON CONFLICT(consumer_name) DO UPDATE SET
			cursor     = excluded.cursor,
			updated_at = excluded.updated_at`,
		consumer, cursor, now,
	)
	if err != nil {
		return fmt.Errorf("set sync state: %w", err)
	}
	return nil
}

func (s *SQLStore) UpdateRecordState(ctx context.Context, subjectURI string, state string) error {
	now := time.Now().UTC().Format(time.RFC3339)
	_, err := s.db.ExecContext(ctx, `
		INSERT INTO record_state (subject_uri, state, updated_at) VALUES (?, ?, ?)
		ON CONFLICT(subject_uri) DO UPDATE SET
			state      = excluded.state,
			updated_at = excluded.updated_at`,
		subjectURI, state, now,
	)
	if err != nil {
		return fmt.Errorf("update record state: %w", err)
	}
	return nil
}

func scanDocument(row *sql.Row) (*Document, error) {
	doc := &Document{}
	var (
		title, body, summary, repoDID, repoName, authorHandle sql.NullString
		tagsJSON, language, createdAt, updatedAt, deletedAt   sql.NullString
	)
	err := row.Scan(
		&doc.ID, &doc.DID, &doc.Collection, &doc.RKey, &doc.ATURI, &doc.CID, &doc.RecordType,
		&title, &body, &summary, &repoDID, &repoName, &authorHandle,
		&tagsJSON, &language, &createdAt, &updatedAt, &doc.IndexedAt, &deletedAt,
	)
	if err != nil {
		return nil, err
	}
	doc.Title = title.String
	doc.Body = body.String
	doc.Summary = summary.String
	doc.RepoDID = repoDID.String
	doc.RepoName = repoName.String
	doc.AuthorHandle = authorHandle.String
	doc.TagsJSON = tagsJSON.String
	doc.Language = language.String
	doc.CreatedAt = createdAt.String
	doc.UpdatedAt = updatedAt.String
	doc.DeletedAt = deletedAt.String
	return doc, nil
}

func nullableStr(s string) any {
	if s == "" {
		return nil
	}
	return s
}
