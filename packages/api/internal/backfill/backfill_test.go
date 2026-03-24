package backfill

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"tangled.org/desertthunder.dev/twister/internal/store"
)

type fakeStore struct {
	collaborators map[string][]string
	identities    map[string]string
	documents     []*store.Document
}

func (f *fakeStore) GetRepoCollaborators(_ context.Context, did string) ([]string, error) {
	return f.collaborators[did], nil
}

func (f *fakeStore) UpsertIdentityHandle(_ context.Context, did, handle string, _ bool, _ string) error {
	if f.identities == nil {
		f.identities = map[string]string{}
	}
	f.identities[did] = handle
	return nil
}

func (f *fakeStore) UpsertDocument(_ context.Context, doc *store.Document) error {
	f.documents = append(f.documents, doc)
	return nil
}

type fakeFollowFetcher struct {
	follows map[string][]string
}

func (f *fakeFollowFetcher) ListFollowSubjects(_ context.Context, did string) ([]string, error) {
	return f.follows[did], nil
}

type fakeTapAdmin struct {
	statuses      map[string]RepoStatus
	statusErrs    map[string]error
	added         [][]string
	addReposError func(dids []string) error
}

func (f *fakeTapAdmin) RepoStatus(_ context.Context, did string) (RepoStatus, error) {
	if err, ok := f.statusErrs[did]; ok {
		return RepoStatus{}, err
	}
	if status, ok := f.statuses[did]; ok {
		return status, nil
	}
	return RepoStatus{Found: false, Tracked: false}, nil
}

