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
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin upsert document tx: %w", err)
	}
	defer tx.Rollback()

	_, err = tx.ExecContext(ctx, `
		INSERT INTO documents (
			id, did, collection, rkey, at_uri, cid, record_type,
			title, body, summary, repo_did, repo_name, author_handle,
			tags_json, language, created_at, updated_at, indexed_at, web_url, deleted_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
			web_url       = excluded.web_url,
			deleted_at    = excluded.deleted_at`,
		doc.ID, doc.DID, doc.Collection, doc.RKey, doc.ATURI, doc.CID, doc.RecordType,
		doc.Title, doc.Body, doc.Summary, doc.RepoDID, doc.RepoName, doc.AuthorHandle,
		doc.TagsJSON, doc.Language, doc.CreatedAt, doc.UpdatedAt, doc.IndexedAt, doc.WebURL, nullableStr(doc.DeletedAt),
	)
	if err != nil {
		return fmt.Errorf("upsert document: %w", err)
	}
	if err := syncDocumentFTS(ctx, tx, doc); err != nil {
		return err
	}
	if err := tx.Commit(); err != nil {
		return fmt.Errorf("commit upsert document tx: %w", err)
	}
	return nil
}

func (s *SQLStore) ListDocuments(ctx context.Context, filter DocumentFilter) ([]*Document, error) {
	query := `SELECT id, did, collection, rkey, at_uri, cid, record_type,
		       title, body, summary, repo_did, repo_name, author_handle,
		       tags_json, language, created_at, updated_at, indexed_at, web_url, deleted_at
		FROM documents WHERE deleted_at IS NULL`
	args := []any{}

	if filter.DocumentID != "" {
		query += " AND id = ?"
		args = append(args, filter.DocumentID)
	}
	if filter.Collection != "" {
		query += " AND collection = ?"
		args = append(args, filter.Collection)
	}
	if filter.DID != "" {
		query += " AND did = ?"
		args = append(args, filter.DID)
	}

	rows, err := s.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("list documents: %w", err)
	}
	defer rows.Close()

	var docs []*Document
	for rows.Next() {
		doc := &Document{}
		var (
			title, body, summary, repoDID, repoName, authorHandle       sql.NullString
			tagsJSON, language, createdAt, updatedAt, webURL, deletedAt sql.NullString
		)
		if err := rows.Scan(
			&doc.ID, &doc.DID, &doc.Collection, &doc.RKey, &doc.ATURI, &doc.CID, &doc.RecordType,
			&title, &body, &summary, &repoDID, &repoName, &authorHandle,
			&tagsJSON, &language, &createdAt, &updatedAt, &doc.IndexedAt, &webURL, &deletedAt,
		); err != nil {
			return nil, fmt.Errorf("scan document: %w", err)
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
		doc.WebURL = webURL.String
		doc.DeletedAt = deletedAt.String
		docs = append(docs, doc)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate documents: %w", err)
	}
	return docs, nil
}

func (s *SQLStore) OptimizeFTS(ctx context.Context) error {
	_, err := s.db.ExecContext(ctx, `INSERT INTO documents_fts(documents_fts) VALUES('optimize')`)
	if err != nil {
		return fmt.Errorf("optimize fts: %w", err)
	}
	return nil
}

