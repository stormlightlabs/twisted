package normalize_test

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	"tangled.org/desertthunder.dev/twister/internal/normalize"
)

func loadFixture(t *testing.T, name string) normalize.TapRecordEvent {
	t.Helper()
	path := filepath.Join("testdata", name)
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read fixture %s: %v", name, err)
	}
	var event normalize.TapRecordEvent
	if err := json.Unmarshal(data, &event); err != nil {
		t.Fatalf("decode fixture %s: %v", name, err)
	}
	return event
}

// TestStableID verifies deterministic ID generation.
func TestStableID(t *testing.T) {
	id := normalize.StableID("did:plc:abc", "sh.tangled.repo", "3kb3fge5lm32x")
	want := "did:plc:abc|sh.tangled.repo|3kb3fge5lm32x"
	if id != want {
		t.Errorf("StableID = %q, want %q", id, want)
	}
}

// TestParseATURI covers the happy path and malformed input.
func TestParseATURI(t *testing.T) {
	t.Run("valid", func(t *testing.T) {
		did, col, rkey, err := normalize.ParseATURI("at://did:plc:abc123/sh.tangled.repo/3kb3fge5lm32x")
		if err != nil {
			t.Fatal(err)
		}
		if did != "did:plc:abc123" || col != "sh.tangled.repo" || rkey != "3kb3fge5lm32x" {
			t.Errorf("got (%s, %s, %s)", did, col, rkey)
		}
	})

	t.Run("invalid", func(t *testing.T) {
		_, _, _, err := normalize.ParseATURI("not-an-at-uri")
		if err == nil {
			t.Error("expected error for malformed AT-URI")
		}
	})

	t.Run("missing rkey", func(t *testing.T) {
		_, _, _, err := normalize.ParseATURI("at://did:plc:abc/sh.tangled.repo")
		if err == nil {
			t.Error("expected error for AT-URI missing rkey segment")
		}
	})
}

// TestRepoAdapter verifies field mapping for sh.tangled.repo.
func TestRepoAdapter(t *testing.T) {
	event := loadFixture(t, "repo.json")
	adapter := &normalize.RepoAdapter{}

	if adapter.Collection() != "sh.tangled.repo" {
		t.Errorf("Collection = %q", adapter.Collection())
	}
	if adapter.RecordType() != "repo" {
		t.Errorf("RecordType = %q", adapter.RecordType())
	}

	doc, err := adapter.Normalize(event)
	if err != nil {
		t.Fatalf("Normalize: %v", err)
	}

	if doc.ID != "did:plc:abc123|sh.tangled.repo|3kb3fge5lm32x" {
		t.Errorf("ID = %q", doc.ID)
	}
	if doc.Title != "my-project" {
		t.Errorf("Title = %q", doc.Title)
	}
	if doc.Body != "A cool project for searching things" {
		t.Errorf("Body = %q", doc.Body)
	}
	if doc.RepoName != "my-project" {
		t.Errorf("RepoName = %q", doc.RepoName)
	}
	if doc.RepoDID != "did:plc:abc123" {
		t.Errorf("RepoDID = %q", doc.RepoDID)
	}
	if doc.TagsJSON != `["go","search","atproto"]` {
		t.Errorf("TagsJSON = %q", doc.TagsJSON)
	}
	if doc.RecordType != "repo" {
		t.Errorf("RecordType = %q", doc.RecordType)
	}
	if doc.ATURI != "at://did:plc:abc123/sh.tangled.repo/3kb3fge5lm32x" {
		t.Errorf("ATURI = %q", doc.ATURI)
	}

	// Searchable
	if !adapter.Searchable(event.Record.Record) {
		t.Error("Searchable returned false for a named repo")
	}
	if adapter.Searchable(map[string]any{"name": ""}) {
		t.Error("Searchable returned true for empty name")
	}
}

// TestIssueAdapter verifies field mapping for sh.tangled.repo.issue.
func TestIssueAdapter(t *testing.T) {
	event := loadFixture(t, "issue.json")
	adapter := &normalize.IssueAdapter{}

	doc, err := adapter.Normalize(event)
	if err != nil {
		t.Fatalf("Normalize: %v", err)
	}

	if doc.Title != "Fix search ranking for repos" {
		t.Errorf("Title = %q", doc.Title)
	}
	if doc.RepoDID != "did:plc:repoowner" {
		t.Errorf("RepoDID = %q, want did:plc:repoowner", doc.RepoDID)
	}
	if doc.RecordType != "issue" {
		t.Errorf("RecordType = %q", doc.RecordType)
	}
	if len(doc.Summary) > 200 {
		t.Errorf("Summary too long: %d chars", len(doc.Summary))
	}
	if doc.TagsJSON != "[]" {
		t.Errorf("TagsJSON = %q, want []", doc.TagsJSON)
	}

	// Deterministic output
	doc2, _ := adapter.Normalize(event)
	if doc.ID != doc2.ID {
		t.Error("Normalize is not deterministic")
	}
}

