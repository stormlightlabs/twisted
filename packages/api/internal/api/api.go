package api

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"tangled.org/desertthunder.dev/twister/internal/config"
	"tangled.org/desertthunder.dev/twister/internal/constellation"
	"tangled.org/desertthunder.dev/twister/internal/reindex"
	"tangled.org/desertthunder.dev/twister/internal/search"
	"tangled.org/desertthunder.dev/twister/internal/store"
	"tangled.org/desertthunder.dev/twister/internal/view"
	"tangled.org/desertthunder.dev/twister/internal/xrpc"
)

// Server is the HTTP search API server.
type Server struct {
	search        *search.Repository
	store         store.Store
	cfg           *config.Config
	log           *slog.Logger
	constellation *constellation.Client
	xrpc          *xrpc.Client
}

// New creates a new API server.
func New(searchRepo *search.Repository, st store.Store, cfg *config.Config, log *slog.Logger, constellation *constellation.Client, xrpcClient *xrpc.Client) *Server {
	return &Server{
		search:        searchRepo,
		store:         st,
		cfg:           cfg,
		log:           log,
		constellation: constellation,
		xrpc:          xrpcClient,
	}
}

// Handler returns the HTTP handler with all routes registered.
func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()

	mux.HandleFunc("GET /healthz", s.handleHealthz)
	mux.HandleFunc("GET /readyz", s.handleReadyz)
	mux.HandleFunc("GET /oauth/client-metadata.json", s.handleOAuthClientMetadata)
	mux.HandleFunc("GET /search", s.handleSearch)
	mux.HandleFunc("GET /search/keyword", s.handleSearchKeyword)
	mux.HandleFunc("GET /search/semantic", s.handleNotImplemented)
	mux.HandleFunc("GET /search/hybrid", s.handleNotImplemented)

	mux.HandleFunc("GET /documents/{id}", s.handleGetDocument)
	mux.HandleFunc("GET /profiles/{did}/summary", s.handleProfileSummary)

	mux.HandleFunc("GET /backlinks/count", s.handleBacklinksCount)
	mux.HandleFunc("GET /activity/stream", s.handleActivityStream)
	mux.HandleFunc("GET /identity/resolve", s.handleResolveHandle)
	mux.HandleFunc("GET /identity/did/{did}", s.handleDidDocument)
	mux.HandleFunc("GET /xrpc/knot/{knotHost}/{nsid}", s.handleKnotProxy)
	mux.HandleFunc("GET /xrpc/pds/{pds}/{nsid}", s.handlePdsProxy)
	mux.HandleFunc("GET /xrpc/bsky/{nsid}", s.handleBskyProxy)

	mux.HandleFunc("GET /actors/{handle}", s.handleGetActor)
	mux.HandleFunc("GET /actors/{handle}/repos", s.handleListActorRepos)
	mux.HandleFunc("GET /actors/{handle}/repos/{repo}", s.handleGetActorRepo)
	mux.HandleFunc("GET /actors/{handle}/repos/{repo}/tree", s.handleRepoTree)
	mux.HandleFunc("GET /actors/{handle}/repos/{repo}/blob", s.handleRepoBlob)
	mux.HandleFunc("GET /actors/{handle}/repos/{repo}/log", s.handleRepoLog)
	mux.HandleFunc("GET /actors/{handle}/repos/{repo}/branches", s.handleRepoBranches)
	mux.HandleFunc("GET /actors/{handle}/repos/{repo}/default-branch", s.handleRepoDefaultBranch)
	mux.HandleFunc("GET /actors/{handle}/repos/{repo}/languages", s.handleRepoLanguages)
	mux.HandleFunc("GET /actors/{handle}/repos/{repo}/tags", s.handleRepoTags)
	mux.HandleFunc("GET /actors/{handle}/repos/{repo}/diff", s.handleRepoDiff)
	mux.HandleFunc("GET /actors/{handle}/repos/{repo}/compare", s.handleRepoCompare)
	mux.HandleFunc("GET /actors/{handle}/repos/{repo}/issues", s.handleRepoIssues)
	mux.HandleFunc("GET /actors/{handle}/repos/{repo}/pulls", s.handleRepoPulls)
	mux.HandleFunc("GET /actors/{handle}/issues", s.handleActorIssues)
	mux.HandleFunc("GET /actors/{handle}/pulls", s.handleActorPulls)
	mux.HandleFunc("GET /actors/{handle}/following", s.handleActorFollowing)
	mux.HandleFunc("GET /actors/{handle}/strings", s.handleActorStrings)
	mux.HandleFunc("GET /issues/{handle}/{rkey}", s.handleIssueDetail)
	mux.HandleFunc("GET /issues/{handle}/{rkey}/comments", s.handleIssueComments)
	mux.HandleFunc("GET /pulls/{handle}/{rkey}", s.handlePullDetail)
	mux.HandleFunc("GET /pulls/{handle}/{rkey}/comments", s.handlePullComments)

	if s.cfg.EnableAdminEndpoints {
		mux.HandleFunc("POST /admin/reindex", s.handleAdminReindex)
		mux.HandleFunc("POST /admin/reembed", s.handleNotImplemented)
	}

	site := view.Handler()
	mux.Handle("GET /static/", site)
	mux.Handle("GET /docs", site)
	mux.Handle("GET /docs/search", site)
	mux.Handle("GET /docs/documents", site)
	mux.Handle("GET /docs/health", site)
	mux.Handle("GET /{$}", site)

	return s.withMiddleware(mux)
}

