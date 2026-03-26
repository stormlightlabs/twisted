package config

import (
	"os"
	"path/filepath"
	"testing"
)

func TestLoadRequiresRemoteTursoConfigurationByDefault(t *testing.T) {
	t.Setenv("TURSO_DATABASE_URL", "")
	t.Setenv("TURSO_AUTH_TOKEN", "")

	_, err := Load(LoadOptions{})
	if err == nil {
		t.Fatal("expected missing Turso config to fail")
	}
}

func TestLoadLocalOverridesRemoteDatabaseAndLogging(t *testing.T) {
	workDir := t.TempDir()
	t.Setenv("TURSO_DATABASE_URL", "libsql://example.turso.io")
	t.Setenv("TURSO_AUTH_TOKEN", "secret")
	t.Setenv("LOG_FORMAT", "json")

	cfg, err := Load(LoadOptions{Local: true, WorkDir: workDir})
	if err != nil {
		t.Fatalf("load config: %v", err)
	}

	wantURL := "file:" + filepath.Join(workDir, "twister-dev.db")
	if cfg.TursoURL != wantURL {
		t.Fatalf("TursoURL: got %q, want %q", cfg.TursoURL, wantURL)
	}
	if cfg.TursoToken != "" {
		t.Fatalf("TursoToken: got %q, want empty", cfg.TursoToken)
	}
	if cfg.LogFormat != "text" {
		t.Fatalf("LogFormat: got %q, want %q", cfg.LogFormat, "text")
	}
}

func TestLoadLocalUsesCurrentWorkingDirectoryWhenUnset(t *testing.T) {
	wd, err := os.Getwd()
	if err != nil {
		t.Fatalf("getwd: %v", err)
	}
	t.Setenv("TURSO_DATABASE_URL", "")
	t.Setenv("TURSO_AUTH_TOKEN", "")

	cfg, err := Load(LoadOptions{Local: true})
	if err != nil {
		t.Fatalf("load config: %v", err)
	}

	wantURL := "file:" + filepath.Join(wd, "twister-dev.db")
	if cfg.TursoURL != wantURL {
		t.Fatalf("TursoURL: got %q, want %q", cfg.TursoURL, wantURL)
	}
}

func TestLoadReadThroughDefaults(t *testing.T) {
	t.Setenv("TURSO_DATABASE_URL", "file:test.db")
	t.Setenv("TURSO_AUTH_TOKEN", "")
	t.Setenv("INDEXED_COLLECTIONS", "sh.tangled.repo,sh.tangled.repo.issue")
	t.Setenv("READ_THROUGH_MODE", "")
	t.Setenv("READ_THROUGH_COLLECTIONS", "")
	t.Setenv("READ_THROUGH_MAX_ATTEMPTS", "")

	cfg, err := Load(LoadOptions{})
	if err != nil {
		t.Fatalf("load config: %v", err)
	}
	if cfg.ReadThroughMode != "missing" {
		t.Fatalf("ReadThroughMode: got %q", cfg.ReadThroughMode)
	}
	if cfg.ReadThroughCollections != "sh.tangled.repo,sh.tangled.repo.issue" {
		t.Fatalf("ReadThroughCollections: got %q", cfg.ReadThroughCollections)
	}
	if cfg.ReadThroughMaxAttempts != 5 {
		t.Fatalf("ReadThroughMaxAttempts: got %d", cfg.ReadThroughMaxAttempts)
	}
}

func TestLoadUsesRailwayPortForBindAddresses(t *testing.T) {
	t.Setenv("TURSO_DATABASE_URL", "file:test.db")
	t.Setenv("TURSO_AUTH_TOKEN", "")
	t.Setenv("HTTP_BIND_ADDR", "")
	t.Setenv("INDEXER_HEALTH_ADDR", "")
	t.Setenv("PORT", "4567")

	cfg, err := Load(LoadOptions{})
	if err != nil {
		t.Fatalf("load config: %v", err)
	}
	if cfg.HTTPBindAddr != ":4567" {
		t.Fatalf("HTTPBindAddr: got %q, want %q", cfg.HTTPBindAddr, ":4567")
	}
	if cfg.IndexerHealthAddr != ":4567" {
		t.Fatalf("IndexerHealthAddr: got %q, want %q", cfg.IndexerHealthAddr, ":4567")
	}
}

func TestLoadPrefersExplicitBindAddressesOverRailwayPort(t *testing.T) {
	t.Setenv("TURSO_DATABASE_URL", "file:test.db")
	t.Setenv("TURSO_AUTH_TOKEN", "")
	t.Setenv("HTTP_BIND_ADDR", "0.0.0.0:8081")
	t.Setenv("INDEXER_HEALTH_ADDR", "0.0.0.0:9091")
	t.Setenv("PORT", "4567")

	cfg, err := Load(LoadOptions{})
	if err != nil {
		t.Fatalf("load config: %v", err)
	}
	if cfg.HTTPBindAddr != "0.0.0.0:8081" {
		t.Fatalf("HTTPBindAddr: got %q", cfg.HTTPBindAddr)
	}
	if cfg.IndexerHealthAddr != "0.0.0.0:9091" {
		t.Fatalf("IndexerHealthAddr: got %q", cfg.IndexerHealthAddr)
	}
}
