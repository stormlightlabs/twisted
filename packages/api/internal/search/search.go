package search

import (
	"context"
	"database/sql"
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
	ID              string   `json:"id"`
	Collection      string   `json:"collection"`
	RecordType      string   `json:"record_type"`
	Title           string   `json:"title"`
	BodySnippet     string   `json:"body_snippet,omitempty"`
	Summary         string   `json:"summary,omitempty"`
	RepoName        string   `json:"repo_name,omitempty"`
	RepoOwnerHandle string   `json:"repo_owner_handle,omitempty"`
	AuthorHandle    string   `json:"author_handle,omitempty"`
	DID             string   `json:"did"`
	ATURI           string   `json:"at_uri"`
	WebURL          string   `json:"web_url,omitempty"`
	Score           float64  `json:"score"`
	MatchedBy       []string `json:"matched_by"`
	StarCount       *int     `json:"star_count,omitempty"`
	CreatedAt       string   `json:"created_at,omitempty"`
	UpdatedAt       string   `json:"updated_at,omitempty"`
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
type Repository interface {
	Ping(ctx context.Context) error
	Keyword(ctx context.Context, p Params) (*Response, error)
}

func NewRepository(url string, db *sql.DB) Repository {
	if strings.HasPrefix(url, "file:") {
		return &SQLiteRepository{db: db}
	}
	return &PostgresRepository{db: db}
}
