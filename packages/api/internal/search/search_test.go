package search_test

import (
	"context"
	"os"
	"path/filepath"
	"testing"

	"tangled.org/desertthunder.dev/twister/internal/search"
	"tangled.org/desertthunder.dev/twister/internal/store"
)

func TestKeywordSearchUsesLegacySQLiteSearchIndex(t *testing.T) {
	dir := t.TempDir()
	dbPath := filepath.Join(dir, "search.db")
	url := "file:" + dbPath

	db, err := store.Open(url)
	if err != nil {
		t.Fatalf("open: %v", err)
	}
	t.Cleanup(func() {
		_ = db.Close()
		_ = os.Remove(dbPath)
	})

	if err := store.Migrate(db, url); err != nil {
		t.Fatalf("migrate: %v", err)
	}

	st := store.New(url, db)
	repo := search.NewRepository(url, db)
	ctx := context.Background()

	doc := &store.Document{
		ID:           "did:plc:abc|sh.tangled.repo|desert",
		DID:          "did:plc:abc",
		Collection:   "sh.tangled.repo",
		RKey:         "desert",
		ATURI:        "at://did:plc:abc/sh.tangled.repo/desert",
		CID:          "bafyreidesert",
		RecordType:   "repo",
		Title:        "desert-runner",
		Body:         "desert search repository",
		Summary:      "index me",
		RepoName:     "desert-runner",
		AuthorHandle: "owais.tangled.org",
	}
	if err := st.UpsertDocument(ctx, doc); err != nil {
		t.Fatalf("upsert doc: %v", err)
	}

	resp, err := repo.Keyword(ctx, search.Params{Query: "desert", Limit: 10})
	if err != nil {
		t.Fatalf("keyword search: %v", err)
	}
	if resp.Total != 1 {
		t.Fatalf("total: got %d want 1", resp.Total)
	}
	if len(resp.Results) != 1 {
		t.Fatalf("results length: got %d want 1", len(resp.Results))
	}
	if resp.Results[0].ID != doc.ID {
		t.Fatalf("result id: got %q want %q", resp.Results[0].ID, doc.ID)
	}
	if resp.Results[0].BodySnippet == "" {
		t.Fatal("expected body snippet")
	}

	if err := st.MarkDeleted(ctx, doc.ID); err != nil {
		t.Fatalf("mark deleted: %v", err)
	}

	resp, err = repo.Keyword(ctx, search.Params{Query: "desert", Limit: 10})
	if err != nil {
		t.Fatalf("keyword search after delete: %v", err)
	}
	if resp.Total != 0 || len(resp.Results) != 0 {
		t.Fatalf("expected no results after delete, got total=%d len=%d", resp.Total, len(resp.Results))
	}
}
