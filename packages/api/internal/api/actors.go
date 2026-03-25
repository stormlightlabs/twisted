package api

import (
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/url"
	"strings"

	"tangled.org/desertthunder.dev/twister/internal/xrpc"
)

// recordEntry is the common shape for a single PDS record returned to the app.
type recordEntry struct {
	URI   string         `json:"uri"`
	CID   string         `json:"cid"`
	Value map[string]any `json:"value"`
}

// issueEntry extends recordEntry with pre-joined issue state.
type issueEntry struct {
	recordEntry
	State string `json:"state"` // "open" or "closed"
}

// pullEntry extends recordEntry with pre-joined pull status.
type pullEntry struct {
	recordEntry
	Status string `json:"status"` // "open", "merged", or "closed"
}

// actorContext holds resolved identity for a request.
type actorContext struct {
	DID    string `json:"did"`
	Handle string `json:"handle"`
	PDS    string `json:"pds"` // full URL, e.g. "https://bsky.social"
}

// repoContext extends actorContext with the repo's knot host and AT URI.
type repoContext struct {
	actorContext
	KnotHost string `json:"knot_host"`
	AtURI    string `json:"at_uri"`
	RepoName string `json:"repo_name"`
}

// resolveActor resolves a handle (or DID) to its DID, PDS, and canonical handle.
func (s *Server) resolveActor(r *http.Request, handleOrDID string) (*actorContext, error) {
	ctx := r.Context()

	var did string
	if strings.HasPrefix(handleOrDID, "did:") {
		did = handleOrDID
	} else {
		var err error
		did, err = s.xrpc.ResolveHandle(ctx, handleOrDID)
		if err != nil {
			return nil, fmt.Errorf("resolve handle %q: %w", handleOrDID, err)
		}
	}

	identity, err := s.xrpc.ResolveIdentity(ctx, did)
	if err != nil {
		return nil, fmt.Errorf("resolve identity %q: %w", did, err)
	}

	return &actorContext{
		DID:    identity.DID,
		Handle: identity.Handle,
		PDS:    identity.PDS,
	}, nil
}

// resolveRepo resolves a handle + repo name to actor + knot host + AT URI.
func (s *Server) resolveRepo(r *http.Request, handleOrDID, repoName string) (*repoContext, error) {
	actor, err := s.resolveActor(r, handleOrDID)
	if err != nil {
		return nil, err
	}

	entries, err := s.xrpc.ListAllRecords(r.Context(), actor.PDS, actor.DID, "sh.tangled.repo")
	if err != nil {
		return nil, fmt.Errorf("list repos for %s: %w", actor.DID, err)
	}
	s.enqueueXRPCList(r.Context(), entries)

	for _, entry := range entries {
		name, _ := entry.Value["name"].(string)
		if name == repoName {
			knot, _ := entry.Value["knot"].(string)
			return &repoContext{
				actorContext: *actor,
				KnotHost:     knot,
				AtURI:        entry.URI,
				RepoName:     repoName,
			}, nil
		}
	}

	return nil, &xrpc.NotFoundError{Message: fmt.Sprintf("repo %q not found for %s", repoName, handleOrDID)}
}

// knotCall makes a GET request to a knot's XRPC endpoint and streams the response body.
// The caller is responsible for closing the returned ReadCloser.
func (s *Server) knotCall(r *http.Request, knotHost, nsid string, params url.Values) (io.ReadCloser, string, error) {
	if knotHost == "" {
		return nil, "", fmt.Errorf("repo has no knot host")
	}
	knotURL := "https://" + knotHost
	body, err := s.xrpc.Call(r.Context(), knotURL, nsid, params)
	if err != nil {
		return nil, "", err
	}
	return body, knotURL, nil
}