// Run starts the HTTP server and blocks until ctx is cancelled.
func (s *Server) Run(ctx context.Context) error {
	srv := &http.Server{
		Addr:              s.cfg.HTTPBindAddr,
		Handler:           s.Handler(),
		ReadHeaderTimeout: 10 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	errCh := make(chan error, 1)
	go func() {
		s.log.Info("listening", slog.String("addr", s.cfg.HTTPBindAddr))
		errCh <- srv.ListenAndServe()
	}()

	select {
	case err := <-errCh:
		return err
	case <-ctx.Done():
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		return srv.Shutdown(shutdownCtx)
	}
}

func (s *Server) withMiddleware(next http.Handler) http.Handler {
	return s.corsMiddleware(s.loggingMiddleware(next))
}

func (s *Server) loggingMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		rw := &responseWriter{ResponseWriter: w, status: 200}
		next.ServeHTTP(rw, r)
		s.log.Info("request",
			slog.String("method", r.Method),
			slog.String("path", r.URL.Path),
			slog.String("query", r.URL.RawQuery),
			slog.Int("status", rw.status),
			slog.Int64("duration_ms", time.Since(start).Milliseconds()),
		)
	})
}

func (s *Server) corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

type responseWriter struct {
	http.ResponseWriter
	status int
}

func (rw *responseWriter) WriteHeader(code int) {
	rw.status = code
	rw.ResponseWriter.WriteHeader(code)
}

