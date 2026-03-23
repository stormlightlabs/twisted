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

// Migrate runs all embedded SQL migration files in order.
func Migrate(db *sql.DB) error {
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
		data, err := migrationsFS.ReadFile("migrations/" + entry.Name())
		if err != nil {
			return fmt.Errorf("read migration %s: %w", entry.Name(), err)
		}
		if err := execMigration(db, entry.Name(), string(data)); err != nil {
			return err
		}
		slog.Info("migration applied", "file", entry.Name())
	}
	return nil
}

func execMigration(db *sql.DB, name, content string) error {
	for _, stmt := range splitStatements(content) {
		if _, err := db.Exec(stmt); err != nil {
			upper := strings.ToUpper(stmt)
			if strings.Contains(upper, "USING FTS") || strings.Contains(upper, "LIBSQL_VECTOR_IDX") {
				slog.Warn("migration: skipping extension index (not supported in this environment)",
					"migration", name, "err", err)
				continue
			}
			return fmt.Errorf("migration %s: exec failed: %w\nstatement: %s", name, err, stmt)
		}
	}
	return nil
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