// proxyKnotJSON calls a knot endpoint and writes the JSON response verbatim.
func (s *Server) proxyKnotJSON(w http.ResponseWriter, r *http.Request, repo *repoContext, nsid string, params url.Values) {
	params.Set("repo", repo.DID+"/"+repo.RepoName)
	body, _, err := s.knotCall(r, repo.KnotHost, nsid, params)
	if err != nil {
		s.knotError(w, err)
		return
	}
	defer body.Close()
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_, _ = io.Copy(w, body)
}

// proxyKnotBytes calls a knot endpoint and writes the raw bytes verbatim.
func (s *Server) proxyKnotBytes(w http.ResponseWriter, r *http.Request, repo *repoContext, nsid string, params url.Values) {
	params.Set("repo", repo.DID+"/"+repo.RepoName)
	body, _, err := s.knotCall(r, repo.KnotHost, nsid, params)
	if err != nil {
		s.knotError(w, err)
		return
	}
	defer body.Close()
	w.Header().Set("Content-Type", "application/octet-stream")
	w.WriteHeader(http.StatusOK)
	_, _ = io.Copy(w, body)
}

func (s *Server) knotError(w http.ResponseWriter, err error) {
	var nfe *xrpc.NotFoundError
	var xe *xrpc.XRPCError
	switch {
	case isError(err, &nfe):
		writeJSON(w, http.StatusNotFound, errorBody("not_found", nfe.Message))
	case isError(err, &xe):
		writeJSON(w, http.StatusBadGateway, errorBody("upstream_error", xe.Message))
	default:
		s.log.Debug("knot call failed", slog.String("error", err.Error()))
		writeJSON(w, http.StatusBadGateway, errorBody("upstream_error", "upstream request failed"))
	}
}

func (s *Server) actorError(w http.ResponseWriter, err error) {
	var nfe *xrpc.NotFoundError
	var xe *xrpc.XRPCError
	switch {
	case isError(err, &nfe):
		writeJSON(w, http.StatusNotFound, errorBody("not_found", nfe.Message))
	case isError(err, &xe):
		writeJSON(w, http.StatusBadGateway, errorBody("upstream_error", xe.Message))
	default:
		s.log.Debug("actor resolve failed", slog.String("error", err.Error()))
		writeJSON(w, http.StatusBadGateway, errorBody("resolve_error", "failed to resolve actor"))
	}
}

// isError is a type-safe errors.As replacement for pointer receiver targets.
func isError[T error](err error, target *T) bool {
	if err == nil {
		return false
	}

	type unwrapper interface{ Unwrap() error }
	for e := err; e != nil; {
		if t, ok := e.(T); ok {
			*target = t
			return true
		}
		if u, ok := e.(unwrapper); ok {
			e = u.Unwrap()
		} else {
			break
		}
	}
	return false
}

// handleGetActor returns the actor's Tangled profile + optional Bluesky info.
// GET /actors/{handle}
func (s *Server) handleGetActor(w http.ResponseWriter, r *http.Request) {
	handle := r.PathValue("handle")

	actor, err := s.resolveActor(r, handle)
	if err != nil {
		s.actorError(w, err)
		return
	}

	rec, err := s.xrpc.GetRecord(r.Context(), actor.PDS, actor.DID, "sh.tangled.actor.profile", "self")
	if err != nil {
		s.actorError(w, err)
		return
	}
	s.enqueueXRPCRecord(r.Context(), rec.URI, rec.CID, rec.Value)

	var bsky *bskyProfileResponse
	if linked, _ := rec.Value["bluesky"].(bool); linked {
		bsky = s.fetchBskyProfile(r, actor.DID)
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"did":    actor.DID,
		"handle": actor.Handle,
		"pds":    actor.PDS,
		"profile": recordEntry{
			URI:   rec.URI,
			CID:   rec.CID,
			Value: rec.Value,
		},
		"bsky": bsky,
	})
}

