package store

import (
	"database/sql"
	"embed"
	"fmt"
	"log/slog"
	"sort"
	"strings"

	_ "github.com/tursodatabase/libsql-client-go/libsql"
	_ "modernc.org/sqlite"
)

//go:embed migrations/*.sql
var migrationsFS embed.FS

var extensionMigrationNoticeLogged bool

type migrationMode struct {
	allowTursoExtensionSkip bool
	targetDescription       string
}

// Open establishes a connection to the database.
// For remote Turso URLs (libsql:// or https://) it uses the libsql-client-go driver.
// For local file: URLs it uses the pure-Go SQLite driver (no CGo required).
func Open(url, token string) (*sql.DB, error) {
	driver, dsn := driverAndDSN(url, token)
	db, err := sql.Open(driver, dsn)
	if err != nil {
		return nil, fmt.Errorf("open db: %w", err)
	}
	if err := db.Ping(); err != nil {
		db.Close()
		return nil, fmt.Errorf("ping db: %w", err)
	}
	return db, nil
}

// driverAndDSN returns the sql driver name and DSN for the given URL.
// file: URLs use the pure-Go "sqlite" driver; all others use "libsql".
func driverAndDSN(url, token string) (driver, dsn string) {
	if strings.HasPrefix(url, "file:") {
		return "sqlite", strings.TrimPrefix(url, "file:")
	}
	if token == "" || strings.Contains(url, "?") {
		return "libsql", url
	}
	return "libsql", url + "?authToken=" + token
}

// Migrate runs all embedded SQL migration files in order, skipping any that
// have already been applied. Applied filenames are recorded in the
// schema_migrations table so re-runs are idempotent.
func Migrate(db *sql.DB, url string) error {
	if _, err := db.Exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
		filename   TEXT PRIMARY KEY,
		applied_at TEXT NOT NULL
	)`); err != nil {
		return fmt.Errorf("create schema_migrations table: %w", err)
	}

	if err := backfillMigrationHistory(db); err != nil {
		return fmt.Errorf("backfill migration history: %w", err)
	}

	mode := migrationMode{
		allowTursoExtensionSkip: strings.HasPrefix(url, "file:"),
		targetDescription:       migrationTargetDescription(url),
	}
	entries, err := migrationsFS.ReadDir("migrations")
	if err != nil {
		return fmt.Errorf("read migrations dir: %w", err)
	}
	sort.Slice(entries, func(i, j int) bool {
		return entries[i].Name() < entries[j].Name()
	})
	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".sql") {
			continue
		}
		var already int
		_ = db.QueryRow(`SELECT COUNT(*) FROM schema_migrations WHERE filename = ?`, entry.Name()).Scan(&already)
		if already > 0 {
			slog.Debug("migration already applied, skipping", "file", entry.Name())
			continue
		}
		data, err := migrationsFS.ReadFile("migrations/" + entry.Name())
		if err != nil {
			return fmt.Errorf("read migration %s: %w", entry.Name(), err)
		}
		if err := execMigration(db, entry.Name(), string(data), mode); err != nil {
			return err
		}
		if _, err := db.Exec(
			`INSERT INTO schema_migrations (filename, applied_at) VALUES (?, datetime('now'))`,
			entry.Name(),
		); err != nil {
			return fmt.Errorf("record migration %s: %w", entry.Name(), err)
		}
		slog.Info("migration applied", "file", entry.Name())
	}
	return nil
}

// backfillMigrationHistory records already-applied migrations for databases
// that pre-date the schema_migrations tracking table. It is a no-op if the
// table already has any entries (i.e. tracking was already in place).
func backfillMigrationHistory(db *sql.DB) error {
	var count int
	if err := db.QueryRow(`SELECT COUNT(*) FROM schema_migrations`).Scan(&count); err != nil || count > 0 {
		return nil
	}

	if !sqliteTableExists(db, "documents") {
		return nil
	}

	mark := func(filename string) {
		_, _ = db.Exec(
			`INSERT OR IGNORE INTO schema_migrations (filename, applied_at) VALUES (?, datetime('now'))`,
			filename,
		)
	}

	mark("001_initial.sql")

	if sqliteTableExists(db, "identity_handles") {
		mark("002_identity_handles.sql")
	}

	if sqliteTableExists(db, "documents_fts") {
		mark("003_documents_fts.sql")
	}

	if sqliteColumnExists(db, "documents", "web_url") {
		mark("004_web_url.sql")
	}

	return nil
}

func sqliteTableExists(db *sql.DB, table string) bool {
	var n int
	_ = db.QueryRow(
		`SELECT COUNT(*) FROM sqlite_master WHERE type IN ('table','view') AND name = ?`, table,
	).Scan(&n)
	return n > 0
}

func sqliteColumnExists(db *sql.DB, table, column string) bool {
	var n int
	_ = db.QueryRow(
		`SELECT COUNT(*) FROM pragma_table_info(?) WHERE name = ?`, table, column,
	).Scan(&n)
	return n > 0
}

func execMigration(db *sql.DB, name, content string, mode migrationMode) error {
	for _, stmt := range splitStatements(content) {
		if _, err := db.Exec(stmt); err != nil {
			upper := strings.ToUpper(stmt)
			if strings.Contains(upper, "LIBSQL_VECTOR_IDX") {
				if !extensionMigrationNoticeLogged {
					extensionMigrationNoticeLogged = true
					slog.Info("migration: skipping unsupported extension index",
						"migration", name,
						"reason", "database engine does not support vector index DDL in this environment",
					)
				}
				continue
			}
			if strings.Contains(upper, "CREATE VIRTUAL TABLE") && strings.Contains(upper, "USING FTS5") {
				return fmt.Errorf(
					"migration %s: SQLite FTS5 statement failed on %s: %w\nstatement: %s\nhint: this app uses SQLite FTS5 on Turso Cloud. Enable SQLite extensions for the Turso group/database before rerunning the service",
					name, mode.targetDescription, err, stmt,
				)
			}
			return fmt.Errorf("migration %s: exec failed: %w\nstatement: %s", name, err, stmt)
		}
	}
	return nil
}

func migrationTargetDescription(url string) string {
	switch {
	case strings.HasPrefix(url, "file:"):
		return "local SQLite"
	case strings.HasPrefix(url, "libsql://"), strings.HasPrefix(url, "https://"):
		return "remote Turso/libSQL"
	default:
		return "database"
	}
}

func splitStatements(content string) []string {
	var stmts []string
	for _, s := range strings.Split(content, ";") {
		s = strings.TrimSpace(s)
		if s != "" {
			stmts = append(stmts, s)
		}
	}
	return stmts
}
