package api

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"

	"tangled.org/desertthunder.dev/twister/internal/config"
	idx "tangled.org/desertthunder.dev/twister/internal/index"
	"tangled.org/desertthunder.dev/twister/internal/normalize"
	"tangled.org/desertthunder.dev/twister/internal/store"
	"tangled.org/desertthunder.dev/twister/internal/xrpc"
)

func newAPITestServer(st *apiTestStore, client *xrpc.Client) *Server {
	cfg := &config.Config{
		IndexedCollections:     "sh.tangled.*",
		ReadThroughCollections: "sh.tangled.*",
		ReadThroughMode:        "missing",
		ReadThroughMaxAttempts: 5,
	}
	log := slog.New(slog.NewTextHandler(io.Discard, nil))
	policy := idx.NewPolicy(cfg.IndexedCollections, cfg.ReadThroughCollections, cfg.ReadThroughMode)
	registry := normalize.NewRegistry()
	return &Server{
		store: st, cfg: cfg, log: log, xrpc: client, registry: registry,
		policy: policy, processor: idx.NewProcessor(st, registry, client, policy, log), workerID: "api-test",
	}
}

func TestEnqueueXRPCRecordSkipsExistingDocument(t *testing.T) {
	st := newAPITestStore()
	st.docs["did:plc:alice|sh.tangled.repo|repo1"] = &store.Document{
		ID: "did:plc:alice|sh.tangled.repo|repo1", CID: "cid-1",
	}
	srv := newAPITestServer(st, nil)

	srv.enqueueXRPCRecord(context.Background(), "at://did:plc:alice/sh.tangled.repo/repo1", "cid-1", map[string]any{"name": "repo1"})

	if len(st.jobs) != 0 {
		t.Fatalf("expected no jobs, got %#v", st.jobs)
	}
	if len(st.audits) == 0 || st.audits[0].Decision != "skip_already_indexed" {
		t.Fatalf("unexpected audit rows: %#v", st.audits)
	}
}

func TestEnqueueXRPCRecordOnlyQueuesOncePerCID(t *testing.T) {
	st := newAPITestStore()
	srv := newAPITestServer(st, nil)
	uri := "at://did:plc:alice/sh.tangled.repo/repo1"

	srv.enqueueXRPCRecord(context.Background(), uri, "cid-1", map[string]any{"name": "repo1"})
	srv.enqueueXRPCRecord(context.Background(), uri, "cid-1", map[string]any{"name": "repo1"})

	if len(st.jobs) != 1 {
		t.Fatalf("expected one queued job, got %#v", st.jobs)
	}
	if st.jobs["did:plc:alice|sh.tangled.repo|repo1"].Status != store.IndexingJobPending {
		t.Fatalf("unexpected job state: %#v", st.jobs["did:plc:alice|sh.tangled.repo|repo1"])
	}
}

func TestHandleActorFollowingEnqueuesRecords(t *testing.T) {
	var upstream *httptest.Server
	upstream = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.URL.Path == "/xrpc/com.atproto.identity.resolveHandle":
			_ = json.NewEncoder(w).Encode(map[string]string{"did": "did:plc:alice"})
		case r.URL.Path == "/did%3Aplc%3Aalice" || r.URL.Path == "/did:plc:alice":
			_ = json.NewEncoder(w).Encode(map[string]any{
				"id":          "did:plc:alice",
				"alsoKnownAs": []string{"at://alice.tangled.org"},
				"service": []map[string]string{{
					"type": "AtprotoPersonalDataServer", "serviceEndpoint": upstream.URL,
				}},
			})
		case r.URL.Path == "/xrpc/com.atproto.repo.listRecords":
			_ = json.NewEncoder(w).Encode(map[string]any{
				"records": []map[string]any{{
					"uri":   "at://did:plc:alice/sh.tangled.graph.follow/1",
					"cid":   "cid-1",
					"value": map[string]any{"subject": "did:plc:bob"},
				}},
			})
		default:
			http.NotFound(w, r)
		}
	}))
	defer upstream.Close()

	client := xrpc.NewClient(
		xrpc.WithHTTPClient(upstream.Client()),
		xrpc.WithIdentityService(upstream.URL),
		xrpc.WithPLCDirectory(upstream.URL),
	)
	st := newAPITestStore()
	srv := newAPITestServer(st, client)
	mux := http.NewServeMux()
	mux.HandleFunc("GET /actors/{handle}/following", srv.handleActorFollowing)

	req := httptest.NewRequest(http.MethodGet, "/actors/alice.tangled.org/following", nil)
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status: got %d body=%s", rec.Code, rec.Body.String())
	}
	if len(st.jobs) != 1 {
		t.Fatalf("expected one queued follow job, got %#v", st.jobs)
	}
	job := st.jobs["did:plc:alice|sh.tangled.graph.follow|1"]
	if job == nil {
		t.Fatalf("expected follow indexing job, got %#v", st.jobs)
	}
}