// handleListActorRepos returns all sh.tangled.repo records for an actor.
// GET /actors/{handle}/repos
func (s *Server) handleListActorRepos(w http.ResponseWriter, r *http.Request) {
	handle := r.PathValue("handle")

	actor, err := s.resolveActor(r, handle)
	if err != nil {
		s.actorError(w, err)
		return
	}

	entries, err := s.xrpc.ListAllRecords(r.Context(), actor.PDS, actor.DID, "sh.tangled.repo")
	if err != nil {
		s.actorError(w, err)
		return
	}
	s.enqueueXRPCList(r.Context(), entries)

	records := make([]recordEntry, len(entries))
	for i, e := range entries {
		records[i] = recordEntry{URI: e.URI, CID: e.CID, Value: e.Value}
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"did":     actor.DID,
		"handle":  actor.Handle,
		"records": records,
	})
}

// handleGetActorRepo returns the repo record for a specific repo by name.
// GET /actors/{handle}/repos/{repo}
func (s *Server) handleGetActorRepo(w http.ResponseWriter, r *http.Request) {
	handle := r.PathValue("handle")
	repoName := r.PathValue("repo")

	repo, err := s.resolveRepo(r, handle, repoName)
	if err != nil {
		s.actorError(w, err)
		return
	}

	did, _, rkey, parseErr := parseATURI(repo.AtURI)
	if parseErr != nil {
		writeJSON(w, http.StatusInternalServerError, errorBody("internal_error", "invalid AT URI"))
		return
	}

	rec, err := s.xrpc.GetRecord(r.Context(), repo.PDS, did, "sh.tangled.repo", rkey)
	if err != nil {
		s.actorError(w, err)
		return
	}
	s.enqueueXRPCRecord(r.Context(), rec.URI, rec.CID, rec.Value)

	writeJSON(w, http.StatusOK, map[string]any{
		"did":       repo.DID,
		"handle":    repo.Handle,
		"knot_host": repo.KnotHost,
		"record": recordEntry{
			URI:   rec.URI,
			CID:   rec.CID,
			Value: rec.Value,
		},
	})
}

// handleRepoTree proxies sh.tangled.repo.tree to the knot.
// GET /actors/{handle}/repos/{repo}/tree
func (s *Server) handleRepoTree(w http.ResponseWriter, r *http.Request) {
	repo, err := s.resolveRepo(r, r.PathValue("handle"), r.PathValue("repo"))
	if err != nil {
		s.actorError(w, err)
		return
	}
	params := url.Values{}
	for _, k := range []string{"ref", "path"} {
		if v := r.URL.Query().Get(k); v != "" {
			params.Set(k, v)
		}
	}
	s.proxyKnotJSON(w, r, repo, "sh.tangled.repo.tree", params)
}

// handleRepoBlob proxies sh.tangled.repo.blob to the knot.
// GET /actors/{handle}/repos/{repo}/blob
func (s *Server) handleRepoBlob(w http.ResponseWriter, r *http.Request) {
	repo, err := s.resolveRepo(r, r.PathValue("handle"), r.PathValue("repo"))
	if err != nil {
		s.actorError(w, err)
		return
	}
	params := url.Values{}
	for _, k := range []string{"ref", "path"} {
		if v := r.URL.Query().Get(k); v != "" {
			params.Set(k, v)
		}
	}
	s.proxyKnotJSON(w, r, repo, "sh.tangled.repo.blob", params)
}

// handleRepoLog proxies sh.tangled.repo.log (raw bytes) to the knot.
// GET /actors/{handle}/repos/{repo}/log
func (s *Server) handleRepoLog(w http.ResponseWriter, r *http.Request) {
	repo, err := s.resolveRepo(r, r.PathValue("handle"), r.PathValue("repo"))
	if err != nil {
		s.actorError(w, err)
		return
	}
	params := url.Values{}
	for _, k := range []string{"ref", "path", "limit", "cursor"} {
		if v := r.URL.Query().Get(k); v != "" {
			params.Set(k, v)
		}
	}
	s.proxyKnotBytes(w, r, repo, "sh.tangled.repo.log", params)
}