// TestIssueAdapter_BadATURI ensures malformed repo AT-URI returns an error.
func TestIssueAdapter_BadATURI(t *testing.T) {
	event := normalize.TapRecordEvent{
		ID:   9999,
		Type: "record",
		Record: &normalize.TapRecord{
			DID:        "did:plc:abc",
			Collection: "sh.tangled.repo.issue",
			RKey:       "rkey1",
			CID:        "cid1",
			Record: map[string]any{
				"title": "Test",
				"body":  "Body",
				"repo":  "not-an-at-uri",
			},
		},
	}
	adapter := &normalize.IssueAdapter{}
	_, err := adapter.Normalize(event)
	if err == nil {
		t.Error("expected error for invalid repo AT-URI")
	}
}

// TestPullAdapter verifies field mapping for sh.tangled.repo.pull.
func TestPullAdapter(t *testing.T) {
	event := loadFixture(t, "pull.json")
	adapter := &normalize.PullAdapter{}

	doc, err := adapter.Normalize(event)
	if err != nil {
		t.Fatalf("Normalize: %v", err)
	}

	if doc.Title != "Add star-based ranking signal" {
		t.Errorf("Title = %q", doc.Title)
	}
	if doc.RepoDID != "did:plc:repoowner" {
		t.Errorf("RepoDID = %q, want did:plc:repoowner", doc.RepoDID)
	}
	if doc.RecordType != "pull" {
		t.Errorf("RecordType = %q", doc.RecordType)
	}
}

// TestPullAdapter_NoTarget verifies that a missing target is handled gracefully.
func TestPullAdapter_NoTarget(t *testing.T) {
	event := normalize.TapRecordEvent{
		ID:   9998,
		Type: "record",
		Record: &normalize.TapRecord{
			DID:        "did:plc:abc",
			Collection: "sh.tangled.repo.pull",
			RKey:       "rkey2",
			CID:        "cid2",
			Record: map[string]any{
				"title": "PR without target",
				"body":  "Body",
			},
		},
	}
	adapter := &normalize.PullAdapter{}
	doc, err := adapter.Normalize(event)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if doc.RepoDID != "" {
		t.Errorf("RepoDID = %q, want empty", doc.RepoDID)
	}
}

// TestStringAdapter verifies field mapping for sh.tangled.string.
func TestStringAdapter(t *testing.T) {
	event := loadFixture(t, "string.json")
	adapter := &normalize.StringAdapter{}

	doc, err := adapter.Normalize(event)
	if err != nil {
		t.Fatalf("Normalize: %v", err)
	}

	if doc.Title != "search.go" {
		t.Errorf("Title = %q", doc.Title)
	}
	if doc.Summary != "BM25 scoring function for full-text search" {
		t.Errorf("Summary = %q", doc.Summary)
	}
	if doc.RecordType != "string" {
		t.Errorf("RecordType = %q", doc.RecordType)
	}

	// Searchable only when contents is non-empty
	if !adapter.Searchable(event.Record.Record) {
		t.Error("Searchable = false for non-empty contents")
	}
	if adapter.Searchable(map[string]any{"contents": ""}) {
		t.Error("Searchable = true for empty contents")
	}
}

// TestProfileAdapter verifies field mapping for sh.tangled.actor.profile.
func TestProfileAdapter(t *testing.T) {
	event := loadFixture(t, "profile.json")
	adapter := &normalize.ProfileAdapter{}

	doc, err := adapter.Normalize(event)
	if err != nil {
		t.Fatalf("Normalize: %v", err)
	}

	if doc.Body != "Building search infrastructure for the open social web. Go enthusiast." {
		t.Errorf("Body = %q", doc.Body)
	}
	if doc.Summary == "" {
		t.Error("Summary is empty; expected description + location")
	}
	if doc.RecordType != "profile" {
		t.Errorf("RecordType = %q", doc.RecordType)
	}
	// Title is intentionally empty (handle resolved separately via identity events)
	if doc.Title != "" {
		t.Errorf("Title = %q, want empty (handle resolved externally)", doc.Title)
	}

	// Searchable only when description is non-empty
	if !adapter.Searchable(event.Record.Record) {
		t.Error("Searchable = false for non-empty description")
	}
	if adapter.Searchable(map[string]any{"description": ""}) {
		t.Error("Searchable = true for empty description")
	}
}

func TestFollowAdapter(t *testing.T) {
	event := loadFixture(t, "follow.json")
	adapter := &normalize.FollowAdapter{}

	doc, err := adapter.Normalize(event)
	if err != nil {
		t.Fatalf("Normalize: %v", err)
	}

	if doc.RecordType != "follow" {
		t.Errorf("RecordType = %q", doc.RecordType)
	}
	if doc.RepoDID != "did:plc:bob" {
		t.Errorf("RepoDID = %q, want did:plc:bob", doc.RepoDID)
	}
	if adapter.Searchable(event.Record.Record) {
		t.Error("Searchable = true, want false")
	}
}

