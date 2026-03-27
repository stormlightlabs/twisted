package store

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"
)

func (s *SQLiteStore) GetIndexingJob(ctx context.Context, documentID string) (*IndexingJob, error) {
	row := s.db.QueryRowContext(ctx, `
		SELECT document_id, did, collection, rkey, cid, record_json, source,
		       attempts, status, COALESCE(last_error, ''), scheduled_at, updated_at,
		       COALESCE(lease_owner, ''), COALESCE(lease_expires_at, ''),
		       COALESCE(completed_at, '')
		FROM indexing_jobs
		WHERE document_id = ?`, documentID)

	job, err := scanIndexingJob(row)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("get indexing job: %w", err)
	}
	return job, nil
}

func (s *SQLiteStore) EnqueueIndexingJob(ctx context.Context, input IndexingJobInput) error {
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
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, NULL, ?, ?, '', '', '')
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

func (s *SQLiteStore) ClaimIndexingJob(
	ctx context.Context, workerID string, leaseUntil string,
) (*IndexingJob, error) {
	now := time.Now().UTC().Format(time.RFC3339)
	conn, err := s.db.Conn(ctx)
	if err != nil {
		return nil, fmt.Errorf("claim indexing job conn: %w", err)
	}
	defer conn.Close()

	if _, err := conn.ExecContext(ctx, `BEGIN IMMEDIATE`); err != nil {
		return nil, fmt.Errorf("begin immediate claim tx: %w", err)
	}
	committed := false
	defer func() {
		if !committed {
			_, _ = conn.ExecContext(context.Background(), `ROLLBACK`)
		}
	}()

	var documentID string
	err = conn.QueryRowContext(ctx, `
		SELECT document_id
		FROM indexing_jobs
		WHERE (status = ? AND datetime(scheduled_at) <= datetime(?))
		   OR (
			status = ?
			AND lease_expires_at != ''
			AND datetime(lease_expires_at) <= datetime(?)
		   )
		ORDER BY scheduled_at ASC, updated_at ASC
		LIMIT 1`,
		IndexingJobPending, now, IndexingJobProcessing, now,
	).Scan(&documentID)
	if errors.Is(err, sql.ErrNoRows) {
		if _, err := conn.ExecContext(ctx, `COMMIT`); err != nil {
			return nil, fmt.Errorf("commit empty claim tx: %w", err)
		}
		committed = true
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("select claim candidate: %w", err)
	}

	row := conn.QueryRowContext(ctx, `
		UPDATE indexing_jobs
		SET status = ?, updated_at = ?, lease_owner = ?, lease_expires_at = ?
		WHERE document_id = ?
		RETURNING document_id, did, collection, rkey, cid, record_json, source,
		          attempts, status, COALESCE(last_error, ''), scheduled_at,
		          updated_at, COALESCE(lease_owner, ''),
		          COALESCE(lease_expires_at, ''), COALESCE(completed_at, '')`,
		IndexingJobProcessing, now, workerID, leaseUntil, documentID,
	)

	job, err := scanIndexingJob(row)
	if err != nil {
		return nil, fmt.Errorf("update claim candidate: %w", err)
	}
	if _, err := conn.ExecContext(ctx, `COMMIT`); err != nil {
		return nil, fmt.Errorf("commit claim tx: %w", err)
	}
	committed = true
	return job, nil
}

func (s *SQLiteStore) CompleteIndexingJob(ctx context.Context, documentID string) error {
	now := time.Now().UTC().Format(time.RFC3339)
	_, err := s.db.ExecContext(ctx, `
		UPDATE indexing_jobs
		SET status = ?, updated_at = ?, completed_at = ?,
		    lease_owner = '', lease_expires_at = '', last_error = NULL
		WHERE document_id = ?`,
		IndexingJobCompleted, now, now, documentID,
	)
	if err != nil {
		return fmt.Errorf("complete indexing job: %w", err)
	}
	return nil
}