// handleRepoBranches proxies sh.tangled.repo.branches (raw bytes) to the knot.
// GET /actors/{handle}/repos/{repo}/branches
func (s *Server) handleRepoBranches(w http.ResponseWriter, r *http.Request) {
	repo, err := s.resolveRepo(r, r.PathValue("handle"), r.PathValue("repo"))
	if err != nil {
		s.actorError(w, err)
		return
	}
	params := url.Values{}
	for _, k := range []string{"limit", "cursor"} {
		if v := r.URL.Query().Get(k); v != "" {
			params.Set(k, v)
		}
	}
	s.proxyKnotBytes(w, r, repo, "sh.tangled.repo.branches", params)
}

// handleRepoDefaultBranch proxies sh.tangled.repo.getDefaultBranch (JSON) to the knot.
// GET /actors/{handle}/repos/{repo}/default-branch
func (s *Server) handleRepoDefaultBranch(w http.ResponseWriter, r *http.Request) {
	repo, err := s.resolveRepo(r, r.PathValue("handle"), r.PathValue("repo"))
	if err != nil {
		s.actorError(w, err)
		return
	}
	s.proxyKnotJSON(w, r, repo, "sh.tangled.repo.getDefaultBranch", url.Values{})
}

// handleRepoLanguages proxies sh.tangled.repo.languages (JSON) to the knot.
// GET /actors/{handle}/repos/{repo}/languages
func (s *Server) handleRepoLanguages(w http.ResponseWriter, r *http.Request) {
	repo, err := s.resolveRepo(r, r.PathValue("handle"), r.PathValue("repo"))
	if err != nil {
		s.actorError(w, err)
		return
	}
	params := url.Values{}
	if v := r.URL.Query().Get("ref"); v != "" {
		params.Set("ref", v)
	}
	s.proxyKnotJSON(w, r, repo, "sh.tangled.repo.languages", params)
}

// handleRepoTags proxies sh.tangled.repo.tags (raw bytes) to the knot.
// GET /actors/{handle}/repos/{repo}/tags
func (s *Server) handleRepoTags(w http.ResponseWriter, r *http.Request) {
	repo, err := s.resolveRepo(r, r.PathValue("handle"), r.PathValue("repo"))
	if err != nil {
		s.actorError(w, err)
		return
	}
	s.proxyKnotBytes(w, r, repo, "sh.tangled.repo.tags", url.Values{})
}

// handleRepoDiff proxies sh.tangled.repo.diff (raw bytes) to the knot.
// GET /actors/{handle}/repos/{repo}/diff
func (s *Server) handleRepoDiff(w http.ResponseWriter, r *http.Request) {
	repo, err := s.resolveRepo(r, r.PathValue("handle"), r.PathValue("repo"))
	if err != nil {
		s.actorError(w, err)
		return
	}
	params := url.Values{}
	if v := r.URL.Query().Get("ref"); v != "" {
		params.Set("ref", v)
	}
	s.proxyKnotBytes(w, r, repo, "sh.tangled.repo.diff", params)
}

// handleRepoCompare proxies sh.tangled.repo.compare (raw bytes) to the knot.
// GET /actors/{handle}/repos/{repo}/compare
func (s *Server) handleRepoCompare(w http.ResponseWriter, r *http.Request) {
	repo, err := s.resolveRepo(r, r.PathValue("handle"), r.PathValue("repo"))
	if err != nil {
		s.actorError(w, err)
		return
	}
	params := url.Values{}
	for _, k := range []string{"from", "to"} {
		if v := r.URL.Query().Get(k); v != "" {
			params.Set(k, v)
		}
	}
	s.proxyKnotBytes(w, r, repo, "sh.tangled.repo.compare", params)
}

