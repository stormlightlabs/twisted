package store

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"
)

type PostgresStore struct {
	db *sql.DB
}

type pgArgs struct {
	args []any
}

func newPGArgs(initial ...any) *pgArgs {
	return &pgArgs{args: append([]any{}, initial...)}
}

func (p *pgArgs) Add(value any) string {
	p.args = append(p.args, value)
	return fmt.Sprintf("$%d", len(p.args))
}

func (p *pgArgs) Values() []any {
	return p.args
}

func (s *PostgresStore) UpsertDocument(ctx context.Context, doc *Document) error {
	doc.IndexedAt = time.Now().UTC().Format(time.RFC3339)

	_, err := s.db.ExecContext(ctx, `
		INSERT INTO documents (
			id, did, collection, rkey, at_uri, cid, record_type,
			title, body, summary, repo_did, repo_name, author_handle,
			tags_json, language, created_at, updated_at, indexed_at, web_url, deleted_at
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7,
			$8, $9, $10, $11, $12, $13,
			$14, $15, $16, $17, $18, $19, $20
		)
		ON CONFLICT(id) DO UPDATE SET
			did = excluded.did,
			collection = excluded.collection,
			rkey = excluded.rkey,
			at_uri = excluded.at_uri,
			cid = excluded.cid,
			record_type = excluded.record_type,
			title = excluded.title,
			body = excluded.body,
			summary = excluded.summary,
			repo_did = excluded.repo_did,
			repo_name = excluded.repo_name,
			author_handle = excluded.author_handle,
			tags_json = excluded.tags_json,
			language = excluded.language,
			created_at = excluded.created_at,
			updated_at = excluded.updated_at,
			indexed_at = excluded.indexed_at,
			web_url = excluded.web_url,
			deleted_at = excluded.deleted_at`,
		doc.ID, doc.DID, doc.Collection, doc.RKey, doc.ATURI, doc.CID, doc.RecordType,
		doc.Title, doc.Body, doc.Summary, doc.RepoDID, doc.RepoName, doc.AuthorHandle,
		doc.TagsJSON, doc.Language, doc.CreatedAt, doc.UpdatedAt, doc.IndexedAt,
		doc.WebURL, nullableStr(doc.DeletedAt),
	)
	if err != nil {
		return fmt.Errorf("upsert document: %w", err)
	}
	return nil
}

func (s *PostgresStore) ListDocuments(ctx context.Context, filter DocumentFilter) ([]*Document, error) {
	query := `SELECT id, did, collection, rkey, at_uri, cid, record_type,
		title, body, summary, repo_did, repo_name, author_handle,
		tags_json, language, created_at, updated_at, indexed_at, web_url, deleted_at
		FROM documents WHERE deleted_at IS NULL`
	args := newPGArgs()

	if filter.DocumentID != "" {
		query += " AND id = " + args.Add(filter.DocumentID)
	}
	if filter.Collection != "" {
		query += " AND collection = " + args.Add(filter.Collection)
	}
	if filter.DID != "" {
		query += " AND did = " + args.Add(filter.DID)
	}

	rows, err := s.db.QueryContext(ctx, query, args.Values()...)
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

func (s *PostgresStore) OptimizeSearchIndex(_ context.Context) error {
	return nil
}

func (s *PostgresStore) GetDocument(ctx context.Context, id string) (*Document, error) {
	row := s.db.QueryRowContext(ctx, `
		SELECT id, did, collection, rkey, at_uri, cid, record_type,
		       title, body, summary, repo_did, repo_name, author_handle,
		       tags_json, language, created_at, updated_at, indexed_at, web_url, deleted_at
		FROM documents WHERE id = $1`, id)

	doc, err := scanDocument(row)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("get document: %w", err)
	}
	return doc, nil
}

func (s *PostgresStore) MarkDeleted(ctx context.Context, id string) error {
	now := time.Now().UTC().Format(time.RFC3339)
	_, err := s.db.ExecContext(ctx, `UPDATE documents SET deleted_at = $1 WHERE id = $2`, now, id)
	if err != nil {
		return fmt.Errorf("mark deleted: %w", err)
	}
	return nil
}

func (s *PostgresStore) GetSyncState(ctx context.Context, consumer string) (*SyncState, error) {
	row := s.db.QueryRowContext(ctx, `
		SELECT consumer_name, cursor, COALESCE(high_water_mark, ''), updated_at
		FROM sync_state WHERE consumer_name = $1`, consumer)

	ss := &SyncState{}
	err := row.Scan(&ss.ConsumerName, &ss.Cursor, &ss.HighWaterMark, &ss.UpdatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("get sync state: %w", err)
	}
	return ss, nil
}