func (s *SQLiteStore) RetryIndexingJob(
	ctx context.Context, documentID string, nextScheduledAt string, lastError string,
) error {
	now := time.Now().UTC().Format(time.RFC3339)
	_, err := s.db.ExecContext(ctx, `
		UPDATE indexing_jobs
		SET status = ?, attempts = attempts + 1, last_error = ?, scheduled_at = ?,
		    updated_at = ?, lease_owner = '', lease_expires_at = ''
		WHERE document_id = ?`,
		IndexingJobPending, lastError, nextScheduledAt, now, documentID,
	)
	if err != nil {
		return fmt.Errorf("retry indexing job: %w", err)
	}
	return nil
}

func (s *SQLiteStore) FailIndexingJob(
	ctx context.Context, documentID string, status string, lastError string,
) error {
	now := time.Now().UTC().Format(time.RFC3339)
	_, err := s.db.ExecContext(ctx, `
		UPDATE indexing_jobs
		SET status = ?, attempts = attempts + 1, last_error = ?, updated_at = ?,
		    lease_owner = '', lease_expires_at = ''
		WHERE document_id = ?`,
		status, lastError, now, documentID,
	)
	if err != nil {
		return fmt.Errorf("fail indexing job: %w", err)
	}
	return nil
}

func (s *SQLiteStore) ListIndexingJobs(
	ctx context.Context, filter IndexingJobFilter,
) ([]*IndexingJob, error) {
	query := `
		SELECT document_id, did, collection, rkey, cid, record_json, source,
		       attempts, status, COALESCE(last_error, ''), scheduled_at, updated_at,
		       COALESCE(lease_owner, ''), COALESCE(lease_expires_at, ''),
		       COALESCE(completed_at, '')
		FROM indexing_jobs
		WHERE 1 = 1`
	args := []any{}

	if filter.DocumentID != "" {
		query += " AND document_id = ?"
		args = append(args, filter.DocumentID)
	}
	if filter.Status != "" {
		query += " AND status = ?"
		args = append(args, filter.Status)
	}
	if filter.Source != "" {
		query += " AND source = ?"
		args = append(args, filter.Source)
	}

	query += " ORDER BY updated_at DESC"
	limit := filter.Limit
	if limit <= 0 {
		limit = 50
	}
	query += " LIMIT ?"
	args = append(args, limit)
	if filter.Offset > 0 {
		query += " OFFSET ?"
		args = append(args, filter.Offset)
	}

	rows, err := s.db.QueryContext(ctx, query, args...)
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

func (s *SQLiteStore) GetIndexingJobStats(ctx context.Context) (*IndexingJobStats, error) {
	row := s.db.QueryRowContext(ctx, `
		SELECT
			COUNT(*) FILTER (WHERE status = ?),
			COUNT(*) FILTER (WHERE status = ?),
			COUNT(*) FILTER (WHERE status = ?),
			COUNT(*) FILTER (WHERE status = ?),
			COUNT(*) FILTER (WHERE status = ?),
			COALESCE(MIN(CASE WHEN status = ? THEN scheduled_at END), ''),
			COALESCE(MIN(CASE WHEN status = ? THEN updated_at END), ''),
			COALESCE(MAX(completed_at), ''),
			COALESCE(MAX(updated_at), '')
		FROM indexing_jobs`,
		IndexingJobPending, IndexingJobProcessing, IndexingJobCompleted,
		IndexingJobFailed, IndexingJobDeadLetter, IndexingJobPending,
		IndexingJobProcessing,
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

func scanIndexingJob(scanner interface {
	Scan(dest ...any) error
}) (*IndexingJob, error) {
	job := &IndexingJob{}
	err := scanner.Scan(
		&job.DocumentID, &job.DID, &job.Collection, &job.RKey, &job.CID,
		&job.RecordJSON, &job.Source, &job.Attempts, &job.Status,
		&job.LastError, &job.ScheduledAt, &job.UpdatedAt, &job.LeaseOwner,
		&job.LeaseUntil, &job.CompletedAt,
	)
	if err != nil {
		return nil, err
	}
	return job, nil
}