// handleRepoIssues returns issues for a repo, pre-joined with state.
// GET /actors/{handle}/repos/{repo}/issues
func (s *Server) handleRepoIssues(w http.ResponseWriter, r *http.Request) {
	repo, err := s.resolveRepo(r, r.PathValue("handle"), r.PathValue("repo"))
	if err != nil {
		s.actorError(w, err)
		return
	}

	issues, stateMap, err := s.fetchIssuesAndStates(r, repo.PDS, repo.DID)
	if err != nil {
		writeJSON(w, http.StatusBadGateway, errorBody("upstream_error", "failed to fetch issues"))
		return
	}
	s.enqueueXRPCList(r.Context(), issues)

	var records []issueEntry
	for _, e := range issues {
		repoURI, _ := e.Value["repo"].(string)
		if repo.AtURI != "" && repoURI != repo.AtURI {
			continue
		}
		records = append(records, issueEntry{
			recordEntry: recordEntry{URI: e.URI, CID: e.CID, Value: e.Value},
			State:       resolveIssueState(stateMap, e.URI),
		})
	}
	if records == nil {
		records = []issueEntry{}
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"did":     repo.DID,
		"handle":  repo.Handle,
		"records": records,
	})
}

// handleRepoPulls returns pull requests for a repo, pre-joined with status.
// GET /actors/{handle}/repos/{repo}/pulls
func (s *Server) handleRepoPulls(w http.ResponseWriter, r *http.Request) {
	repo, err := s.resolveRepo(r, r.PathValue("handle"), r.PathValue("repo"))
	if err != nil {
		s.actorError(w, err)
		return
	}

	pulls, statusMap, err := s.fetchPullsAndStatuses(r, repo.PDS, repo.DID)
	if err != nil {
		writeJSON(w, http.StatusBadGateway, errorBody("upstream_error", "failed to fetch pulls"))
		return
	}
	s.enqueueXRPCList(r.Context(), pulls)

	var records []pullEntry
	for _, e := range pulls {
		target, _ := e.Value["target"].(map[string]any)
		targetRepo, _ := target["repo"].(string)
		if repo.AtURI != "" && targetRepo != repo.AtURI {
			continue
		}
		records = append(records, pullEntry{
			recordEntry: recordEntry{URI: e.URI, CID: e.CID, Value: e.Value},
			Status:      resolvePullStatus(statusMap, e.URI),
		})
	}
	if records == nil {
		records = []pullEntry{}
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"did":     repo.DID,
		"handle":  repo.Handle,
		"records": records,
	})
}

// handleActorIssues returns all issues authored by an actor, pre-joined with state.
// GET /actors/{handle}/issues
func (s *Server) handleActorIssues(w http.ResponseWriter, r *http.Request) {
	actor, err := s.resolveActor(r, r.PathValue("handle"))
	if err != nil {
		s.actorError(w, err)
		return
	}

	issues, stateMap, err := s.fetchIssuesAndStates(r, actor.PDS, actor.DID)
	if err != nil {
		writeJSON(w, http.StatusBadGateway, errorBody("upstream_error", "failed to fetch issues"))
		return
	}
	s.enqueueXRPCList(r.Context(), issues)

	records := make([]issueEntry, len(issues))
	for i, e := range issues {
		records[i] = issueEntry{
			recordEntry: recordEntry{URI: e.URI, CID: e.CID, Value: e.Value},
			State:       resolveIssueState(stateMap, e.URI),
		}
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"did":     actor.DID,
		"handle":  actor.Handle,
		"records": records,
	})
}

// handleActorPulls returns all pull requests authored by an actor, pre-joined with status.
// GET /actors/{handle}/pulls
func (s *Server) handleActorPulls(w http.ResponseWriter, r *http.Request) {
	actor, err := s.resolveActor(r, r.PathValue("handle"))
	if err != nil {
		s.actorError(w, err)
		return
	}

	pulls, statusMap, err := s.fetchPullsAndStatuses(r, actor.PDS, actor.DID)
	if err != nil {
		writeJSON(w, http.StatusBadGateway, errorBody("upstream_error", "failed to fetch pulls"))
		return
	}
	s.enqueueXRPCList(r.Context(), pulls)

	records := make([]pullEntry, len(pulls))
	for i, e := range pulls {
		records[i] = pullEntry{
			recordEntry: recordEntry{URI: e.URI, CID: e.CID, Value: e.Value},
			Status:      resolvePullStatus(statusMap, e.URI),
		}
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"did":     actor.DID,
		"handle":  actor.Handle,
		"records": records,
	})
}

