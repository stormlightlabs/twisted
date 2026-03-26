package ingest

import (
	"context"
	"io"
	"log/slog"
	"testing"

	idx "tangled.org/desertthunder.dev/twister/internal/index"
	"tangled.org/desertthunder.dev/twister/internal/normalize"
	"tangled.org/desertthunder.dev/twister/internal/store"
)

type fakeTapClient struct {
	acked []int64
	onAck func(id int64)
}

func (f *fakeTapClient) ReadEvent(_ context.Context) (normalize.TapRecordEvent, error) {
	return normalize.TapRecordEvent{}, io.EOF
}

func (f *fakeTapClient) AckEvent(_ context.Context, id int64) error {
	if f.onAck != nil {
		f.onAck(id)
	}
	f.acked = append(f.acked, id)
	return nil
}

func (f *fakeTapClient) Close() error { return nil }

type fakeStore struct {
	docs         map[string]*store.Document
	deleted      map[string]bool
	syncCursor   string
	initialSync  *store.SyncState
	recordStates map[string]string
	handles      map[string]string
	jobs         map[string]*store.IndexingJob
	audits       []store.IndexingAuditInput
	onSetSync    func()
}

func newFakeStore() *fakeStore {
	return &fakeStore{
		docs:         make(map[string]*store.Document),
		deleted:      make(map[string]bool),
		recordStates: make(map[string]string),
		handles:      make(map[string]string),
		jobs:         make(map[string]*store.IndexingJob),
	}
}

func (f *fakeStore) UpsertDocument(_ context.Context, doc *store.Document) error {
	clone := *doc
	f.docs[doc.ID] = &clone
	return nil
}

func (f *fakeStore) GetDocument(_ context.Context, id string) (*store.Document, error) {
	return f.docs[id], nil
}

func (f *fakeStore) MarkDeleted(_ context.Context, id string) error {
	f.deleted[id] = true
	return nil
}

func (f *fakeStore) GetSyncState(_ context.Context, _ string) (*store.SyncState, error) {
	if f.initialSync != nil {
		state := *f.initialSync
		return &state, nil
	}
	if f.syncCursor == "" {
		return nil, nil
	}
	return &store.SyncState{ConsumerName: "indexer-tap-v1", Cursor: f.syncCursor}, nil
}

func (f *fakeStore) SetSyncState(_ context.Context, _ string, cursor string) error {
	if f.onSetSync != nil {
		f.onSetSync()
	}
	f.syncCursor = cursor
	return nil
}

func (f *fakeStore) UpdateRecordState(_ context.Context, subjectURI string, state string) error {
	f.recordStates[subjectURI] = state
	return nil
}

func (f *fakeStore) UpsertIdentityHandle(_ context.Context, did, handle string, _ bool, _ string) error {
	f.handles[did] = handle
	return nil
}

func (f *fakeStore) GetIdentityHandle(_ context.Context, did string) (string, error) {
	return f.handles[did], nil
}

func (f *fakeStore) EnqueueIndexingJob(_ context.Context, _ store.IndexingJobInput) error {
	return nil
}

func (f *fakeStore) GetIndexingJob(_ context.Context, documentID string) (*store.IndexingJob, error) {
	return f.jobs[documentID], nil
}

func (f *fakeStore) ClaimIndexingJob(_ context.Context, _, _ string) (*store.IndexingJob, error) {
	return nil, nil
}

func (f *fakeStore) CompleteIndexingJob(_ context.Context, _ string) error {
	return nil
}

func (f *fakeStore) RetryIndexingJob(_ context.Context, _, _, _ string) error {
	return nil
}

func (f *fakeStore) FailIndexingJob(_ context.Context, _, _, _ string) error {
	return nil
}

func (f *fakeStore) ListIndexingJobs(_ context.Context, _ store.IndexingJobFilter) ([]*store.IndexingJob, error) {
	return nil, nil
}

func (f *fakeStore) GetIndexingJobStats(_ context.Context) (*store.IndexingJobStats, error) {
	return &store.IndexingJobStats{}, nil
}

func (f *fakeStore) AppendIndexingAudit(_ context.Context, input store.IndexingAuditInput) error {
	f.audits = append(f.audits, input)
	return nil
}

func (f *fakeStore) ListIndexingAudit(_ context.Context, _ store.IndexingAuditFilter) ([]*store.IndexingAuditEntry, error) {
	return nil, nil
}

