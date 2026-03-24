package store

import (
	"database/sql"
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