func (s *PostgresStore) SetSyncState(ctx context.Context, consumer string, cursor string) error {
	now := time.Now().UTC().Format(time.RFC3339)
	_, err := s.db.ExecContext(ctx, `
		INSERT INTO sync_state (consumer_name, cursor, updated_at) VALUES ($1, $2, $3)
		ON CONFLICT(consumer_name) DO UPDATE SET
			cursor = excluded.cursor,
			updated_at = excluded.updated_at`,
		consumer, cursor, now,
	)
	if err != nil {
		return fmt.Errorf("set sync state: %w", err)
	}
	return nil
}

func (s *PostgresStore) UpdateRecordState(ctx context.Context, subjectURI string, state string) error {
	now := time.Now().UTC().Format(time.RFC3339)
	_, err := s.db.ExecContext(ctx, `
		INSERT INTO record_state (subject_uri, state, updated_at) VALUES ($1, $2, $3)
		ON CONFLICT(subject_uri) DO UPDATE SET
			state = excluded.state,
			updated_at = excluded.updated_at`,
		subjectURI, state, now,
	)
	if err != nil {
		return fmt.Errorf("update record state: %w", err)
	}
	return nil
}

func (s *PostgresStore) UpsertIdentityHandle(
	ctx context.Context, did, handle string, isActive bool, status string,
) error {
	now := time.Now().UTC().Format(time.RFC3339)
	_, err := s.db.ExecContext(ctx, `
		INSERT INTO identity_handles (did, handle, is_active, status, updated_at)
		VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT(did) DO UPDATE SET
			handle = excluded.handle,
			is_active = excluded.is_active,
			status = excluded.status,
			updated_at = excluded.updated_at`,
		did, handle, isActive, nullableStr(status), now,
	)
	if err != nil {
		return fmt.Errorf("upsert identity handle: %w", err)
	}
	return nil
}

func (s *PostgresStore) GetIdentityHandle(ctx context.Context, did string) (string, error) {
	var handle sql.NullString
	err := s.db.QueryRowContext(ctx, `SELECT handle FROM identity_handles WHERE did = $1`, did).Scan(&handle)
	if errors.Is(err, sql.ErrNoRows) {
		return "", nil
	}
	if err != nil {
		return "", fmt.Errorf("get identity handle: %w", err)
	}
	return handle.String, nil
}

func (s *PostgresStore) GetIndexingJob(ctx context.Context, documentID string) (*IndexingJob, error) {
	row := s.db.QueryRowContext(ctx, `
		SELECT document_id, did, collection, rkey, cid, record_json, source,
		       attempts, status, COALESCE(last_error, ''), scheduled_at, updated_at,
		       COALESCE(lease_owner, ''), COALESCE(lease_expires_at, ''),
		       COALESCE(completed_at, '')
		FROM indexing_jobs
		WHERE document_id = $1`, documentID)

	job, err := scanIndexingJob(row)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("get indexing job: %w", err)
	}
	return job, nil
}

func (s *PostgresStore) EnqueueIndexingJob(ctx context.Context, input IndexingJobInput) error {
	now := time.Now().UTC().Format(time.RFC3339)
	source := strings.TrimSpace(input.Source)
	if source == "" {
		source = IndexSourceReadThrough
	}

	_, err := s.db.ExecContext(ctx, `
		INSERT INTO indexing_jobs (
			document_id, did, collection, rkey, cid, record_json, source,
			status, attempts, last_error, scheduled_at, updated_at,
			lease_owner, lease_expires_at, completed_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0, NULL, $9, $10, '', '', '')
		ON CONFLICT(document_id) DO UPDATE SET
			did = excluded.did,
			collection = excluded.collection,
			rkey = excluded.rkey,
			cid = excluded.cid,
			record_json = excluded.record_json,
			source = excluded.source,
			status = excluded.status,
			last_error = NULL,
			scheduled_at = excluded.scheduled_at,
			updated_at = excluded.updated_at,
			lease_owner = '',
			lease_expires_at = '',
			completed_at = ''`,
		input.DocumentID, input.DID, input.Collection, input.RKey, input.CID,
		input.RecordJSON, source, IndexingJobPending, now, now,
	)
	if err != nil {
		return fmt.Errorf("enqueue indexing job: %w", err)
	}
	return nil
}

