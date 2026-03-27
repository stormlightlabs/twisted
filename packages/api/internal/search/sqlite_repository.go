package search

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
)

type SQLiteRepository struct {
	db *sql.DB
}

func (r *SQLiteRepository) Ping(ctx context.Context) error {
	return r.db.PingContext(ctx)
}

func (r *SQLiteRepository) Keyword(ctx context.Context, p Params) (*Response, error) {
	ftsQuery := toFTS5Query(p.Query)

	var filters []string
	var filterArgs []any

	if p.Collection != "" {
		filters = append(filters, "d.collection = ?")
		filterArgs = append(filterArgs, p.Collection)
	}
	if p.Type != "" {
		filters = append(filters, "d.record_type = ?")
		filterArgs = append(filterArgs, p.Type)
	}
	if p.Author != "" {
		filters = append(filters, "(d.author_handle = ? OR d.did = ?)")
		filterArgs = append(filterArgs, p.Author, p.Author)
	}
	if p.Repo != "" {
		filters = append(filters, "(d.repo_name = ? OR d.repo_did = ?)")
		filterArgs = append(filterArgs, p.Repo, p.Repo)
	}
	if p.Language != "" {
		filters = append(filters, "d.language = ?")
		filterArgs = append(filterArgs, p.Language)
	}
	if p.From != "" {
		filters = append(filters, "d.created_at >= ?")
		filterArgs = append(filterArgs, p.From)
	}
	if p.To != "" {
		filters = append(filters, "d.created_at <= ?")
		filterArgs = append(filterArgs, p.To)
	}

	var join string
	if p.State != "" {
		join = "JOIN record_state rs ON rs.subject_uri = d.at_uri"
		filters = append(filters, "rs.state = ?")
		filterArgs = append(filterArgs, p.State)
	}

	where := "documents_fts MATCH ? AND d.deleted_at IS NULL"
	if len(filters) > 0 {
		where += " AND " + strings.Join(filters, " AND ")
	}

	countSQL := fmt.Sprintf(
		"SELECT COUNT(*) FROM documents_fts JOIN documents d ON d.id = documents_fts.id %s WHERE %s",
		join, where,
	)
	countArgs := append([]any{ftsQuery}, filterArgs...)

	var total int
	if err := r.db.QueryRowContext(ctx, countSQL, countArgs...).Scan(&total); err != nil {
		return nil, explainSQLiteSearchError("count", err)
	}

	resultsSQL := fmt.Sprintf(`
		SELECT d.id, d.title, d.summary, d.repo_name, repo_owner.handle, d.author_handle,
		       d.did, d.at_uri, d.web_url, d.collection, d.record_type, d.created_at, d.updated_at,
		       -bm25(documents_fts, 0.0, 3.0, 1.0, 1.5, 2.5, 2.0, 1.2) AS score,
		       snippet(documents_fts, 2, '<mark>', '</mark>', '...', 20) AS body_snippet
		FROM documents_fts
		JOIN documents d ON d.id = documents_fts.id
		LEFT JOIN identity_handles repo_owner ON repo_owner.did = d.repo_did AND repo_owner.is_active = 1
		%s
		WHERE %s
		ORDER BY score DESC
		LIMIT ? OFFSET ?`, join, where)

	resultsArgs := make([]any, 0, 1+len(filterArgs)+2)
	resultsArgs = append(resultsArgs, ftsQuery)
	resultsArgs = append(resultsArgs, filterArgs...)
	resultsArgs = append(resultsArgs, p.Limit, p.Offset)

	rows, err := r.db.QueryContext(ctx, resultsSQL, resultsArgs...)
	if err != nil {
		return nil, explainSQLiteSearchError("search", err)
	}
	defer rows.Close()

	results := make([]Result, 0)
	for rows.Next() {
		res, err := scanResult(rows)
		if err != nil {
			return nil, err
		}
		results = append(results, *res)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("rows: %w", err)
	}

	return &Response{
		Query:   p.Query,
		Mode:    "keyword",
		Total:   total,
		Limit:   p.Limit,
		Offset:  p.Offset,
		Results: results,
	}, nil
}

func explainSQLiteSearchError(op string, err error) error {
	msg := err.Error()
	if strings.Contains(msg, "no such table: documents_fts") ||
		strings.Contains(msg, "no such module: fts5") {
		return fmt.Errorf("%s: SQLite FTS5 is unavailable on this database: %w", op, err)
	}
	return fmt.Errorf("%s: %w", op, err)
}

func toFTS5Query(raw string) string {
	parts := strings.Fields(raw)
	if len(parts) == 0 {
		return `""`
	}

	quoted := make([]string, 0, len(parts))
	for _, part := range parts {
		part = strings.ReplaceAll(part, `"`, `""`)
		quoted = append(quoted, `"`+part+`"`)
	}
	return strings.Join(quoted, " OR ")
}