func (s *Server) handleHealthz(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (s *Server) handleReadyz(w http.ResponseWriter, r *http.Request) {
	if err := s.search.Ping(r.Context()); err != nil {
		s.log.Error("readyz: db unreachable", slog.String("error", err.Error()))
		writeJSON(w, http.StatusServiceUnavailable, errorBody("db_unreachable", "database is not reachable"))
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ready"})
}

// knownSearchParams is the whitelist of accepted query parameters for search endpoints.
var knownSearchParams = map[string]bool{
	"q": true, "mode": true, "limit": true, "offset": true,
	"collection": true, "type": true, "author": true, "repo": true,
	"language": true, "from": true, "to": true, "state": true,
}

func (s *Server) handleSearch(w http.ResponseWriter, r *http.Request) {
	mode := r.URL.Query().Get("mode")
	if mode == "" {
		mode = s.cfg.SearchDefaultMode
	}
	switch mode {
	case "keyword":
		s.handleSearchKeyword(w, r)
	case "semantic", "hybrid":
		s.handleNotImplemented(w, r)
	default:
		writeJSON(w, http.StatusBadRequest, errorBody("invalid_parameter", "mode must be keyword, semantic, or hybrid"))
	}
}

func (s *Server) handleSearchKeyword(w http.ResponseWriter, r *http.Request) {
	for key := range r.URL.Query() {
		if !knownSearchParams[key] {
			writeJSON(w, http.StatusBadRequest, errorBody("unknown_parameter", fmt.Sprintf("unknown parameter: %s", key)))
			return
		}
	}

	q := r.URL.Query().Get("q")
	if q == "" {
		writeJSON(w, http.StatusBadRequest, errorBody("invalid_parameter", "q is required"))
		return
	}

	limit, err := intParam(r, "limit", s.cfg.SearchDefaultLimit)
	if err != nil || limit < 1 || limit > s.cfg.SearchMaxLimit {
		writeJSON(w, http.StatusBadRequest, errorBody("invalid_parameter", fmt.Sprintf("limit must be between 1 and %d", s.cfg.SearchMaxLimit)))
		return
	}

	offset, err := intParam(r, "offset", 0)
	if err != nil || offset < 0 {
		writeJSON(w, http.StatusBadRequest, errorBody("invalid_parameter", "offset must be >= 0"))
		return
	}

	params := search.Params{
		Query:      q,
		Limit:      limit,
		Offset:     offset,
		Collection: r.URL.Query().Get("collection"),
		Type:       r.URL.Query().Get("type"),
		Author:     r.URL.Query().Get("author"),
		Repo:       r.URL.Query().Get("repo"),
		Language:   r.URL.Query().Get("language"),
		From:       r.URL.Query().Get("from"),
		To:         r.URL.Query().Get("to"),
		State:      r.URL.Query().Get("state"),
	}

	resp, err := s.search.Keyword(r.Context(), params)
	if err != nil {
		s.log.Error("search failed", slog.String("error", err.Error()), slog.String("query", q))
		writeJSON(w, http.StatusInternalServerError, errorBody("search_error", "search failed"))
		return
	}

	if s.constellation != nil {
		s.enrichStarCounts(r.Context(), resp.Results)
	}

	writeJSON(w, http.StatusOK, resp)
}

func (s *Server) handleGetDocument(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		writeJSON(w, http.StatusBadRequest, errorBody("invalid_parameter", "document id is required"))
		return
	}

	doc, err := s.store.GetDocument(r.Context(), id)
	if err != nil {
		s.log.Error("get document failed", slog.String("error", err.Error()), slog.String("id", id))
		writeJSON(w, http.StatusInternalServerError, errorBody("db_error", "failed to fetch document"))
		return
	}
	if doc == nil {
		writeJSON(w, http.StatusNotFound, errorBody("not_found", "document not found"))
		return
	}
	if doc.DeletedAt != "" {
		writeJSON(w, http.StatusNotFound, errorBody("not_found", "document not found"))
		return
	}

	writeJSON(w, http.StatusOK, documentResponse(doc))
}

func (s *Server) handleAdminReindex(w http.ResponseWriter, r *http.Request) {
	if s.cfg.AdminAuthToken != "" {
		token := strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")
		if token != s.cfg.AdminAuthToken {
			writeJSON(w, http.StatusUnauthorized, errorBody("unauthorized", "invalid admin token"))
			return
		}
	}

	opts := reindex.Options{
		Collection: r.URL.Query().Get("collection"),
		DID:        r.URL.Query().Get("did"),
		DocumentID: r.URL.Query().Get("document"),
	}

	runner := reindex.New(s.store, s.log)
	result, err := runner.Run(r.Context(), opts)
	if err != nil {
		s.log.Error("admin reindex failed", slog.String("error", err.Error()))
		if result != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]any{
				"error":   "reindex_error",
				"message": err.Error(),
				"total":   result.Total,
				"updated": result.Updated,
				"errors":  result.Errors,
			})
		} else {
			writeJSON(w, http.StatusInternalServerError, errorBody("reindex_error", err.Error()))
		}
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"status":  "ok",
		"total":   result.Total,
		"updated": result.Updated,
		"errors":  result.Errors,
	})
}