func (s *PostgresStore) ClaimIndexingJob(
	ctx context.Context, workerID string, leaseUntil string,
) (*IndexingJob, error) {
	now := time.Now().UTC().Format(time.RFC3339)
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("begin claim tx: %w", err)
	}
	defer tx.Rollback()

	row := tx.QueryRowContext(ctx, `
		WITH candidate AS (
			SELECT document_id
			FROM indexing_jobs
			WHERE (
				status = $1
				AND scheduled_at::timestamptz <= $2::timestamptz
			) OR (
				status = $3
				AND lease_expires_at IS NOT NULL
				AND lease_expires_at != ''
				AND lease_expires_at::timestamptz <= $2::timestamptz
			)
			ORDER BY scheduled_at::timestamptz ASC, updated_at::timestamptz ASC
			FOR UPDATE SKIP LOCKED
			LIMIT 1
		)
		UPDATE indexing_jobs jobs
		SET status = $4, updated_at = $5, lease_owner = $6, lease_expires_at = $7
		FROM candidate
		WHERE jobs.document_id = candidate.document_id
		RETURNING jobs.document_id, jobs.did, jobs.collection, jobs.rkey, jobs.cid,
		          jobs.record_json, jobs.source, jobs.attempts, jobs.status,
		          COALESCE(jobs.last_error, ''), jobs.scheduled_at, jobs.updated_at,
		          COALESCE(jobs.lease_owner, ''), COALESCE(jobs.lease_expires_at, ''),
		          COALESCE(jobs.completed_at, '')`,
		IndexingJobPending, now, IndexingJobProcessing, IndexingJobProcessing,
		now, workerID, leaseUntil,
	)

	job, err := scanIndexingJob(row)
	if errors.Is(err, sql.ErrNoRows) {
		if err := tx.Commit(); err != nil {
			return nil, fmt.Errorf("commit empty claim tx: %w", err)
		}
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("claim indexing job: %w", err)
	}
	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("commit claim tx: %w", err)
	}
	return job, nil
}

func (s *PostgresStore) CompleteIndexingJob(ctx context.Context, documentID string) error {
	now := time.Now().UTC().Format(time.RFC3339)
	_, err := s.db.ExecContext(ctx, `
		UPDATE indexing_jobs
		SET status = $1, updated_at = $2, completed_at = $3,
		    lease_owner = '', lease_expires_at = '', last_error = NULL
		WHERE document_id = $4`,
		IndexingJobCompleted, now, now, documentID,
	)
	if err != nil {
		return fmt.Errorf("complete indexing job: %w", err)
	}
	return nil
}

func (s *PostgresStore) RetryIndexingJob(
	ctx context.Context, documentID string, nextScheduledAt string, lastError string,
) error {
	now := time.Now().UTC().Format(time.RFC3339)
	_, err := s.db.ExecContext(ctx, `
		UPDATE indexing_jobs
		SET status = $1, attempts = attempts + 1, last_error = $2, scheduled_at = $3,
		    updated_at = $4, lease_owner = '', lease_expires_at = ''
		WHERE document_id = $5`,
		IndexingJobPending, lastError, nextScheduledAt, now, documentID,
	)
	if err != nil {
		return fmt.Errorf("retry indexing job: %w", err)
	}
	return nil
}

func (s *PostgresStore) FailIndexingJob(
	ctx context.Context, documentID string, status string, lastError string,
) error {
	now := time.Now().UTC().Format(time.RFC3339)
	_, err := s.db.ExecContext(ctx, `
		UPDATE indexing_jobs
		SET status = $1, attempts = attempts + 1, last_error = $2, updated_at = $3,
		    lease_owner = '', lease_expires_at = ''
		WHERE document_id = $4`,
		status, lastError, now, documentID,
	)
	if err != nil {
		return fmt.Errorf("fail indexing job: %w", err)
	}
	return nil
}

