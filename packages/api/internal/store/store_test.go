package store_test

import (
	"context"
	"database/sql"
	"os"
	"path/filepath"
	"testing"

	"tangled.org/desertthunder.dev/twister/internal/store"
)

func TestIntegration(t *testing.T) {
	dir := t.TempDir()
	dbPath := filepath.Join(dir, "test.db")
	url := "file:" + dbPath

	db, err := store.Open(url, "")
	if err != nil {
		t.Fatalf("open: %v", err)
	}
	t.Cleanup(func() {
		db.Close()
		os.Remove(dbPath)
	})

	if err := store.Migrate(db, url); err != nil {
		t.Fatalf("migrate: %v", err)
	}

	st := store.New(db)
	ctx := context.Background()

	t.Run("upsert and get document", func(t *testing.T) {
		doc := &store.Document{
			ID:         "did:plc:abc|sh.tangled.repo|abc123",
			DID:        "did:plc:abc",
			Collection: "sh.tangled.repo",
			RKey:       "abc123",
			ATURI:      "at://did:plc:abc/sh.tangled.repo/abc123",
			CID:        "bafyreiabc",
			RecordType: "repo",
			Title:      "my-repo",
			Body:       "A test repository",
			RepoName:   "my-repo",
		}
		if err := st.UpsertDocument(ctx, doc); err != nil {
			t.Fatalf("upsert: %v", err)
		}

		got, err := st.GetDocument(ctx, doc.ID)
		if err != nil {
			t.Fatalf("get: %v", err)
		}
		if got == nil {
			t.Fatal("expected document, got nil")
		}
		if got.Title != "my-repo" {
			t.Errorf("title: got %q, want %q", got.Title, "my-repo")
		}
		if got.IndexedAt == "" {
			t.Error("indexed_at should be set by upsert")
		}
	})

	t.Run("upsert is idempotent", func(t *testing.T) {
		doc := &store.Document{
			ID:         "did:plc:abc|sh.tangled.repo|abc123",
			DID:        "did:plc:abc",
			Collection: "sh.tangled.repo",
			RKey:       "abc123",
			ATURI:      "at://did:plc:abc/sh.tangled.repo/abc123",
			CID:        "bafyreiabc2",
			RecordType: "repo",
			Title:      "my-repo-v2",
		}
		if err := st.UpsertDocument(ctx, doc); err != nil {
			t.Fatalf("upsert: %v", err)
		}
		got, err := st.GetDocument(ctx, doc.ID)
		if err != nil {
			t.Fatalf("get: %v", err)
		}
		if got.Title != "my-repo-v2" {
			t.Errorf("title: got %q, want %q", got.Title, "my-repo-v2")
		}
		if got.CID != "bafyreiabc2" {
			t.Errorf("cid: got %q, want updated CID", got.CID)
		}
	})

	t.Run("tombstone sets deleted_at", func(t *testing.T) {
		if err := st.MarkDeleted(ctx, "did:plc:abc|sh.tangled.repo|abc123"); err != nil {
			t.Fatalf("mark deleted: %v", err)
		}
		got, err := st.GetDocument(ctx, "did:plc:abc|sh.tangled.repo|abc123")
		if err != nil {
			t.Fatalf("get: %v", err)
		}
		if got.DeletedAt == "" {
			t.Error("deleted_at should be set after tombstone")
		}
	})

	t.Run("get missing document returns nil", func(t *testing.T) {
		got, err := st.GetDocument(ctx, "nonexistent")
		if err != nil {
			t.Fatalf("get: %v", err)
		}
		if got != nil {
			t.Error("expected nil for missing document")
		}
	})

	t.Run("sync state CRUD", func(t *testing.T) {
		got, err := st.GetSyncState(ctx, "tap-consumer")
		if err != nil {
			t.Fatalf("get sync state: %v", err)
		}
		if got != nil {
			t.Error("expected nil for missing sync state")
		}

		if err := st.SetSyncState(ctx, "tap-consumer", "cursor-001"); err != nil {
			t.Fatalf("set sync state: %v", err)
		}

		got, err = st.GetSyncState(ctx, "tap-consumer")
		if err != nil {
			t.Fatalf("get sync state: %v", err)
		}
		if got == nil {
			t.Fatal("expected sync state, got nil")
		}
		if got.Cursor != "cursor-001" {
			t.Errorf("cursor: got %q, want %q", got.Cursor, "cursor-001")
		}

		if err := st.SetSyncState(ctx, "tap-consumer", "cursor-002"); err != nil {
			t.Fatalf("update sync state: %v", err)
		}
		got, err = st.GetSyncState(ctx, "tap-consumer")
		if err != nil {
			t.Fatalf("get: %v", err)
		}
		if got.Cursor != "cursor-002" {
			t.Errorf("cursor after update: got %q, want %q", got.Cursor, "cursor-002")
		}
	})

	t.Run("record state upsert", func(t *testing.T) {
		uri := "at://did:plc:abc/sh.tangled.repo.issue/1"
		if err := st.UpdateRecordState(ctx, uri, "open"); err != nil {
			t.Fatalf("update record state: %v", err)
		}
		if err := st.UpdateRecordState(ctx, uri, "closed"); err != nil {
			t.Fatalf("update record state to closed: %v", err)
		}
	})

	t.Run("identity handle upsert and get", func(t *testing.T) {
		const did = "did:plc:identity1"

		handle, err := st.GetIdentityHandle(ctx, did)
		if err != nil {
			t.Fatalf("get missing identity handle: %v", err)
		}
		if handle != "" {
			t.Fatalf("expected empty missing handle, got %q", handle)
		}

		if err := st.UpsertIdentityHandle(ctx, did, "alice.tangled.org", true, "active"); err != nil {
			t.Fatalf("upsert identity handle: %v", err)
		}

		handle, err = st.GetIdentityHandle(ctx, did)
		if err != nil {
			t.Fatalf("get identity handle: %v", err)
		}
		if handle != "alice.tangled.org" {
			t.Fatalf("handle: got %q, want %q", handle, "alice.tangled.org")
		}

		if err := st.UpsertIdentityHandle(ctx, did, "alice2.tangled.org", false, "inactive"); err != nil {
			t.Fatalf("update identity handle: %v", err)
		}

		handle, err = st.GetIdentityHandle(ctx, did)
		if err != nil {
			t.Fatalf("get identity handle after update: %v", err)
		}
		if handle != "alice2.tangled.org" {
			t.Fatalf("handle after update: got %q, want %q", handle, "alice2.tangled.org")
		}
	})

	t.Run("enqueue embedding job is idempotent", func(t *testing.T) {
		doc := &store.Document{
			ID:         "did:plc:embed|sh.tangled.string|abc",
			DID:        "did:plc:embed",
			Collection: "sh.tangled.string",
			RKey:       "abc",
			ATURI:      "at://did:plc:embed/sh.tangled.string/abc",
			CID:        "bafyreienqueue",
			RecordType: "string",
			Title:      "foo.go",
			Body:       "package main",
		}
		if err := st.UpsertDocument(ctx, doc); err != nil {
			t.Fatalf("upsert doc for embedding queue: %v", err)
		}

		if err := st.EnqueueEmbeddingJob(ctx, doc.ID); err != nil {
			t.Fatalf("enqueue embedding job: %v", err)
		}
		if err := st.EnqueueEmbeddingJob(ctx, doc.ID); err != nil {
			t.Fatalf("enqueue embedding job second call: %v", err)
		}

		row := db.QueryRowContext(ctx, `SELECT status, attempts, last_error FROM embedding_jobs WHERE document_id = ?`, doc.ID)
		var (
			status    string
			attempts  int
			lastError sql.NullString
		)
		if err := row.Scan(&status, &attempts, &lastError); err != nil {
			t.Fatalf("query embedding job: %v", err)
		}
		if status != "pending" {
			t.Fatalf("status: got %q, want pending", status)
		}
		if attempts != 0 {
			t.Fatalf("attempts: got %d, want 0", attempts)
		}
		if lastError.Valid {
			t.Fatalf("last_error: got %q, want NULL", lastError.String)
		}
	})

	t.Run("follow subject discovery query", func(t *testing.T) {
		followDoc := &store.Document{
			ID:         "did:plc:owner|sh.tangled.graph.follow|f1",
			DID:        "did:plc:owner",
			Collection: "sh.tangled.graph.follow",
			RKey:       "f1",
			ATURI:      "at://did:plc:owner/sh.tangled.graph.follow/f1",
			CID:        "cid-follow",
			RecordType: "follow",
			RepoDID:    "did:plc:target",
		}
		if err := st.UpsertDocument(ctx, followDoc); err != nil {
			t.Fatalf("upsert follow doc: %v", err)
		}

		subjects, err := st.GetFollowSubjects(ctx, "did:plc:owner")
		if err != nil {
			t.Fatalf("get follow subjects: %v", err)
		}
		if len(subjects) != 1 || subjects[0] != "did:plc:target" {
			t.Fatalf("subjects: got %#v", subjects)
		}
	})

	t.Run("repo collaborator discovery query", func(t *testing.T) {
		docs := []*store.Document{
			{
				ID:         "did:plc:collab1|sh.tangled.repo.issue|i1",
				DID:        "did:plc:collab1",
				Collection: "sh.tangled.repo.issue",
				RKey:       "i1",
				ATURI:      "at://did:plc:collab1/sh.tangled.repo.issue/i1",
				CID:        "cid-c1",
				RecordType: "issue",
				RepoDID:    "did:plc:owner",
			},
			{
				ID:         "did:plc:collab2|sh.tangled.repo.pull.comment|pc1",
				DID:        "did:plc:collab2",
				Collection: "sh.tangled.repo.pull.comment",
				RKey:       "pc1",
				ATURI:      "at://did:plc:collab2/sh.tangled.repo.pull.comment/pc1",
				CID:        "cid-c2",
				RecordType: "pull_comment",
				RepoDID:    "did:plc:owner",
			},
			{
				ID:         "did:plc:owner|sh.tangled.repo.issue|i-owner",
				DID:        "did:plc:owner",
				Collection: "sh.tangled.repo.issue",
				RKey:       "i-owner",
				ATURI:      "at://did:plc:owner/sh.tangled.repo.issue/i-owner",
				CID:        "cid-owner",
				RecordType: "issue",
				RepoDID:    "did:plc:owner",
			},
		}
		for _, doc := range docs {
			if err := st.UpsertDocument(ctx, doc); err != nil {
				t.Fatalf("upsert collaborator doc %s: %v", doc.ID, err)
			}
		}

		collaborators, err := st.GetRepoCollaborators(ctx, "did:plc:owner")
		if err != nil {
			t.Fatalf("get collaborators: %v", err)
		}
		if len(collaborators) != 2 {
			t.Fatalf("collaborators length: got %d want 2 (%#v)", len(collaborators), collaborators)
		}
		got := map[string]bool{}
		for _, did := range collaborators {
			got[did] = true
		}
		if !got["did:plc:collab1"] || !got["did:plc:collab2"] {
			t.Fatalf("collaborators: got %#v", collaborators)
		}
	})

	t.Run("indexing jobs enqueue claim retry complete", func(t *testing.T) {
		job := store.IndexingJobInput{
			DocumentID: "did:plc:owner|sh.tangled.repo|repo1",
			DID:        "did:plc:owner",
			Collection: "sh.tangled.repo",
			RKey:       "repo1",
			CID:        "cid-repo1",
			RecordJSON: `{"name":"repo1"}`,
		}
		if err := st.EnqueueIndexingJob(ctx, job); err != nil {
			t.Fatalf("enqueue indexing job: %v", err)
		}
		if err := st.EnqueueIndexingJob(ctx, job); err != nil {
			t.Fatalf("enqueue indexing job second call: %v", err)
		}

		claimed, err := st.ClaimIndexingJob(ctx)
		if err != nil {
			t.Fatalf("claim indexing job: %v", err)
		}
		if claimed == nil {
			t.Fatal("expected claimed indexing job")
		}
		if claimed.DocumentID != job.DocumentID {
			t.Fatalf("claimed document id: got %q want %q", claimed.DocumentID, job.DocumentID)
		}

		if err := st.RetryIndexingJob(ctx, job.DocumentID, "9999-12-31T23:59:59Z", "boom"); err != nil {
			t.Fatalf("retry indexing job: %v", err)
		}

		none, err := st.ClaimIndexingJob(ctx)
		if err != nil {
			t.Fatalf("claim delayed indexing job: %v", err)
		}
		if none != nil {
			t.Fatalf("expected no claim before schedule time, got %#v", none)
		}

		if err := st.RetryIndexingJob(ctx, job.DocumentID, "1970-01-01T00:00:00Z", "retry-now"); err != nil {
			t.Fatalf("retry indexing job now: %v", err)
		}

		claimed, err = st.ClaimIndexingJob(ctx)
		if err != nil {
			t.Fatalf("claim retried indexing job: %v", err)
		}
		if claimed == nil {
			t.Fatal("expected claimed retried indexing job")
		}

		if err := st.CompleteIndexingJob(ctx, job.DocumentID); err != nil {
			t.Fatalf("complete indexing job: %v", err)
		}

		claimed, err = st.ClaimIndexingJob(ctx)
		if err != nil {
			t.Fatalf("claim after complete: %v", err)
		}
		if claimed != nil {
			t.Fatalf("expected no job after complete, got %#v", claimed)
		}
	})
}
