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

func (s *SQLStore) UpsertIdentityHandle(ctx context.Context, did, handle string, isActive bool, status string) error {
	now := time.Now().UTC().Format(time.RFC3339)
	_, err := s.db.ExecContext(ctx, `
		INSERT INTO identity_handles (did, handle, is_active, status, updated_at)
		VALUES (?, ?, ?, ?, ?)
		ON CONFLICT(did) DO UPDATE SET
			handle = excluded.handle,
			is_active = excluded.is_active,
			status = excluded.status,
			updated_at = excluded.updated_at`,
		did, handle, isActive, status, now,
	)
	if err != nil {
		return fmt.Errorf("upsert identity handle: %w", err)
	}
	return nil
}

func (s *SQLStore) GetIdentityHandle(ctx context.Context, did string) (string, error) {
	var handle sql.NullString
	err := s.db.QueryRowContext(ctx, `SELECT handle FROM identity_handles WHERE did = ?`, did).Scan(&handle)
	if errors.Is(err, sql.ErrNoRows) {
		return "", nil
	}
	if err != nil {
		return "", fmt.Errorf("get identity handle: %w", err)
	}
	return handle.String, nil
}

func (s *SQLStore) EnqueueEmbeddingJob(ctx context.Context, documentID string) error {
	now := time.Now().UTC().Format(time.RFC3339)
	_, err := s.db.ExecContext(ctx, `
		INSERT INTO embedding_jobs (document_id, status, attempts, last_error, scheduled_at, updated_at)
		VALUES (?, 'pending', 0, NULL, ?, ?)
		ON CONFLICT(document_id) DO UPDATE SET
			status = 'pending',
			last_error = NULL,
			scheduled_at = excluded.scheduled_at,
			updated_at = excluded.updated_at`,
		documentID, now, now,
	)
	if err != nil {
		return fmt.Errorf("enqueue embedding job: %w", err)
	}
	return nil
}

func (s *SQLStore) GetFollowSubjects(ctx context.Context, did string) ([]string, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT DISTINCT repo_did
		FROM documents
		WHERE did = ?
		  AND collection = 'sh.tangled.graph.follow'
		  AND deleted_at IS NULL
		  AND repo_did IS NOT NULL
		  AND repo_did != ''`,
		did,
	)
	if err != nil {
		return nil, fmt.Errorf("get follow subjects: %w", err)
	}
	defer rows.Close()

	var subjects []string
	for rows.Next() {
		var subject string
		if err := rows.Scan(&subject); err != nil {
			return nil, fmt.Errorf("scan follow subject: %w", err)
		}
		subjects = append(subjects, subject)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate follow subjects: %w", err)
	}
	return subjects, nil
}

func (s *SQLStore) GetRepoCollaborators(ctx context.Context, repoOwnerDID string) ([]string, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT DISTINCT did
		FROM documents
		WHERE repo_did = ?
		  AND did != ?
		  AND deleted_at IS NULL
		  AND collection IN (
			'sh.tangled.repo.issue',
			'sh.tangled.repo.pull',
			'sh.tangled.repo.issue.comment',
			'sh.tangled.repo.pull.comment'
		  )`,
		repoOwnerDID, repoOwnerDID,
	)
	if err != nil {
		return nil, fmt.Errorf("get repo collaborators: %w", err)
	}
	defer rows.Close()

	var collaborators []string
	for rows.Next() {
		var collaborator string
		if err := rows.Scan(&collaborator); err != nil {
			return nil, fmt.Errorf("scan collaborator: %w", err)
		}
		collaborators = append(collaborators, collaborator)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate collaborators: %w", err)
	}
	return collaborators, nil
}

func (s *SQLStore) CountDocuments(ctx context.Context) (int64, error) {
	var n int64
	err := s.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM documents WHERE deleted_at IS NULL`).Scan(&n)
	if err != nil {
		return 0, fmt.Errorf("count documents: %w", err)
	}
	return n, nil
}

func (s *SQLStore) Ping(ctx context.Context) error {
	return s.db.PingContext(ctx)
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