func (s *PostgresStore) ListIndexingJobs(
	ctx context.Context, filter IndexingJobFilter,
) ([]*IndexingJob, error) {
	query := `
		SELECT document_id, did, collection, rkey, cid, record_json, source,
		       attempts, status, COALESCE(last_error, ''), scheduled_at, updated_at,
		       COALESCE(lease_owner, ''), COALESCE(lease_expires_at, ''),
		       COALESCE(completed_at, '')
		FROM indexing_jobs
		WHERE 1 = 1`
	args := newPGArgs()

	if filter.DocumentID != "" {
		query += " AND document_id = " + args.Add(filter.DocumentID)
	}
	if filter.Status != "" {
		query += " AND status = " + args.Add(filter.Status)
	}
	if filter.Source != "" {
		query += " AND source = " + args.Add(filter.Source)
	}

	query += " ORDER BY updated_at::timestamptz DESC"
	limit := filter.Limit
	if limit <= 0 {
		limit = 50
	}
	query += " LIMIT " + args.Add(limit)
	if filter.Offset > 0 {
		query += " OFFSET " + args.Add(filter.Offset)
	}

	rows, err := s.db.QueryContext(ctx, query, args.Values()...)
	if err != nil {
		return nil, fmt.Errorf("list indexing jobs: %w", err)
	}
	defer rows.Close()

	var jobs []*IndexingJob
	for rows.Next() {
		job, err := scanIndexingJob(rows)
		if err != nil {
			return nil, fmt.Errorf("scan indexing job: %w", err)
		}
		jobs = append(jobs, job)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate indexing jobs: %w", err)
	}
	return jobs, nil
}

func (s *PostgresStore) GetIndexingJobStats(ctx context.Context) (*IndexingJobStats, error) {
	row := s.db.QueryRowContext(ctx, `
		SELECT
			COUNT(*) FILTER (WHERE status = $1),
			COUNT(*) FILTER (WHERE status = $2),
			COUNT(*) FILTER (WHERE status = $3),
			COUNT(*) FILTER (WHERE status = $4),
			COUNT(*) FILTER (WHERE status = $5),
			COALESCE(MIN(CASE WHEN status = $1 THEN scheduled_at END), ''),
			COALESCE(MIN(CASE WHEN status = $2 THEN updated_at END), ''),
			COALESCE(MAX(completed_at), ''),
			COALESCE(MAX(updated_at), '')
		FROM indexing_jobs`,
		IndexingJobPending, IndexingJobProcessing, IndexingJobCompleted,
		IndexingJobFailed, IndexingJobDeadLetter,
	)

	stats := &IndexingJobStats{}
	err := row.Scan(
		&stats.Pending, &stats.Processing, &stats.Completed, &stats.Failed,
		&stats.DeadLetter, &stats.OldestPendingAt, &stats.OldestRunningAt,
		&stats.LastCompletedAt, &stats.LastProcessedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("get indexing job stats: %w", err)
	}
	return stats, nil
}

