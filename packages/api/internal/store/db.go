package store

import (
	"database/sql"
	"embed"
	"fmt"
	"log/slog"
	"sort"
	"strings"
	"time"

	_ "github.com/jackc/pgx/v5/stdlib"
	_ "modernc.org/sqlite"
)

//go:embed migrations/*.sql migrations_postgres/*.sql
var migrationsFS embed.FS

type Backend string

const (
	BackendPostgres Backend = "postgres"
	BackendSQLite   Backend = "sqlite"
)

type migrationMode struct {
	backend           Backend
	targetDescription string
}

// DetectBackend returns the configured database backend for the given URL.
func DetectBackend(url string) Backend {
	if strings.HasPrefix(url, "file:") {
		return BackendSQLite
	}
	return BackendPostgres
}

// Open establishes a connection to the database.
func Open(url string) (*sql.DB, error) {
	driver, dsn := driverAndDSN(url)
	db, err := sql.Open(driver, dsn)
	if err != nil {
		return nil, fmt.Errorf("open db: %w", err)
	}
	switch DetectBackend(url) {
	case BackendSQLite:
		if err := configureLocalSQLite(db); err != nil {
			db.Close()
			return nil, err
		}
	case BackendPostgres:
		configurePostgresPool(db)
	}
	if err := db.Ping(); err != nil {
		db.Close()
		return nil, fmt.Errorf("ping db: %w", err)
	}
	return db, nil
}

func configureLocalSQLite(db *sql.DB) error {
	if _, err := db.Exec(`PRAGMA busy_timeout = 5000`); err != nil {
		return fmt.Errorf("configure sqlite busy_timeout: %w", err)
	}
	if _, err := db.Exec(`PRAGMA journal_mode = WAL`); err != nil {
		return fmt.Errorf("configure sqlite wal mode: %w", err)
	}
	if _, err := db.Exec(`PRAGMA synchronous = NORMAL`); err != nil {
		return fmt.Errorf("configure sqlite synchronous mode: %w", err)
	}

	db.SetMaxOpenConns(1)
	db.SetMaxIdleConns(1)
	db.SetConnMaxLifetime(0)
	db.SetConnMaxIdleTime(5 * time.Minute)
	return nil
}

func configurePostgresPool(db *sql.DB) {
	db.SetMaxOpenConns(10)
	db.SetMaxIdleConns(10)
	db.SetConnMaxLifetime(30 * time.Minute)
	db.SetConnMaxIdleTime(5 * time.Minute)
}

func driverAndDSN(url string) (driver, dsn string) {
	if strings.HasPrefix(url, "file:") {
		return "sqlite", strings.TrimPrefix(url, "file:")
	}
	return "pgx", url
}

// Migrate runs embedded SQL migrations for the selected backend.
func Migrate(db *sql.DB, url string) error {
	switch DetectBackend(url) {
	case BackendSQLite:
		return migrateSQLite(db, url)
	default:
		return migratePostgres(db)
	}
}

func migrateSQLite(db *sql.DB, url string) error {
	if _, err := db.Exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
		filename   TEXT PRIMARY KEY,
		applied_at TEXT NOT NULL
	)`); err != nil {
		return fmt.Errorf("create schema_migrations table: %w", err)
	}

	if err := backfillSQLiteMigrationHistory(db); err != nil {
		return fmt.Errorf("backfill migration history: %w", err)
	}

	mode := migrationMode{
		backend:           BackendSQLite,
		targetDescription: migrationTargetDescription(url),
	}
	return runMigrations(db, "migrations", "?", mode)
}

func migratePostgres(db *sql.DB) error {
	if _, err := db.Exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
		filename   TEXT PRIMARY KEY,
		applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
	)`); err != nil {
		return fmt.Errorf("create schema_migrations table: %w", err)
	}

	mode := migrationMode{
		backend:           BackendPostgres,
		targetDescription: "postgresql",
	}
	return runMigrations(db, "migrations_postgres", "$", mode)
}

func runMigrations(db *sql.DB, dir, placeholderPrefix string, mode migrationMode) error {
	entries, err := migrationsFS.ReadDir(dir)
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
		query := `SELECT COUNT(*) FROM schema_migrations WHERE filename = ?`
		args := []any{entry.Name()}
		if placeholderPrefix == "$" {
			query = `SELECT COUNT(*) FROM schema_migrations WHERE filename = $1`
		}
		if err := db.QueryRow(query, args...).Scan(&already); err != nil {
			return fmt.Errorf("check migration %s: %w", entry.Name(), err)
		}
		if already > 0 {
			slog.Debug("migration already applied, skipping", "file", entry.Name())
			continue
		}

		data, err := migrationsFS.ReadFile(dir + "/" + entry.Name())
		if err != nil {
			return fmt.Errorf("read migration %s: %w", entry.Name(), err)
		}
		if err := execMigration(db, entry.Name(), string(data), mode); err != nil {
			return err
		}

		insert := `INSERT INTO schema_migrations (filename, applied_at) VALUES (?, datetime('now'))`
		if placeholderPrefix == "$" {
			insert = `INSERT INTO schema_migrations (filename) VALUES ($1)`
		}
		if _, err := db.Exec(insert, entry.Name()); err != nil {
			return fmt.Errorf("record migration %s: %w", entry.Name(), err)
		}
		slog.Info("migration applied", "file", entry.Name())
	}
	return nil
}

func backfillSQLiteMigrationHistory(db *sql.DB) error {
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
		mark("003_documents_fts5.sql")
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
			if mode.backend == BackendSQLite {
				upper := strings.ToUpper(stmt)
				if strings.Contains(upper, "LIBSQL_VECTOR_IDX") {
					slog.Debug("migration: skipping unsupported vector index DDL",
						"migration", name,
					)
					continue
				}
				if strings.Contains(upper, "CREATE VIRTUAL TABLE") &&
					strings.Contains(upper, "USING FTS5") {
					return fmt.Errorf(
						"migration %s: SQLite FTS5 statement failed on %s: %w\nstatement: %s",
						name, mode.targetDescription, err, stmt,
					)
				}
			}
			return fmt.Errorf("migration %s: exec failed: %w\nstatement: %s", name, err, stmt)
		}
	}
	return nil
}

func migrationTargetDescription(url string) string {
	switch DetectBackend(url) {
	case BackendSQLite:
		return "local SQLite"
	default:
		return "postgresql"
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