func (f *fakeTapAdmin) AddRepos(_ context.Context, dids []string) error {
	if f.addReposError != nil {
		if err := f.addReposError(dids); err != nil {
			return err
		}
	}
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

type fakeProfileFetcher struct {
	profiles map[string]*ProfileRecord
}

func (f *fakeProfileFetcher) FetchProfile(_ context.Context, did string) (*ProfileRecord, error) {
	if pr, ok := f.profiles[did]; ok {
		return pr, nil
	}
	return &ProfileRecord{}, nil
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
	r := NewRunnerWithDeps(st, tap, resolver, follows, &fakeProfileFetcher{profiles: map[string]*ProfileRecord{}}, log)

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
	r := NewRunnerWithDeps(st, tap, resolver, follows, &fakeProfileFetcher{profiles: map[string]*ProfileRecord{}}, log)

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
	r := NewRunnerWithDeps(st, tap, resolver, follows, &fakeProfileFetcher{profiles: map[string]*ProfileRecord{}}, log)

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

func TestRunner_ContinuesWhenRepoStatusFails(t *testing.T) {
	st := &fakeStore{
		collaborators: map[string][]string{
			"did:plc:seed": {"did:plc:good", "did:plc:bad"},
		},
	}
	follows := &fakeFollowFetcher{follows: map[string][]string{}}
	tap := &fakeTapAdmin{
		statuses:   map[string]RepoStatus{},
		statusErrs: map[string]error{"did:plc:bad": errors.New("tap info request failed: status 502")},
	}
	resolver := &fakeResolver{mapping: map[string]string{"alice.tangled.sh": "did:plc:seed"}}
	log := slog.New(slog.NewTextHandler(io.Discard, nil))
	r := NewRunnerWithDeps(st, tap, resolver, follows, &fakeProfileFetcher{profiles: map[string]*ProfileRecord{}}, log)

	dir := t.TempDir()
	seedsPath := filepath.Join(dir, "seeds.txt")
	if err := os.WriteFile(seedsPath, []byte("alice.tangled.sh\n"), 0o644); err != nil {
		t.Fatalf("write seeds: %v", err)
	}

	err := r.Run(context.Background(), Options{
		SeedsPath:   seedsPath,
		MaxHops:     1,
		Concurrency: 1,
		BatchSize:   10,
	})
	if err != nil {
		t.Fatalf("run backfill: %v", err)
	}

	if len(tap.added) != 1 {
		t.Fatalf("expected one submission batch, got %d", len(tap.added))
	}
	if len(tap.added[0]) != 2 {
		t.Fatalf("expected seed and good DID submitted, got %#v", tap.added[0])
	}
	for _, did := range tap.added[0] {
		if did == "did:plc:bad" {
			t.Fatalf("did with status error should have been skipped, got %#v", tap.added[0])
		}
	}
}

func TestRunner_FallsBackToSingleRepoSubmissionOnBatchFailure(t *testing.T) {
	st := &fakeStore{
		collaborators: map[string][]string{
			"did:plc:seed": {"did:plc:good", "did:plc:bad"},
		},
	}
	follows := &fakeFollowFetcher{follows: map[string][]string{}}
	tap := &fakeTapAdmin{
		statuses: map[string]RepoStatus{},
		addReposError: func(dids []string) error {
			if len(dids) > 1 {
				return errors.New("repos add failed: status 502")
			}
			if len(dids) == 1 && strings.Contains(dids[0], "bad") {
				return errors.New("repos add failed: status 502")
			}
			return nil
		},
	}
	resolver := &fakeResolver{mapping: map[string]string{"alice.tangled.sh": "did:plc:seed"}}
	log := slog.New(slog.NewTextHandler(io.Discard, nil))
	r := NewRunnerWithDeps(st, tap, resolver, follows, &fakeProfileFetcher{profiles: map[string]*ProfileRecord{}}, log)

	dir := t.TempDir()
	seedsPath := filepath.Join(dir, "seeds.txt")
	if err := os.WriteFile(seedsPath, []byte("alice.tangled.sh\n"), 0o644); err != nil {
		t.Fatalf("write seeds: %v", err)
	}

	err := r.Run(context.Background(), Options{
		SeedsPath:   seedsPath,
		MaxHops:     1,
		Concurrency: 1,
		BatchSize:   10,
	})
	if err != nil {
		t.Fatalf("run backfill: %v", err)
	}

	if len(tap.added) != 2 {
		t.Fatalf("expected successful individual fallbacks only, got %#v", tap.added)
	}
	for _, batch := range tap.added {
		if len(batch) != 1 {
			t.Fatalf("expected only single-DID successful submissions after batch fallback, got %#v", tap.added)
		}
		if batch[0] == "did:plc:bad" {
			t.Fatalf("bad DID should not have been successfully submitted, got %#v", tap.added)
		}
	}
}

func TestRunner_IndexesProfilesAndHandles(t *testing.T) {
	st := &fakeStore{collaborators: map[string][]string{}}
	follows := &fakeFollowFetcher{follows: map[string][]string{}}
	tap := &fakeTapAdmin{statuses: map[string]RepoStatus{}}
	resolver := &fakeResolver{mapping: map[string]string{"alice.tangled.sh": "did:plc:seed"}}
	profiles := &fakeProfileFetcher{profiles: map[string]*ProfileRecord{
		"did:plc:seed": {
			Record: map[string]any{
				"description": "Building cool stuff",
				"location":    "NYC",
			},
			CID:    "bafyabc123",
			Handle: "alice.tangled.sh",
		},
	}}
	log := slog.New(slog.NewTextHandler(io.Discard, nil))
	r := NewRunnerWithDeps(st, tap, resolver, follows, profiles, log)

	dir := t.TempDir()
	seedsPath := filepath.Join(dir, "seeds.txt")
	if err := os.WriteFile(seedsPath, []byte("alice.tangled.sh\n"), 0o644); err != nil {
		t.Fatalf("write seeds: %v", err)
	}

	err := r.Run(context.Background(), Options{SeedsPath: seedsPath, MaxHops: 0})
	if err != nil {
		t.Fatalf("run backfill: %v", err)
	}

	if st.identities["did:plc:seed"] != "alice.tangled.sh" {
		t.Fatalf("expected identity handle for seed DID, got %#v", st.identities)
	}

	if len(st.documents) != 1 {
		t.Fatalf("expected 1 profile document, got %d", len(st.documents))
	}
	doc := st.documents[0]
	if doc.Title != "alice.tangled.sh" {
		t.Errorf("expected title to be handle, got %q", doc.Title)
	}
	if doc.AuthorHandle != "alice.tangled.sh" {
		t.Errorf("expected author_handle to be handle, got %q", doc.AuthorHandle)
	}
	if doc.Body != "Building cool stuff" {
		t.Errorf("expected body to be description, got %q", doc.Body)
	}
	if doc.RecordType != "profile" {
		t.Errorf("expected record_type profile, got %q", doc.RecordType)
	}
	if !strings.Contains(doc.Summary, "NYC") {
		t.Errorf("expected summary to contain location, got %q", doc.Summary)
	}
}