func (s *PostgresStore) AppendIndexingAudit(ctx context.Context, input IndexingAuditInput) error {
	now := time.Now().UTC().Format(time.RFC3339)
	_, err := s.db.ExecContext(ctx, `
		INSERT INTO indexing_audit (
			source, document_id, collection, cid, decision, attempt, error, created_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
		input.Source, input.DocumentID, input.Collection, input.CID,
		input.Decision, input.Attempt, nullableStr(input.Error), now,
	)
	if err != nil {
		return fmt.Errorf("append indexing audit: %w", err)
	}
	return nil
}

func (s *PostgresStore) ListIndexingAudit(
	ctx context.Context, filter IndexingAuditFilter,
) ([]*IndexingAuditEntry, error) {
	query := `
		SELECT id, source, document_id, collection, cid, decision,
		       attempt, COALESCE(error, ''), created_at
		FROM indexing_audit
		WHERE 1 = 1`
	args := newPGArgs()

	if filter.DocumentID != "" {
		query += " AND document_id = " + args.Add(filter.DocumentID)
	}
	if filter.Source != "" {
		query += " AND source = " + args.Add(filter.Source)
	}
	if filter.Decision != "" {
		query += " AND decision = " + args.Add(filter.Decision)
	}

	query += " ORDER BY created_at::timestamptz DESC"
	limit := filter.Limit
	if limit <= 0 {
		limit = 50
	}
	query += " LIMIT " + args.Add(limit)
	if filter.Offset > 0 {
		query += " OFFSET " + args.Add(filter.Offset)
	}

	rows, err := s.db.QueryContext(ctx, query, args.Values()...)
	if err != nil {
		return nil, fmt.Errorf("list indexing audit: %w", err)
	}
	defer rows.Close()

	var entries []*IndexingAuditEntry
	for rows.Next() {
		entry := &IndexingAuditEntry{}
		if err := rows.Scan(
			&entry.ID, &entry.Source, &entry.DocumentID, &entry.Collection,
			&entry.CID, &entry.Decision, &entry.Attempt, &entry.Error,
			&entry.CreatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan indexing audit: %w", err)
		}
		entries = append(entries, entry)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate indexing audit: %w", err)
	}
	return entries, nil
}

func (s *PostgresStore) GetFollowSubjects(ctx context.Context, did string) ([]string, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT DISTINCT repo_did
		FROM documents
		WHERE did = $1
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

func (s *PostgresStore) GetRepoCollaborators(ctx context.Context, repoOwnerDID string) ([]string, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT DISTINCT did
		FROM documents
		WHERE repo_did = $1
		  AND did != $1
		  AND deleted_at IS NULL
		  AND collection IN (
			'sh.tangled.repo.issue',
			'sh.tangled.repo.pull',
			'sh.tangled.repo.issue.comment',
			'sh.tangled.repo.pull.comment'
		  )`,
		repoOwnerDID,
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

func (s *PostgresStore) CountDocuments(ctx context.Context) (int64, error) {
	var n int64
	err := s.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM documents WHERE deleted_at IS NULL`).Scan(&n)
	if err != nil {
		return 0, fmt.Errorf("count documents: %w", err)
	}
	return n, nil
}

func (s *PostgresStore) CountPendingIndexingJobs(ctx context.Context) (int64, error) {
	var n int64
	err := s.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM indexing_jobs WHERE status = 'pending'`).Scan(&n)
	if err != nil {
		return 0, fmt.Errorf("count pending indexing jobs: %w", err)
	}
	return n, nil
}

func (s *PostgresStore) InsertJetstreamEvent(ctx context.Context, event *JetstreamEvent, maxEvents int) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin insert jetstream event tx: %w", err)
	}
	defer tx.Rollback()

	_, err = tx.ExecContext(ctx, `
		INSERT INTO jetstream_events (time_us, did, kind, collection, rkey, operation, payload, received_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
		event.TimeUS, event.DID, event.Kind, nullableStr(event.Collection),
		nullableStr(event.RKey), nullableStr(event.Operation), event.Payload, event.ReceivedAt,
	)
	if err != nil {
		return fmt.Errorf("insert jetstream event: %w", err)
	}

	if maxEvents > 0 {
		_, err = tx.ExecContext(ctx, `
			DELETE FROM jetstream_events
			WHERE id IN (
				SELECT id FROM jetstream_events
				ORDER BY time_us DESC
				OFFSET $1
			)`, maxEvents)
		if err != nil {
			return fmt.Errorf("trim jetstream events: %w", err)
		}
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("commit insert jetstream event tx: %w", err)
	}
	return nil
}

func (s *PostgresStore) ListJetstreamEvents(
	ctx context.Context, filter JetstreamEventFilter,
) ([]*JetstreamEvent, error) {
	query := `
		SELECT id, time_us, did, kind,
		       COALESCE(collection, ''), COALESCE(rkey, ''), COALESCE(operation, ''),
		       payload, received_at
		FROM jetstream_events WHERE 1=1`
	args := newPGArgs()

	if filter.Collection != "" {
		query += " AND collection = " + args.Add(filter.Collection)
	}
	if filter.DID != "" {
		query += " AND did = " + args.Add(filter.DID)
	}
	if filter.Operation != "" {
		query += " AND operation = " + args.Add(filter.Operation)
	}

	query += " ORDER BY time_us DESC"
	limit := filter.Limit
	if limit <= 0 {
		limit = 50
	}
	query += " LIMIT " + args.Add(limit)
	if filter.Offset > 0 {
		query += " OFFSET " + args.Add(filter.Offset)
	}

	rows, err := s.db.QueryContext(ctx, query, args.Values()...)
	if err != nil {
		return nil, fmt.Errorf("list jetstream events: %w", err)
	}
	defer rows.Close()

	var events []*JetstreamEvent
	for rows.Next() {
		e := &JetstreamEvent{}
		if err := rows.Scan(
			&e.ID, &e.TimeUS, &e.DID, &e.Kind,
			&e.Collection, &e.RKey, &e.Operation,
			&e.Payload, &e.ReceivedAt,
		); err != nil {
			return nil, fmt.Errorf("scan jetstream event: %w", err)
		}
		events = append(events, e)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate jetstream events: %w", err)
	}
	return events, nil
}

func (s *PostgresStore) Ping(ctx context.Context) error {
	return s.db.PingContext(ctx)
}