func TestIssueCommentAdapter(t *testing.T) {
	event := loadFixture(t, "issue_comment.json")
	adapter := &normalize.IssueCommentAdapter{}

	doc, err := adapter.Normalize(event)
	if err != nil {
		t.Fatalf("Normalize: %v", err)
	}

	if doc.RecordType != "issue_comment" {
		t.Errorf("RecordType = %q", doc.RecordType)
	}
	if doc.RepoDID != "did:plc:repoowner" {
		t.Errorf("RepoDID = %q, want did:plc:repoowner", doc.RepoDID)
	}
	if !adapter.Searchable(event.Record.Record) {
		t.Error("Searchable = false for non-empty comment body")
	}
}

func TestPullCommentAdapter(t *testing.T) {
	event := loadFixture(t, "pull_comment.json")
	adapter := &normalize.PullCommentAdapter{}

	doc, err := adapter.Normalize(event)
	if err != nil {
		t.Fatalf("Normalize: %v", err)
	}

	if doc.RecordType != "pull_comment" {
		t.Errorf("RecordType = %q", doc.RecordType)
	}
	if doc.RepoDID != "did:plc:repoowner" {
		t.Errorf("RepoDID = %q, want did:plc:repoowner", doc.RepoDID)
	}
	if !adapter.Searchable(event.Record.Record) {
		t.Error("Searchable = false for non-empty comment body")
	}
}

// TestIssueStateHandler verifies record_state extraction.
func TestIssueStateHandler(t *testing.T) {
	event := loadFixture(t, "issue_state.json")
	handler := &normalize.IssueStateHandler{}

	if handler.Collection() != "sh.tangled.repo.issue.state" {
		t.Errorf("Collection = %q", handler.Collection())
	}

	update, err := handler.HandleState(event)
	if err != nil {
		t.Fatalf("HandleState: %v", err)
	}
	if update.SubjectURI != "at://did:plc:abc123/sh.tangled.repo.issue/3kb3fge5lm32y" {
		t.Errorf("SubjectURI = %q", update.SubjectURI)
	}
	if update.State != "closed" {
		t.Errorf("State = %q, want closed", update.State)
	}
}

// TestPullStatusHandler verifies record_state extraction for PRs.
func TestPullStatusHandler(t *testing.T) {
	event := loadFixture(t, "pull_status.json")
	handler := &normalize.PullStatusHandler{}

	if handler.Collection() != "sh.tangled.repo.pull.status" {
		t.Errorf("Collection = %q", handler.Collection())
	}

	update, err := handler.HandleState(event)
	if err != nil {
		t.Fatalf("HandleState: %v", err)
	}
	if update.State != "merged" {
		t.Errorf("State = %q, want merged", update.State)
	}
}

// TestIssueStateHandler_MissingFields ensures errors on missing required fields.
func TestIssueStateHandler_MissingFields(t *testing.T) {
	handler := &normalize.IssueStateHandler{}

	t.Run("missing subject", func(t *testing.T) {
		event := normalize.TapRecordEvent{
			Record: &normalize.TapRecord{
				Record: map[string]any{"status": "closed"},
			},
		}
		_, err := handler.HandleState(event)
		if err == nil {
			t.Error("expected error for missing subject")
		}
	})

	t.Run("missing status", func(t *testing.T) {
		event := normalize.TapRecordEvent{
			Record: &normalize.TapRecord{
				Record: map[string]any{"subject": "at://did:plc:x/col/rkey"},
			},
		}
		_, err := handler.HandleState(event)
		if err == nil {
			t.Error("expected error for missing status")
		}
	})
}

// TestRegistry verifies adapter and state handler lookup.
func TestRegistry(t *testing.T) {
	reg := normalize.NewRegistry()

	collections := []string{
		"sh.tangled.repo",
		"sh.tangled.repo.issue",
		"sh.tangled.repo.pull",
		"sh.tangled.repo.issue.comment",
		"sh.tangled.repo.pull.comment",
		"sh.tangled.graph.follow",
		"sh.tangled.string",
		"sh.tangled.actor.profile",
	}
	for _, col := range collections {
		if _, ok := reg.Adapter(col); !ok {
			t.Errorf("no adapter registered for %q", col)
		}
	}

	stateCollections := []string{
		"sh.tangled.repo.issue.state",
		"sh.tangled.repo.pull.status",
	}
	for _, col := range stateCollections {
		if _, ok := reg.StateHandler(col); !ok {
			t.Errorf("no state handler registered for %q", col)
		}
	}

	// Unsupported collections return false
	if _, ok := reg.Adapter("sh.tangled.unknown"); ok {
		t.Error("expected no adapter for unknown collection")
	}
}
