package store

import (
	"context"
	"fmt"
	"time"
)

func (s *SQLiteStore) AppendIndexingAudit(ctx context.Context, input IndexingAuditInput) error {
	now := time.Now().UTC().Format(time.RFC3339)
	_, err := s.db.ExecContext(ctx, `
		INSERT INTO indexing_audit (
			source, document_id, collection, cid, decision, attempt, error, created_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		input.Source, input.DocumentID, input.Collection, input.CID,
		input.Decision, input.Attempt, nullableStr(input.Error), now,
	)
	if err != nil {
		return fmt.Errorf("append indexing audit: %w", err)
	}
	return nil
}

func (s *SQLiteStore) ListIndexingAudit(
	ctx context.Context, filter IndexingAuditFilter,
) ([]*IndexingAuditEntry, error) {
	query := `
		SELECT id, source, document_id, collection, cid, decision,
		       attempt, COALESCE(error, ''), created_at
		FROM indexing_audit
		WHERE 1 = 1`
	args := []any{}

	if filter.DocumentID != "" {
		query += " AND document_id = ?"
		args = append(args, filter.DocumentID)
	}
	if filter.Source != "" {
		query += " AND source = ?"
		args = append(args, filter.Source)
	}
	if filter.Decision != "" {
		query += " AND decision = ?"
		args = append(args, filter.Decision)
	}

	query += " ORDER BY created_at DESC"
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
