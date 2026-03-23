package backfill

import (
	"context"
	"io"
	"log/slog"
	"os"
	"path/filepath"
	"testing"
)

type fakeStore struct {
	collaborators map[string][]string
}

func (f *fakeStore) GetRepoCollaborators(_ context.Context, did string) ([]string, error) {
	return f.collaborators[did], nil
}

type fakeFollowFetcher struct {
	follows map[string][]string
}

func (f *fakeFollowFetcher) ListFollowSubjects(_ context.Context, did string) ([]string, error) {
	return f.follows[did], nil
}

type fakeTapAdmin struct {
	statuses map[string]RepoStatus
	added    [][]string
}

func (f *fakeTapAdmin) RepoStatus(_ context.Context, did string) (RepoStatus, error) {
	if status, ok := f.statuses[did]; ok {
		return status, nil
	}
	return RepoStatus{Found: false, Tracked: false}, nil
}

func (f *fakeTapAdmin) AddRepos(_ context.Context, dids []string) error {
	batch := make([]string, len(dids))
	copy(batch, dids)
	f.added = append(f.added, batch)
	return nil
}

type fakeResolver struct {
	mapping map[string]string
}

func (r *fakeResolver) Resolve(_ context.Context, handle string) (string, error) {
	if did, ok := r.mapping[handle]; ok {
		return did, nil
	}
	return "", io.EOF
}

func TestRunner_DiscoveryAndSubmit(t *testing.T) {
	st := &fakeStore{
		collaborators: map[string][]string{
			"did:plc:seed": {"did:plc:c1"},
		},
	}
	follows := &fakeFollowFetcher{follows: map[string][]string{"did:plc:seed": {"did:plc:f1"}}}
	tap := &fakeTapAdmin{statuses: map[string]RepoStatus{"did:plc:f1": {Found: true, Tracked: true, Backfilled: true}}}
	resolver := &fakeResolver{mapping: map[string]string{"alice.tangled.sh": "did:plc:seed"}}
	log := slog.New(slog.NewTextHandler(io.Discard, nil))
	r := NewRunnerWithDeps(st, tap, resolver, follows, log)

	dir := t.TempDir()
	seedsPath := filepath.Join(dir, "seeds.txt")
	if err := os.WriteFile(seedsPath, []byte("alice.tangled.sh\n"), 0o644); err != nil {
		t.Fatalf("write seeds: %v", err)
	}

	err := r.Run(context.Background(), Options{
		SeedsPath:   seedsPath,
		MaxHops:     1,
		Concurrency: 2,
		BatchSize:   2,
	})
	if err != nil {
		t.Fatalf("run backfill: %v", err)
	}

	if len(tap.added) != 1 {
		t.Fatalf("expected one batch, got %d", len(tap.added))
	}
	if len(tap.added[0]) != 2 {
		t.Fatalf("expected 2 dids submitted, got %#v", tap.added[0])
	}
}

func TestRunner_DryRunSkipsMutations(t *testing.T) {
	st := &fakeStore{collaborators: map[string][]string{}}
	follows := &fakeFollowFetcher{follows: map[string][]string{}}
	tap := &fakeTapAdmin{statuses: map[string]RepoStatus{}}
	resolver := &fakeResolver{mapping: map[string]string{"alice.tangled.sh": "did:plc:seed"}}
	log := slog.New(slog.NewTextHandler(io.Discard, nil))
	r := NewRunnerWithDeps(st, tap, resolver, follows, log)

	dir := t.TempDir()
	seedsPath := filepath.Join(dir, "seeds.txt")
	if err := os.WriteFile(seedsPath, []byte("alice.tangled.sh\n"), 0o644); err != nil {
		t.Fatalf("write seeds: %v", err)
	}

	err := r.Run(context.Background(), Options{
		SeedsPath:   seedsPath,
		MaxHops:     0,
		DryRun:      true,
		Concurrency: 1,
		BatchSize:   10,
	})
	if err != nil {
		t.Fatalf("run dry-run backfill: %v", err)
	}
	if len(tap.added) != 0 {
		t.Fatalf("expected no tap submissions in dry-run, got %#v", tap.added)
	}
}

func TestRunner_SkipsInProgressBackfills(t *testing.T) {
	st := &fakeStore{collaborators: map[string][]string{}}
	follows := &fakeFollowFetcher{follows: map[string][]string{}}
	tap := &fakeTapAdmin{statuses: map[string]RepoStatus{
		"did:plc:seed": {Found: true, Tracked: true, Backfilling: true},
	}}
	resolver := &fakeResolver{mapping: map[string]string{"alice.tangled.sh": "did:plc:seed"}}
	log := slog.New(slog.NewTextHandler(io.Discard, nil))
	r := NewRunnerWithDeps(st, tap, resolver, follows, log)

	dir := t.TempDir()
	seedsPath := filepath.Join(dir, "seeds.txt")
	if err := os.WriteFile(seedsPath, []byte("alice.tangled.sh\n"), 0o644); err != nil {
		t.Fatalf("write seeds: %v", err)
	}

	err := r.Run(context.Background(), Options{SeedsPath: seedsPath, MaxHops: 0})
	if err != nil {
		t.Fatalf("run backfill: %v", err)
	}
	if len(tap.added) != 0 {
		t.Fatalf("expected no submission for in-progress did, got %#v", tap.added)
	}
}