func TestHandleActorReposEnqueuesRecords(t *testing.T) {
	var upstream *httptest.Server
	upstream = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.URL.Path == "/xrpc/com.atproto.identity.resolveHandle":
			_ = json.NewEncoder(w).Encode(map[string]string{"did": "did:plc:alice"})
		case r.URL.Path == "/did%3Aplc%3Aalice" || r.URL.Path == "/did:plc:alice":
			_ = json.NewEncoder(w).Encode(map[string]any{
				"id":          "did:plc:alice",
				"alsoKnownAs": []string{"at://alice.tangled.org"},
				"service": []map[string]string{{
					"type": "AtprotoPersonalDataServer", "serviceEndpoint": upstream.URL,
				}},
			})
		case r.URL.Path == "/xrpc/com.atproto.repo.listRecords":
			_ = json.NewEncoder(w).Encode(map[string]any{
				"records": []map[string]any{{
					"uri": "at://did:plc:alice/sh.tangled.repo/repo1",
					"cid": "cid-1",
					"value": map[string]any{
						"$type": "sh.tangled.repo",
						"name":  "repo1",
						"knot":  "knot.tangled.org",
					},
				}},
			})
		default:
			http.NotFound(w, r)
		}
	}))
	defer upstream.Close()

	client := xrpc.NewClient(
		xrpc.WithHTTPClient(upstream.Client()),
		xrpc.WithIdentityService(upstream.URL),
		xrpc.WithPLCDirectory(upstream.URL),
	)
	st := newAPITestStore()
	srv := newAPITestServer(st, client)
	mux := http.NewServeMux()
	mux.HandleFunc("GET /actors/{handle}/repos", srv.handleListActorRepos)

	req := httptest.NewRequest(http.MethodGet, "/actors/alice.tangled.org/repos", nil)
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status: got %d body=%s", rec.Code, rec.Body.String())
	}
	if len(st.jobs) != 1 {
		t.Fatalf("expected one queued repo job, got %#v", st.jobs)
	}
	job := st.jobs["did:plc:alice|sh.tangled.repo|repo1"]
	if job == nil {
		t.Fatalf("expected repo indexing job, got %#v", st.jobs)
	}
}

func TestDeadLetterJobVisibleThroughAdminEndpoints(t *testing.T) {
	st := newAPITestStore()
	job := &store.IndexingJob{
		DocumentID: "did:plc:alice|sh.tangled.repo|repo1",
		Collection: "sh.tangled.repo",
		CID:        "cid-1",
		Source:     store.IndexSourceReadThrough,
		Status:     store.IndexingJobProcessing,
	}
	st.jobs[job.DocumentID] = job
	srv := newAPITestServer(st, nil)

	srv.handleReadThroughFailure(context.Background(), job, &idx.PermanentError{
		Decision: "normalize_failed",
		Err:      errors.New("boom"),
	})

	req := httptest.NewRequest(http.MethodGet, "/admin/indexing/jobs", nil)
	rec := httptest.NewRecorder()
	srv.handleAdminIndexingJobs(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("jobs status: got %d body=%s", rec.Code, rec.Body.String())
	}
	if st.jobs[job.DocumentID].Status != store.IndexingJobDeadLetter {
		t.Fatalf("expected dead letter status, got %#v", st.jobs[job.DocumentID])
	}

	req = httptest.NewRequest(http.MethodGet, "/admin/indexing/audit?document="+job.DocumentID, nil)
	rec = httptest.NewRecorder()
	srv.handleAdminIndexingAudit(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("audit status: got %d body=%s", rec.Code, rec.Body.String())
	}
	if !bytes.Contains(rec.Body.Bytes(), []byte("normalize_failed")) {
		t.Fatalf("expected normalize_failed in audit body: %s", rec.Body.String())
	}
}