// handleActorFollowing returns sh.tangled.graph.follow records for an actor.
// GET /actors/{handle}/following
func (s *Server) handleActorFollowing(w http.ResponseWriter, r *http.Request) {
	actor, err := s.resolveActor(r, r.PathValue("handle"))
	if err != nil {
		s.actorError(w, err)
		return
	}

	entries, err := s.xrpc.ListAllRecords(r.Context(), actor.PDS, actor.DID, "sh.tangled.graph.follow")
	if err != nil {
		writeJSON(w, http.StatusBadGateway, errorBody("upstream_error", "failed to fetch follows"))
		return
	}
	s.enqueueXRPCList(r.Context(), entries)

	records := make([]recordEntry, len(entries))
	for i, e := range entries {
		records[i] = recordEntry{URI: e.URI, CID: e.CID, Value: e.Value}
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"did":     actor.DID,
		"handle":  actor.Handle,
		"records": records,
	})
}

// handleActorStrings returns sh.tangled.string records for an actor.
// GET /actors/{handle}/strings
func (s *Server) handleActorStrings(w http.ResponseWriter, r *http.Request) {
	actor, err := s.resolveActor(r, r.PathValue("handle"))
	if err != nil {
		s.actorError(w, err)
		return
	}

	entries, err := s.xrpc.ListAllRecords(r.Context(), actor.PDS, actor.DID, "sh.tangled.string")
	if err != nil {
		writeJSON(w, http.StatusBadGateway, errorBody("upstream_error", "failed to fetch strings"))
		return
	}
	s.enqueueXRPCList(r.Context(), entries)

	records := make([]recordEntry, len(entries))
	for i, e := range entries {
		records[i] = recordEntry{URI: e.URI, CID: e.CID, Value: e.Value}
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"did":     actor.DID,
		"handle":  actor.Handle,
		"records": records,
	})
}

// handleIssueDetail returns a single issue with its state.
// GET /issues/{handle}/{rkey}
func (s *Server) handleIssueDetail(w http.ResponseWriter, r *http.Request) {
	handle := r.PathValue("handle")
	rkey := r.PathValue("rkey")

	actor, err := s.resolveActor(r, handle)
	if err != nil {
		s.actorError(w, err)
		return
	}

	rec, err := s.xrpc.GetRecord(r.Context(), actor.PDS, actor.DID, "sh.tangled.repo.issue", rkey)
	if err != nil {
		s.actorError(w, err)
		return
	}
	s.enqueueXRPCRecord(r.Context(), rec.URI, rec.CID, rec.Value)

	_, stateMap, err := s.fetchIssuesAndStates(r, actor.PDS, actor.DID)
	if err != nil {
		writeJSON(w, http.StatusBadGateway, errorBody("upstream_error", "failed to fetch issue states"))
		return
	}

	writeJSON(w, http.StatusOK, issueEntry{
		recordEntry: recordEntry{URI: rec.URI, CID: rec.CID, Value: rec.Value},
		State:       resolveIssueState(stateMap, rec.URI),
	})
}

