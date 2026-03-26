package api

import (
	"net/http"

	"tangled.org/desertthunder.dev/twister/internal/view"
)

func (s *Server) router() http.Handler {
	mux := http.NewServeMux()

	mux.HandleFunc("GET /healthz", s.handleHealthz)
	mux.HandleFunc("GET /readyz", s.handleReadyz)
	mux.HandleFunc("GET /oauth/client-metadata.json", s.handleOAuthClientMetadata)

	mux.HandleFunc("GET /documents/{id}", s.handleGetDocument)
	mux.HandleFunc("GET /profiles/{did}/summary", s.handleProfileSummary)
	mux.HandleFunc("GET /backlinks/count", s.handleBacklinksCount)

	s.registerSearchRoutes(mux)
	s.registerActivityRoutes(mux)
	s.registerIdentityRoutes(mux)
	s.registerXRPCRoutes(mux)
	s.registerActorRoutes(mux)
	s.registerIssueRoutes(mux)
	s.registerPullRoutes(mux)
	s.registerAdminRoutes(mux)
	s.registerSiteRoutes(mux)

	return s.withMiddleware(mux)
}

func (s *Server) registerSearchRoutes(mux *http.ServeMux) {
	mux.HandleFunc("GET /search", s.handleSearch)
	mux.HandleFunc("GET /search/keyword", s.handleSearchKeyword)
}

func (s *Server) registerActivityRoutes(mux *http.ServeMux) {
	mux.HandleFunc("GET /activity", s.handleActivity)
	mux.HandleFunc("GET /activity/stream", s.handleActivityStream)
}

func (s *Server) registerIdentityRoutes(mux *http.ServeMux) {
	mux.HandleFunc("GET /identity/resolve", s.handleResolveHandle)
	mux.HandleFunc("GET /identity/did/{did}", s.handleDidDocument)
}

func (s *Server) registerXRPCRoutes(mux *http.ServeMux) {
	mux.HandleFunc("GET /xrpc/knot/{knotHost}/{nsid}", s.handleKnotProxy)
	mux.HandleFunc("GET /xrpc/pds/{pds}/{nsid}", s.handlePdsProxy)
	mux.HandleFunc("GET /xrpc/bsky/{nsid}", s.handleBskyProxy)
}

func (s *Server) registerActorRepoRoutes(mux *http.ServeMux) {
	const base = "GET /actors/{handle}/repos/{repo}"

	mux.HandleFunc(base, s.handleGetActorRepo)
	mux.HandleFunc(base+"/tree", s.handleRepoTree)
	mux.HandleFunc(base+"/blob", s.handleRepoBlob)
	mux.HandleFunc(base+"/log", s.handleRepoLog)
	mux.HandleFunc(base+"/branches", s.handleRepoBranches)
	mux.HandleFunc(base+"/default-branch", s.handleRepoDefaultBranch)
	mux.HandleFunc(base+"/languages", s.handleRepoLanguages)
	mux.HandleFunc(base+"/tags", s.handleRepoTags)
	mux.HandleFunc(base+"/diff", s.handleRepoDiff)
	mux.HandleFunc(base+"/compare", s.handleRepoCompare)
	mux.HandleFunc(base+"/issues", s.handleRepoIssues)
	mux.HandleFunc(base+"/pulls", s.handleRepoPulls)
}

func (s *Server) registerActorRoutes(mux *http.ServeMux) {
	mux.HandleFunc("GET /actors/{handle}", s.handleGetActor)
	mux.HandleFunc("GET /actors/{handle}/repos", s.handleListActorRepos)
	mux.HandleFunc("GET /actors/{handle}/issues", s.handleActorIssues)
	mux.HandleFunc("GET /actors/{handle}/pulls", s.handleActorPulls)
	mux.HandleFunc("GET /actors/{handle}/following", s.handleActorFollowing)
	mux.HandleFunc("GET /actors/{handle}/strings", s.handleActorStrings)

	s.registerActorRepoRoutes(mux)
}

func (s *Server) registerIssueRoutes(mux *http.ServeMux) {
	const base = "GET /issues/{handle}/{rkey}"

	mux.HandleFunc(base, s.handleIssueDetail)
	mux.HandleFunc(base+"/comments", s.handleIssueComments)
}

func (s *Server) registerPullRoutes(mux *http.ServeMux) {
	const base = "GET /pulls/{handle}/{rkey}"

	mux.HandleFunc(base, s.handlePullDetail)
	mux.HandleFunc(base+"/comments", s.handlePullComments)
}

func (s *Server) registerAdminRoutes(mux *http.ServeMux) {
	if !s.cfg.EnableAdminEndpoints {
		return
	}
	mux.HandleFunc("GET /admin/status", s.handleAdminStatus)
	mux.HandleFunc("GET /admin/indexing/jobs", s.handleAdminIndexingJobs)
	mux.HandleFunc("GET /admin/indexing/audit", s.handleAdminIndexingAudit)
	mux.HandleFunc("POST /admin/indexing/enqueue", s.handleAdminIndexingEnqueue)
	mux.HandleFunc("POST /admin/reindex", s.handleAdminReindex)
}

func (s *Server) registerDocsRoutes(mux *http.ServeMux, h http.Handler) {
	for _, path := range []string{
		"GET /docs",
		"GET /docs/search",
		"GET /docs/documents",
		"GET /docs/health",
		"GET /docs/actors",
		"GET /docs/issues",
		"GET /docs/pulls",
		"GET /docs/identity",
		"GET /docs/activity",
		"GET /docs/profiles",
		"GET /docs/xrpc",
	} {
		mux.Handle(path, h)
	}
}

func (s *Server) registerSiteRoutes(mux *http.ServeMux) {
	site := view.Handler()
	mux.Handle("GET /static/", site)

	s.registerDocsRoutes(mux, site)

	mux.Handle("GET /{$}", site)
}
