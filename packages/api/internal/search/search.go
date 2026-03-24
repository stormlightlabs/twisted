package search

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
)

// Params holds validated search query parameters.
type Params struct {
	Query      string
	Limit      int
	Offset     int
	Collection string
	Type       string
	Author     string
	Repo       string
	Language   string
	From       string
	To         string
	State      string
}

// Result is a single search hit.
type Result struct {
	ID           string   `json:"id"`
	Collection   string   `json:"collection"`
	RecordType   string   `json:"record_type"`
	Title        string   `json:"title"`
	BodySnippet  string   `json:"body_snippet,omitempty"`
	Summary      string   `json:"summary,omitempty"`
	RepoName     string   `json:"repo_name,omitempty"`
	RepoOwnerHandle string `json:"repo_owner_handle,omitempty"`
	AuthorHandle string   `json:"author_handle,omitempty"`
	DID          string   `json:"did"`
	ATURI        string   `json:"at_uri"`
	Score        float64  `json:"score"`
	MatchedBy    []string `json:"matched_by"`
	CreatedAt    string   `json:"created_at,omitempty"`
	UpdatedAt    string   `json:"updated_at,omitempty"`
}

// Response is the search API response envelope.
type Response struct {
	Query   string   `json:"query"`
	Mode    string   `json:"mode"`
	Total   int      `json:"total"`
	Limit   int      `json:"limit"`
	Offset  int      `json:"offset"`
	Results []Result `json:"results"`
}

// Repository executes search queries against the database.
type Repository struct {
	db *sql.DB
}

// NewRepository creates a search repository backed by the given database.
func NewRepository(db *sql.DB) *Repository {
	return &Repository{db: db}
}

// Ping checks database connectivity.
func (r *Repository) Ping(ctx context.Context) error {
	return r.db.PingContext(ctx)
}

// Keyword runs a full-text keyword search.
func (r *Repository) Keyword(ctx context.Context, p Params) (*Response, error) {
	ftsQuery := toFTS5Query(p.Query)

	// Build filter conditions beyond the base FTS match.
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

	// State filter requires a JOIN.
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

	// Count total matching documents.
	countSQL := fmt.Sprintf("SELECT COUNT(*) FROM documents_fts JOIN documents d ON d.id = documents_fts.id %s WHERE %s", join, where)
	countArgs := append([]any{ftsQuery}, filterArgs...)

	var total int
	if err := r.db.QueryRowContext(ctx, countSQL, countArgs...).Scan(&total); err != nil {
		return nil, explainNativeFTSError("count", err)
	}

	// Fetch results with score and snippet.
	resultsSQL := fmt.Sprintf(`
		SELECT d.id, d.title, d.summary, d.repo_name, repo_owner.handle, d.author_handle,
		       d.did, d.at_uri, d.collection, d.record_type, d.created_at, d.updated_at,
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
		return nil, explainNativeFTSError("search", err)
	}
	defer rows.Close()

	results := make([]Result, 0)
	for rows.Next() {
		var res Result
		var title, summary, repoName, repoOwnerHandle, authorHandle sql.NullString
		var createdAt, updatedAt sql.NullString
		var bodySnippet sql.NullString

		if err := rows.Scan(
			&res.ID, &title, &summary, &repoName, &repoOwnerHandle, &authorHandle,
			&res.DID, &res.ATURI, &res.Collection, &res.RecordType,
			&createdAt, &updatedAt, &res.Score, &bodySnippet,
		); err != nil {
			return nil, fmt.Errorf("scan: %w", err)
		}
		res.Title = title.String
		res.Summary = summary.String
		res.RepoName = repoName.String
		res.RepoOwnerHandle = repoOwnerHandle.String
		res.AuthorHandle = authorHandle.String
		res.BodySnippet = bodySnippet.String
		res.CreatedAt = createdAt.String
		res.UpdatedAt = updatedAt.String
		res.MatchedBy = []string{"keyword"}
		results = append(results, res)
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

func explainNativeFTSError(op string, err error) error {
	msg := err.Error()
	if strings.Contains(msg, "no such table: documents_fts") ||
		strings.Contains(msg, "no such module: fts5") {
		return fmt.Errorf("%s: SQLite FTS5 is unavailable on this database; ensure the FTS5 migration succeeded and that Turso SQLite extensions are enabled for this database/group: %w", op, err)
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