// handleIssueComments returns all comments for a specific issue.
// GET /issues/{handle}/{rkey}/comments
func (s *Server) handleIssueComments(w http.ResponseWriter, r *http.Request) {
	handle := r.PathValue("handle")
	rkey := r.PathValue("rkey")

	actor, err := s.resolveActor(r, handle)
	if err != nil {
		s.actorError(w, err)
		return
	}

	issueURI := fmt.Sprintf("at://%s/sh.tangled.repo.issue/%s", actor.DID, rkey)

	entries, err := s.xrpc.ListAllRecords(r.Context(), actor.PDS, actor.DID, "sh.tangled.repo.issue.comment")
	if err != nil {
		writeJSON(w, http.StatusBadGateway, errorBody("upstream_error", "failed to fetch comments"))
		return
	}
	s.enqueueXRPCList(r.Context(), entries)

	var records []recordEntry
	for _, e := range entries {
		issue, _ := e.Value["issue"].(string)
		if issue == issueURI {
			records = append(records, recordEntry{URI: e.URI, CID: e.CID, Value: e.Value})
		}
	}
	if records == nil {
		records = []recordEntry{}
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"did":      actor.DID,
		"handle":   actor.Handle,
		"issueUri": issueURI,
		"records":  records,
	})
}

// handlePullDetail returns a single pull request with its status.
// GET /pulls/{handle}/{rkey}
func (s *Server) handlePullDetail(w http.ResponseWriter, r *http.Request) {
	handle := r.PathValue("handle")
	rkey := r.PathValue("rkey")

	actor, err := s.resolveActor(r, handle)
	if err != nil {
		s.actorError(w, err)
		return
	}

	rec, err := s.xrpc.GetRecord(r.Context(), actor.PDS, actor.DID, "sh.tangled.repo.pull", rkey)
	if err != nil {
		s.actorError(w, err)
		return
	}
	s.enqueueXRPCRecord(r.Context(), rec.URI, rec.CID, rec.Value)

	_, statusMap, err := s.fetchPullsAndStatuses(r, actor.PDS, actor.DID)
	if err != nil {
		writeJSON(w, http.StatusBadGateway, errorBody("upstream_error", "failed to fetch pull statuses"))
		return
	}

	writeJSON(w, http.StatusOK, pullEntry{
		recordEntry: recordEntry{URI: rec.URI, CID: rec.CID, Value: rec.Value},
		Status:      resolvePullStatus(statusMap, rec.URI),
	})
}

// handlePullComments returns all comments for a specific pull request.
// GET /pulls/{handle}/{rkey}/comments
func (s *Server) handlePullComments(w http.ResponseWriter, r *http.Request) {
	handle := r.PathValue("handle")
	rkey := r.PathValue("rkey")

	actor, err := s.resolveActor(r, handle)
	if err != nil {
		s.actorError(w, err)
		return
	}

	pullURI := fmt.Sprintf("at://%s/sh.tangled.repo.pull/%s", actor.DID, rkey)

	entries, err := s.xrpc.ListAllRecords(r.Context(), actor.PDS, actor.DID, "sh.tangled.repo.pull.comment")
	if err != nil {
		writeJSON(w, http.StatusBadGateway, errorBody("upstream_error", "failed to fetch comments"))
		return
	}
	s.enqueueXRPCList(r.Context(), entries)

	var records []recordEntry
	for _, e := range entries {
		pull, _ := e.Value["pull"].(string)
		if pull == pullURI {
			records = append(records, recordEntry{URI: e.URI, CID: e.CID, Value: e.Value})
		}
	}
	if records == nil {
		records = []recordEntry{}
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"did":     actor.DID,
		"handle":  actor.Handle,
		"pullUri": pullURI,
		"records": records,
	})
}

