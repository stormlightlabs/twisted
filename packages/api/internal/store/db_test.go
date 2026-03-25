package store

import (
	"database/sql"
	"path/filepath"
	"strings"
	"testing"

	_ "modernc.org/sqlite"
)

func TestExecMigrationSkipsTursoExtensionDDLForLocalSQLite(t *testing.T) {
	db, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })

	err = execMigration(db, "003_documents_fts5.sql", "CREATE VIRTUAL TABLE documents_fts USING fts5(title);", migrationMode{
		allowTursoExtensionSkip: true,
		targetDescription:       "local SQLite",
	})
	if err != nil {
		t.Fatalf("expected local SQLite migration to create FTS5 table: %v", err)
	}
}

func TestExecMigrationFailsForRemoteWhenNativeFTSUnavailable(t *testing.T) {
	db, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })

	err = execMigration(db, "003_documents_fts5.sql", "CREATE VIRTUAL TABLE documents_fts USING fts5(", migrationMode{
		allowTursoExtensionSkip: false,
		targetDescription:       "remote Turso/libSQL",
	})
	if err == nil {
		t.Fatal("expected remote migration to fail when FTS5 is unavailable")
	}
	if !strings.Contains(err.Error(), "uses SQLite FTS5 on Turso Cloud") {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestOpenLocalSQLiteAppliesPragmasAndPoolLimits(t *testing.T) {
	path := filepath.Join(t.TempDir(), "local.db")
	db, err := Open("file:"+path, "")
	if err != nil {
		t.Fatalf("open local sqlite: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })

	if got := db.Stats().MaxOpenConnections; got != 1 {
		t.Fatalf("max open conns: got %d, want 1", got)
	}

	var mode string
	if err := db.QueryRow(`PRAGMA journal_mode`).Scan(&mode); err != nil {
		t.Fatalf("pragma journal_mode: %v", err)
	}
	if !strings.EqualFold(mode, "wal") {
		t.Fatalf("journal_mode: got %q, want wal", mode)
	}

	var timeout int
	if err := db.QueryRow(`PRAGMA busy_timeout`).Scan(&timeout); err != nil {
		t.Fatalf("pragma busy_timeout: %v", err)
	}
	if timeout != 5000 {
		t.Fatalf("busy_timeout: got %d, want 5000", timeout)
	}
}