func (f *fakeStore) GetFollowSubjects(_ context.Context, _ string) ([]string, error) {
	return nil, nil
}

func (f *fakeStore) GetRepoCollaborators(_ context.Context, _ string) ([]string, error) {
	return nil, nil
}

func (f *fakeStore) ListDocuments(_ context.Context, _ store.DocumentFilter) ([]*store.Document, error) {
	docs := make([]*store.Document, 0, len(f.docs))
	for _, d := range f.docs {
		docs = append(docs, d)
	}
	return docs, nil
}

func (f *fakeStore) OptimizeFTS(_ context.Context) error {
	return nil
}

func (f *fakeStore) CountDocuments(_ context.Context) (int64, error) {
	return int64(len(f.docs)), nil
}

func (f *fakeStore) CountPendingIndexingJobs(_ context.Context) (int64, error) {
	return 0, nil
}

func (f *fakeStore) InsertJetstreamEvent(_ context.Context, _ *store.JetstreamEvent, _ int) error {
	return nil
}

func (f *fakeStore) ListJetstreamEvents(_ context.Context, _ store.JetstreamEventFilter) ([]*store.JetstreamEvent, error) {
	return nil, nil
}

func (f *fakeStore) Ping(_ context.Context) error {
	return nil
}

func newRunnerForTest(st *fakeStore, tap *fakeTapClient, indexedCollections string) *Runner {
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	return NewRunner(st, normalize.NewRegistry(), tap, indexedCollections, logger)
}

func TestRunner_ProcessIdentityEvent(t *testing.T) {
	st := newFakeStore()
	tap := &fakeTapClient{}
	r := newRunnerForTest(st, tap, "sh.tangled.*")

	event := normalize.TapRecordEvent{
		ID:   101,
		Type: "identity",
		Identity: &normalize.TapIdentity{
			DID:      "did:plc:abc",
			Handle:   "alice.tangled.org",
			IsActive: true,
			Status:   "active",
		},
	}

	if err := r.processEvent(context.Background(), event); err != nil {
		t.Fatalf("process identity event: %v", err)
	}
	if got := st.handles["did:plc:abc"]; got != "alice.tangled.org" {
		t.Fatalf("handle: got %q", got)
	}
	if st.syncCursor != "101" {
		t.Fatalf("cursor: got %q, want 101", st.syncCursor)
	}
	if len(tap.acked) != 1 || tap.acked[0] != 101 {
		t.Fatalf("acks: got %#v", tap.acked)
	}
}

func TestRunner_ProcessCreateAndDelete(t *testing.T) {
	st := newFakeStore()
	st.handles["did:plc:author"] = "author.tangled.org"
	tap := &fakeTapClient{}
	r := newRunnerForTest(st, tap, "sh.tangled.*")

	createEvent := normalize.TapRecordEvent{
		ID:   201,
		Type: "record",
		Record: &normalize.TapRecord{
			DID:        "did:plc:author",
			Collection: "sh.tangled.repo",
			RKey:       "repo1",
			Action:     "create",
			CID:        "cid-1",
			Record: map[string]any{
				"name":        "repo-one",
				"description": "test repo",
			},
		},
	}
	if err := r.processEvent(context.Background(), createEvent); err != nil {
		t.Fatalf("process create event: %v", err)
	}

	docID := normalize.StableID("did:plc:author", "sh.tangled.repo", "repo1")
	doc := st.docs[docID]
	if doc == nil {
		t.Fatalf("document %q not found", docID)
	}
	if doc.AuthorHandle != "author.tangled.org" {
		t.Fatalf("author handle: got %q", doc.AuthorHandle)
	}
	deleteEvent := normalize.TapRecordEvent{
		ID:   202,
		Type: "record",
		Record: &normalize.TapRecord{
			DID:        "did:plc:author",
			Collection: "sh.tangled.repo",
			RKey:       "repo1",
			Action:     "delete",
		},
	}
	if err := r.processEvent(context.Background(), deleteEvent); err != nil {
		t.Fatalf("process delete event: %v", err)
	}
	if !st.deleted[docID] {
		t.Fatalf("expected tombstone for %q", docID)
	}
	if st.syncCursor != "202" {
		t.Fatalf("cursor: got %q, want 202", st.syncCursor)
	}
}