// enrichStarCounts fetches star counts from Constellation for repo results in parallel.
// It is best-effort: failures are logged and results are returned without star counts.
//
// Uses a short deadline so enrichment doesn't stall the response.
func (s *Server) enrichStarCounts(ctx context.Context, results []search.Result) {
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	var wg sync.WaitGroup
	for i := range results {
		if results[i].RecordType != "repo" || results[i].ATURI == "" {
			continue
		}
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			n, err := s.constellation.GetBacklinksCount(ctx, constellation.BacklinksParams{
				Subject: results[i].ATURI,
				Source:  constellation.SourceStarURI,
			})
			if err != nil {
				s.log.Debug("constellation star count failed", slog.String("at_uri", results[i].ATURI), slog.String("error", err.Error()))
				return
			}
			results[i].StarCount = &n
		}(i)
	}
	wg.Wait()
}

// handleProfileSummary returns follower count and other social signals for a DID.
func (s *Server) handleProfileSummary(w http.ResponseWriter, r *http.Request) {
	did := r.PathValue("did")
	if did == "" {
		writeJSON(w, http.StatusBadRequest, errorBody("invalid_parameter", "did is required"))
		return
	}

	type summaryResponse struct {
		DID           string `json:"did"`
		FollowerCount int    `json:"follower_count"`
	}

	summary := summaryResponse{DID: did}

	if s.constellation != nil {
		n, err := s.constellation.GetBacklinksCount(r.Context(), constellation.BacklinksParams{
			Subject: did,
			Source:  constellation.SourceFollowDID,
		})
		if err != nil {
			s.log.Debug("constellation follower count failed", slog.String("did", did), slog.String("error", err.Error()))
		} else {
			summary.FollowerCount = n
		}
	}

	writeJSON(w, http.StatusOK, summary)
}

func (s *Server) handleNotImplemented(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusNotImplemented, errorBody("not_implemented", "this endpoint is not yet available"))
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func errorBody(code, message string) map[string]string {
	return map[string]string{"error": code, "message": message}
}

func intParam(r *http.Request, key string, def int) (int, error) {
	v := r.URL.Query().Get(key)
	if v == "" {
		return def, nil
	}
	n, err := strconv.Atoi(v)
	if err != nil {
		return 0, err
	}
	return n, nil
}

type documentJSON struct {
	ID           string `json:"id"`
	DID          string `json:"did"`
	Collection   string `json:"collection"`
	RKey         string `json:"rkey"`
	ATURI        string `json:"at_uri"`
	CID          string `json:"cid"`
	RecordType   string `json:"record_type"`
	Title        string `json:"title"`
	Body         string `json:"body"`
	Summary      string `json:"summary,omitempty"`
	RepoName     string `json:"repo_name,omitempty"`
	AuthorHandle string `json:"author_handle,omitempty"`
	TagsJSON     string `json:"tags_json,omitempty"`
	Language     string `json:"language,omitempty"`
	WebURL       string `json:"web_url,omitempty"`
	CreatedAt    string `json:"created_at,omitempty"`
	UpdatedAt    string `json:"updated_at,omitempty"`
	IndexedAt    string `json:"indexed_at"`
}

func documentResponse(doc *store.Document) documentJSON {
	return documentJSON{
		ID:           doc.ID,
		DID:          doc.DID,
		Collection:   doc.Collection,
		RKey:         doc.RKey,
		ATURI:        doc.ATURI,
		CID:          doc.CID,
		RecordType:   doc.RecordType,
		Title:        doc.Title,
		Body:         doc.Body,
		Summary:      doc.Summary,
		RepoName:     doc.RepoName,
		AuthorHandle: doc.AuthorHandle,
		TagsJSON:     doc.TagsJSON,
		Language:     doc.Language,
		WebURL:       doc.WebURL,
		CreatedAt:    doc.CreatedAt,
		UpdatedAt:    doc.UpdatedAt,
		IndexedAt:    doc.IndexedAt,
	}
}