func (s *SQLStore) GetDocument(ctx context.Context, id string) (*Document, error) {
	row := s.db.QueryRowContext(ctx, `
		SELECT id, did, collection, rkey, at_uri, cid, record_type,
		       title, body, summary, repo_did, repo_name, author_handle,
		       tags_json, language, created_at, updated_at, indexed_at, web_url, deleted_at
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
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin mark deleted tx: %w", err)
	}
	defer tx.Rollback()

	_, err = tx.ExecContext(ctx,
		`UPDATE documents SET deleted_at = ? WHERE id = ?`, now, id)
	if err != nil {
		return fmt.Errorf("mark deleted: %w", err)
	}
	if _, err := tx.ExecContext(ctx, `DELETE FROM documents_fts WHERE id = ?`, id); err != nil {
		return fmt.Errorf("delete document from fts: %w", err)
	}
	if err := tx.Commit(); err != nil {
		return fmt.Errorf("commit mark deleted tx: %w", err)
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

func (s *SQLStore) EnqueueIndexingJob(ctx context.Context, input IndexingJobInput) error {
	now := time.Now().UTC().Format(time.RFC3339)
	_, err := s.db.ExecContext(ctx, `
		INSERT INTO indexing_jobs (
			document_id, did, collection, rkey, cid, record_json,
			status, attempts, last_error, scheduled_at, updated_at
		) VALUES (?, ?, ?, ?, ?, ?, 'pending', 0, NULL, ?, ?)
		ON CONFLICT(document_id) DO UPDATE SET
			did = excluded.did,
			collection = excluded.collection,
			rkey = excluded.rkey,
			cid = excluded.cid,
			record_json = excluded.record_json,
			status = 'pending',
			last_error = NULL,
			scheduled_at = excluded.scheduled_at,
			updated_at = excluded.updated_at`,
		input.DocumentID, input.DID, input.Collection, input.RKey, input.CID, input.RecordJSON, now, now,
	)
	if err != nil {
		return fmt.Errorf("enqueue indexing job: %w", err)
	}
	return nil
}

func (s *SQLStore) ClaimIndexingJob(ctx context.Context) (*IndexingJob, error) {
	now := time.Now().UTC().Format(time.RFC3339)
	staleCutoff := time.Now().UTC().Add(-5 * time.Minute).Format(time.RFC3339)

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("begin claim indexing job tx: %w", err)
	}
	defer tx.Rollback()

	var job IndexingJob
	row := tx.QueryRowContext(ctx, `
		SELECT document_id, did, collection, rkey, cid, record_json,
		       attempts, status, COALESCE(last_error, ''), scheduled_at, updated_at
		FROM indexing_jobs
		WHERE (status = 'pending' AND scheduled_at <= ?)
		   OR (status = 'processing' AND updated_at <= ?)
		ORDER BY scheduled_at ASC, updated_at ASC
		LIMIT 1`, now, staleCutoff)

	err = row.Scan(
		&job.DocumentID,
		&job.DID,
		&job.Collection,
		&job.RKey,
		&job.CID,
		&job.RecordJSON,
		&job.Attempts,
		&job.Status,
		&job.LastError,
		&job.ScheduledAt,
		&job.UpdatedAt,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("select indexing job: %w", err)
	}

	res, err := tx.ExecContext(ctx, `
		UPDATE indexing_jobs
		SET status = 'processing', updated_at = ?
		WHERE document_id = ?`,
		now, job.DocumentID,
	)
	if err != nil {
		return nil, fmt.Errorf("mark indexing job processing: %w", err)
	}
	affected, err := res.RowsAffected()
	if err != nil {
		return nil, fmt.Errorf("rows affected claim indexing job: %w", err)
	}
	if affected == 0 {
		return nil, nil
	}

	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("commit claim indexing job tx: %w", err)
	}
	job.Status = "processing"
	job.UpdatedAt = now
	return &job, nil
}

func (s *SQLStore) CompleteIndexingJob(ctx context.Context, documentID string) error {
	_, err := s.db.ExecContext(ctx, `DELETE FROM indexing_jobs WHERE document_id = ?`, documentID)
	if err != nil {
		return fmt.Errorf("complete indexing job: %w", err)
	}
	return nil
}

func (s *SQLStore) RetryIndexingJob(ctx context.Context, documentID string, nextScheduledAt string, lastError string) error {
	now := time.Now().UTC().Format(time.RFC3339)
	_, err := s.db.ExecContext(ctx, `
		UPDATE indexing_jobs
		SET status = 'pending',
			attempts = attempts + 1,
			last_error = ?,
			scheduled_at = ?,
			updated_at = ?
		WHERE document_id = ?`,
		lastError, nextScheduledAt, now, documentID,
	)
	if err != nil {
		return fmt.Errorf("retry indexing job: %w", err)
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

func (s *SQLStore) CountPendingIndexingJobs(ctx context.Context) (int64, error) {
	var n int64
	err := s.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM indexing_jobs WHERE status = 'pending'`).Scan(&n)
	if err != nil {
		return 0, fmt.Errorf("count pending indexing jobs: %w", err)
	}
	return n, nil
}

func (s *SQLStore) Ping(ctx context.Context) error {
	return s.db.PingContext(ctx)
}

func scanDocument(row *sql.Row) (*Document, error) {
	doc := &Document{}
	var (
		title, body, summary, repoDID, repoName, authorHandle       sql.NullString
		tagsJSON, language, createdAt, updatedAt, webURL, deletedAt sql.NullString
	)
	err := row.Scan(
		&doc.ID, &doc.DID, &doc.Collection, &doc.RKey, &doc.ATURI, &doc.CID, &doc.RecordType,
		&title, &body, &summary, &repoDID, &repoName, &authorHandle,
		&tagsJSON, &language, &createdAt, &updatedAt, &doc.IndexedAt, &webURL, &deletedAt,
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
	doc.WebURL = webURL.String
	doc.DeletedAt = deletedAt.String
	return doc, nil
}

func nullableStr(s string) any {
	if s == "" {
		return nil
	}
	return s
}

type execer interface {
	ExecContext(ctx context.Context, query string, args ...any) (sql.Result, error)
}

func syncDocumentFTS(ctx context.Context, db execer, doc *Document) error {
	if _, err := db.ExecContext(ctx, `DELETE FROM documents_fts WHERE id = ?`, doc.ID); err != nil {
		return fmt.Errorf("delete document from fts: %w", err)
	}
	if doc.DeletedAt != "" {
		return nil
	}
	_, err := db.ExecContext(ctx, `
		INSERT INTO documents_fts (id, title, body, summary, repo_name, author_handle, tags_json)
		VALUES (?, ?, ?, ?, ?, ?, ?)`,
		doc.ID, doc.Title, doc.Body, doc.Summary, doc.RepoName, doc.AuthorHandle, doc.TagsJSON,
	)
	if err != nil {
		return fmt.Errorf("insert document into fts: %w", err)
	}
	return nil
}
