package store_test

import (
	"context"
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

	if err := store.Migrate(db); err != nil {
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
}