func (s *Server) fetchIssuesAndStates(r *http.Request, pds, did string) ([]xrpc.ListRecordEntry, map[string]string, error) {
	issueCh := make(chan []xrpc.ListRecordEntry, 1)
	stateCh := make(chan []xrpc.ListRecordEntry, 1)
	errCh := make(chan error, 2)

	go func() {
		entries, err := s.xrpc.ListAllRecords(r.Context(), pds, did, "sh.tangled.repo.issue")
		if err != nil {
			errCh <- err
			return
		}
		issueCh <- entries
	}()
	go func() {
		entries, err := s.xrpc.ListAllRecords(r.Context(), pds, did, "sh.tangled.repo.issue.state")
		if err != nil {
			errCh <- err
			return
		}
		stateCh <- entries
	}()

	var issues []xrpc.ListRecordEntry
	var states []xrpc.ListRecordEntry
	for i := 0; i < 2; i++ {
		select {
		case e := <-issueCh:
			issues = e
		case e := <-stateCh:
			states = e
		case err := <-errCh:
			return nil, nil, err
		}
	}

	stateMap := make(map[string]string, len(states))
	s.enqueueXRPCList(r.Context(), states)
	for _, e := range states {
		issueURI, _ := e.Value["issue"].(string)
		state, _ := e.Value["state"].(string)
		if issueURI != "" {
			stateMap[issueURI] = state
		}
	}

	return issues, stateMap, nil
}

func (s *Server) fetchPullsAndStatuses(r *http.Request, pds, did string) ([]xrpc.ListRecordEntry, map[string]string, error) {
	pullCh := make(chan []xrpc.ListRecordEntry, 1)
	statusCh := make(chan []xrpc.ListRecordEntry, 1)
	errCh := make(chan error, 2)

	go func() {
		entries, err := s.xrpc.ListAllRecords(r.Context(), pds, did, "sh.tangled.repo.pull")
		if err != nil {
			errCh <- err
			return
		}
		pullCh <- entries
	}()
	go func() {
		entries, err := s.xrpc.ListAllRecords(r.Context(), pds, did, "sh.tangled.repo.pull.status")
		if err != nil {
			errCh <- err
			return
		}
		statusCh <- entries
	}()

	var pulls []xrpc.ListRecordEntry
	var statuses []xrpc.ListRecordEntry
	for i := 0; i < 2; i++ {
		select {
		case e := <-pullCh:
			pulls = e
		case e := <-statusCh:
			statuses = e
		case err := <-errCh:
			return nil, nil, err
		}
	}

	statusMap := make(map[string]string, len(statuses))
	s.enqueueXRPCList(r.Context(), statuses)
	for _, e := range statuses {
		pullURI, _ := e.Value["pull"].(string)
		status, _ := e.Value["status"].(string)
		if pullURI != "" {
			statusMap[pullURI] = status
		}
	}

	return pulls, statusMap, nil
}

func resolveIssueState(stateMap map[string]string, issueURI string) string {
	raw := stateMap[issueURI]
	if strings.HasSuffix(raw, ".closed") {
		return "closed"
	}
	return "open"
}

func resolvePullStatus(statusMap map[string]string, pullURI string) string {
	raw := statusMap[pullURI]
	switch {
	case strings.HasSuffix(raw, ".merged"):
		return "merged"
	case strings.HasSuffix(raw, ".closed"):
		return "closed"
	default:
		return "open"
	}
}

type bskyProfileResponse struct {
	DisplayName string `json:"displayName,omitempty"`
	Avatar      string `json:"avatar,omitempty"`
}

func (s *Server) fetchBskyProfile(r *http.Request, did string) *bskyProfileResponse {
	body, err := s.xrpc.Call(r.Context(), "https://public.api.bsky.app", "app.bsky.actor.getProfile", url.Values{"actor": {did}})
	if err != nil {
		return nil
	}
	defer body.Close()

	var p bskyProfileResponse
	if err := json.NewDecoder(body).Decode(&p); err != nil {
		return nil
	}
	return &p
}

// parseATURI splits an AT URI (at://did/collection/rkey) into its components.
func parseATURI(uri string) (did, collection, rkey string, err error) {
	trimmed := strings.TrimPrefix(uri, "at://")
	parts := strings.SplitN(trimmed, "/", 3)
	if len(parts) != 3 {
		return "", "", "", fmt.Errorf("invalid AT URI: %q", uri)
	}
	return parts[0], parts[1], parts[2], nil
}
