package search

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
)

type PostgresRepository struct {
	db *sql.DB
}

type pgSearchArgs struct {
	args []any
}

func newPGSearchArgs(initial ...any) *pgSearchArgs {
	return &pgSearchArgs{args: append([]any{}, initial...)}
}

func (p *pgSearchArgs) Add(value any) string {
	p.args = append(p.args, value)
	return fmt.Sprintf("$%d", len(p.args))
}

func (p *pgSearchArgs) Values() []any {
	return p.args
}

func (r *PostgresRepository) Ping(ctx context.Context) error {
	return r.db.PingContext(ctx)
}

func (r *PostgresRepository) Keyword(ctx context.Context, p Params) (*Response, error) {
	args := newPGSearchArgs(p.Query)
	where := []string{"d.search_vector @@ query.q", "d.deleted_at IS NULL"}
	joins := []string{
		"LEFT JOIN identity_handles repo_owner ON repo_owner.did = d.repo_did AND repo_owner.is_active = TRUE",
	}

	if p.Collection != "" {
		where = append(where, "d.collection = "+args.Add(p.Collection))
	}
	if p.Type != "" {
		where = append(where, "d.record_type = "+args.Add(p.Type))
	}
	if p.Author != "" {
		placeholder := args.Add(p.Author)
		where = append(where, fmt.Sprintf("(d.author_handle = %s OR d.did = %s)", placeholder, args.Add(p.Author)))
	}
	if p.Repo != "" {
		placeholder := args.Add(p.Repo)
		where = append(where, fmt.Sprintf("(d.repo_name = %s OR d.repo_did = %s)", placeholder, args.Add(p.Repo)))
	}
	if p.Language != "" {
		where = append(where, "d.language = "+args.Add(p.Language))
	}
	if p.From != "" {
		where = append(where, "d.created_at >= "+args.Add(p.From))
	}
	if p.To != "" {
		where = append(where, "d.created_at <= "+args.Add(p.To))
	}
	if p.State != "" {
		joins = append(joins, "JOIN record_state rs ON rs.subject_uri = d.at_uri")
		where = append(where, "rs.state = "+args.Add(p.State))
	}

	baseQuery := `
		WITH query AS (
			SELECT websearch_to_tsquery('simple', $1) AS q
		)`
	fromClause := `
		FROM documents d
		CROSS JOIN query
		` + strings.Join(joins, "\n")
	whereClause := " WHERE " + strings.Join(where, " AND ")

	countSQL := baseQuery + `
		SELECT COUNT(*)
	` + fromClause + whereClause

	var total int
	if err := r.db.QueryRowContext(ctx, countSQL, args.Values()...).Scan(&total); err != nil {
		return nil, fmt.Errorf("count: %w", err)
	}

	limitPlaceholder := args.Add(p.Limit)
	offsetPlaceholder := args.Add(p.Offset)

	resultsSQL := baseQuery + `
		SELECT d.id, d.title, d.summary, d.repo_name, repo_owner.handle, d.author_handle,
		       d.did, d.at_uri, d.web_url, d.collection, d.record_type, d.created_at, d.updated_at,
		       ts_rank_cd(d.search_vector, query.q) AS score,
		       ts_headline(
		       	'simple',
		       	COALESCE(NULLIF(d.body, ''), COALESCE(d.summary, '')),
		       	query.q,
		       	'StartSel=<mark>, StopSel=</mark>, MaxWords=20, MinWords=10, MaxFragments=2, FragmentDelimiter= ... '
		       ) AS body_snippet
	` + fromClause + whereClause + `
		ORDER BY score DESC, d.updated_at DESC
		LIMIT ` + limitPlaceholder + ` OFFSET ` + offsetPlaceholder

	rows, err := r.db.QueryContext(ctx, resultsSQL, args.Values()...)
	if err != nil {
		return nil, fmt.Errorf("search: %w", err)
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

func scanResult(scanner interface {
	Scan(dest ...any) error
}) (*Result, error) {
	var res Result
	var title, summary, repoName, repoOwnerHandle, authorHandle sql.NullString
	var webURL, createdAt, updatedAt sql.NullString
	var bodySnippet sql.NullString

	if err := scanner.Scan(
		&res.ID, &title, &summary, &repoName, &repoOwnerHandle, &authorHandle,
		&res.DID, &res.ATURI, &webURL, &res.Collection, &res.RecordType,
		&createdAt, &updatedAt, &res.Score, &bodySnippet,
	); err != nil {
		return nil, fmt.Errorf("scan: %w", err)
	}
	res.Title = title.String
	res.Summary = summary.String
	res.RepoName = repoName.String
	res.RepoOwnerHandle = repoOwnerHandle.String
	res.AuthorHandle = authorHandle.String
	res.WebURL = webURL.String
	res.BodySnippet = bodySnippet.String
	res.CreatedAt = createdAt.String
	res.UpdatedAt = updatedAt.String
	res.MatchedBy = []string{"keyword"}
	return &res, nil
}
