package backfill

import (
	"os"
	"path/filepath"
	"testing"
)

func TestParseSeedFile(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "seeds.txt")
	content := "\n# comment\ndid:plc:one\nalice.tangled.sh\ndid:plc:one\n\n"
	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		t.Fatalf("write seed file: %v", err)
	}

	entries, err := parseSeedFile(path)
	if err != nil {
		t.Fatalf("parse seed file: %v", err)
	}
	if len(entries) != 2 {
		t.Fatalf("entries length: got %d want 2", len(entries))
	}
	if !entries[0].isDID {
		t.Fatalf("first entry should be did")
	}
	if entries[1].isDID {
		t.Fatalf("second entry should be handle")
	}
}

func TestParseSeedInput_FilePath(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "seeds.txt")
	content := "did:plc:one\nhandle.example\n"
	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		t.Fatalf("write seed file: %v", err)
	}

	entries, err := parseSeedInput(path)
	if err != nil {
		t.Fatalf("parse seed input from file: %v", err)
	}
	if len(entries) != 2 {
		t.Fatalf("entries length: got %d want 2", len(entries))
	}
}

func TestParseSeedInput_CommaSeparated(t *testing.T) {
	entries, err := parseSeedInput("anirudh.fi, atprotocol.dev, did:plc:abc")
	if err != nil {
		t.Fatalf("parse comma-separated seeds: %v", err)
	}
	if len(entries) != 3 {
		t.Fatalf("entries length: got %d want 3", len(entries))
	}
	if !entries[2].isDID {
		t.Fatalf("expected third entry to be did")
	}
}

func TestParseSeedInput_SingleInline(t *testing.T) {
	entries, err := parseSeedInput("tangled.org")
	if err != nil {
		t.Fatalf("parse single inline seed: %v", err)
	}
	if len(entries) != 1 {
		t.Fatalf("entries length: got %d want 1", len(entries))
	}
	if entries[0].raw != "tangled.org" {
		t.Fatalf("entry: got %q", entries[0].raw)
	}
}