func TestRunner_ProcessStateEvent(t *testing.T) {
	st := newFakeStore()
	tap := &fakeTapClient{}
	r := newRunnerForTest(st, tap, "sh.tangled.*")

	event := normalize.TapRecordEvent{
		ID:   301,
		Type: "record",
		Record: &normalize.TapRecord{
			DID:        "did:plc:abc",
			Collection: "sh.tangled.repo.issue.state",
			RKey:       "state1",
			Action:     "create",
			Record: map[string]any{
				"subject": "at://did:plc:abc/sh.tangled.repo.issue/1",
				"status":  "closed",
			},
		},
	}

	if err := r.processEvent(context.Background(), event); err != nil {
		t.Fatalf("process state event: %v", err)
	}
	if got := st.recordStates["at://did:plc:abc/sh.tangled.repo.issue/1"]; got != "closed" {
		t.Fatalf("record state: got %q", got)
	}
}

func TestRunner_NormalizationFailureAdvancesCursor(t *testing.T) {
	st := newFakeStore()
	tap := &fakeTapClient{}
	r := newRunnerForTest(st, tap, "sh.tangled.*")

	event := normalize.TapRecordEvent{
		ID:   401,
		Type: "record",
		Record: &normalize.TapRecord{
			DID:        "did:plc:abc",
			Collection: "sh.tangled.repo.issue",
			RKey:       "bad-issue",
			Action:     "create",
			CID:        "cid-bad",
			Record: map[string]any{
				"title": "bad issue",
				"repo":  "not-an-at-uri",
			},
		},
	}

	if err := r.processEvent(context.Background(), event); err != nil {
		t.Fatalf("process malformed issue event: %v", err)
	}
	if st.syncCursor != "401" {
		t.Fatalf("cursor: got %q, want 401", st.syncCursor)
	}
	if len(st.docs) != 0 {
		t.Fatalf("expected no documents, got %d", len(st.docs))
	}
}

func TestAllowlistMatching(t *testing.T) {
	policy := idx.NewPolicy("sh.tangled.repo, sh.tangled.string sh.tangled.actor.*", "", idx.ReadThroughMissing)
	if !policy.Allows(store.IndexSourceTap, "sh.tangled.repo") {
		t.Fatal("expected exact match")
	}
	if !policy.Allows(store.IndexSourceTap, "sh.tangled.actor.profile") {
		t.Fatal("expected wildcard prefix match")
	}
	if policy.Allows(store.IndexSourceTap, "app.bsky.feed.post") {
		t.Fatal("unexpected match")
	}
}

func TestRunner_InitializeCursorResume(t *testing.T) {
	st := newFakeStore()
	st.initialSync = &store.SyncState{ConsumerName: "indexer-tap-v1", Cursor: "150"}
	tap := &fakeTapClient{}
	r := newRunnerForTest(st, tap, "sh.tangled.*")

	if err := r.initializeCursor(context.Background()); err != nil {
		t.Fatalf("initialize cursor: %v", err)
	}
	if r.resumeCursor != 150 {
		t.Fatalf("resume cursor: got %d want 150", r.resumeCursor)
	}
	if !r.shouldSkipEvent(149) {
		t.Fatalf("expected event 149 to be skipped")
	}
	if !r.shouldSkipEvent(150) {
		t.Fatalf("expected event 150 to be skipped")
	}
	if r.shouldSkipEvent(151) {
		t.Fatalf("expected event 151 to be processed")
	}
}

func TestRunner_PersistCursorBeforeAck(t *testing.T) {
	st := newFakeStore()
	tap := &fakeTapClient{}
	r := newRunnerForTest(st, tap, "sh.tangled.*")

	acked := false
	tap.onAck = func(_ int64) { acked = true }
	st.onSetSync = func() {
		if acked {
			t.Fatalf("ack happened before cursor persisted")
		}
	}

	event := normalize.TapRecordEvent{
		ID:   901,
		Type: "record",
		Record: &normalize.TapRecord{
			DID:        "did:plc:author",
			Collection: "sh.tangled.repo",
			RKey:       "repo1",
			Action:     "create",
			CID:        "cid-1",
			Record: map[string]any{
				"name":        "repo-one",
				"description": "test repo",
			},
		},
	}

	if err := r.processEvent(context.Background(), event); err != nil {
		t.Fatalf("process event: %v", err)
	}
}
