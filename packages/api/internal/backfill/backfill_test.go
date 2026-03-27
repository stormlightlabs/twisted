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

type fakeRepoFetcher struct {
	repos map[string][]RepoRecord
}

func (f *fakeRepoFetcher) ListRepos(_ context.Context, did string) ([]RepoRecord, error) {
	if repos, ok := f.repos[did]; ok {
		return repos, nil
	}
	return nil, nil
}

type fakeLightrailRepoLister struct {
	dids        []string
	err         error
	calls       int
	baseURL     string
	collections []string
	limit       int
}

func (f *fakeLightrailRepoLister) ListReposByCollection(
	_ context.Context, baseURL string, collections []string, limit int,
) ([]string, error) {
	f.calls++
	f.baseURL = baseURL
	f.collections = append([]string(nil), collections...)
	f.limit = limit
	if f.err != nil {
		return nil, f.err
	}
	return append([]string(nil), f.dids...), nil
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
	r := NewRunnerWithDeps(
		st, tap, resolver, follows,
		&fakeProfileFetcher{profiles: map[string]*ProfileRecord{}},
		&fakeRepoFetcher{},
		&fakeLightrailRepoLister{}, log,
	)

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
		Source:      SourceGraph,
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
	r := NewRunnerWithDeps(
		st, tap, resolver, follows,
		&fakeProfileFetcher{profiles: map[string]*ProfileRecord{}},
		&fakeRepoFetcher{},
		&fakeLightrailRepoLister{}, log,
	)

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
		Source:      SourceGraph,
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
	r := NewRunnerWithDeps(
		st, tap, resolver, follows,
		&fakeProfileFetcher{profiles: map[string]*ProfileRecord{}},
		&fakeRepoFetcher{},
		&fakeLightrailRepoLister{}, log,
	)

	dir := t.TempDir()
	seedsPath := filepath.Join(dir, "seeds.txt")
	if err := os.WriteFile(seedsPath, []byte("alice.tangled.sh\n"), 0o644); err != nil {
		t.Fatalf("write seeds: %v", err)
	}

	err := r.Run(context.Background(), Options{
		SeedsPath: seedsPath, MaxHops: 0, Source: SourceGraph,
	})
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
	r := NewRunnerWithDeps(
		st, tap, resolver, follows,
		&fakeProfileFetcher{profiles: map[string]*ProfileRecord{}},
		&fakeRepoFetcher{},
		&fakeLightrailRepoLister{}, log,
	)

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
		Source:      SourceGraph,
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
	r := NewRunnerWithDeps(
		st, tap, resolver, follows,
		&fakeProfileFetcher{profiles: map[string]*ProfileRecord{}},
		&fakeRepoFetcher{},
		&fakeLightrailRepoLister{}, log,
	)

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
		Source:      SourceGraph,
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
	r := NewRunnerWithDeps(
		st, tap, resolver, follows, profiles, &fakeRepoFetcher{}, &fakeLightrailRepoLister{}, log,
	)

	dir := t.TempDir()
	seedsPath := filepath.Join(dir, "seeds.txt")
	if err := os.WriteFile(seedsPath, []byte("alice.tangled.sh\n"), 0o644); err != nil {
		t.Fatalf("write seeds: %v", err)
	}

	err := r.Run(context.Background(), Options{
		SeedsPath: seedsPath, MaxHops: 0, Source: SourceGraph,
	})
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

func TestRunner_LightrailDryRunSkipsTapAndProfileIndexing(t *testing.T) {
	st := &fakeStore{collaborators: map[string][]string{}}
	tap := &fakeTapAdmin{
		statusErrs: map[string]error{"did:plc:a": errors.New("should not be called")},
	}
	lightrail := &fakeLightrailRepoLister{dids: []string{"did:plc:b", "did:plc:a"}}
	log := slog.New(slog.NewTextHandler(io.Discard, nil))
	r := NewRunnerWithDeps(
		st, tap, &fakeResolver{}, &fakeFollowFetcher{}, &fakeProfileFetcher{}, &fakeRepoFetcher{},
		lightrail, log,
	)

	err := r.Run(context.Background(), Options{
		Source: SourceLightrail, DryRun: true,
		LightrailURL: "https://example.test", PageLimit: 500,
	})
	if err != nil {
		t.Fatalf("run lightrail dry-run: %v", err)
	}
	if len(tap.added) != 0 {
		t.Fatalf("expected no Tap submissions, got %#v", tap.added)
	}
	if len(st.documents) != 0 {
		t.Fatalf("expected no profile indexing, got %#v", st.documents)
	}
	if lightrail.calls != 1 {
		t.Fatalf("expected one Lightrail call, got %d", lightrail.calls)
	}
	if len(lightrail.collections) != len(DefaultCollections) {
		t.Fatalf("expected default collections, got %#v", lightrail.collections)
	}
}

func TestRunner_LightrailSubmitsWithoutRepoStatusChecks(t *testing.T) {
	st := &fakeStore{collaborators: map[string][]string{}}
	tap := &fakeTapAdmin{
		statusErrs: map[string]error{
			"did:plc:a": errors.New("RepoStatus should not be called in lightrail mode"),
		},
	}
	lightrail := &fakeLightrailRepoLister{
		dids: []string{"did:plc:b", "did:plc:a", "did:plc:b"},
	}
	log := slog.New(slog.NewTextHandler(io.Discard, nil))
	r := NewRunnerWithDeps(
		st, tap, &fakeResolver{}, &fakeFollowFetcher{}, &fakeProfileFetcher{}, &fakeRepoFetcher{},
		lightrail, log,
	)

	err := r.Run(context.Background(), Options{
		Source: SourceLightrail, BatchSize: 10,
		Collections: []string{"sh.tangled.repo"},
	})
	if err != nil {
		t.Fatalf("run lightrail backfill: %v", err)
	}
	if len(tap.added) != 1 {
		t.Fatalf("expected one Tap batch, got %#v", tap.added)
	}
	if len(tap.added[0]) != 2 {
		t.Fatalf("expected deduped DIDs, got %#v", tap.added)
	}
}

func TestRunner_LightrailIndexesProfiles(t *testing.T) {
	st := &fakeStore{collaborators: map[string][]string{}}
	tap := &fakeTapAdmin{}
	lightrail := &fakeLightrailRepoLister{
		dids: []string{"did:plc:xg2vq45muivyy3xwatcehspu"},
	}
	profiles := &fakeProfileFetcher{profiles: map[string]*ProfileRecord{
		"did:plc:xg2vq45muivyy3xwatcehspu": {
			Record: map[string]any{
				"description": "Twisted maintainer",
				"location":    "Chicago",
			},
			CID:    "bafydesert123",
			Handle: "desertthunder.dev",
		},
	}}
	log := slog.New(slog.NewTextHandler(io.Discard, nil))
	r := NewRunnerWithDeps(
		st, tap, &fakeResolver{}, &fakeFollowFetcher{}, profiles, &fakeRepoFetcher{}, lightrail, log,
	)

	err := r.Run(context.Background(), Options{
		Source:      SourceLightrail,
		BatchSize:   10,
		Concurrency: 1,
		Collections: []string{"sh.tangled.repo"},
	})
	if err != nil {
		t.Fatalf("run lightrail backfill: %v", err)
	}
	if st.identities["did:plc:xg2vq45muivyy3xwatcehspu"] != "desertthunder.dev" {
		t.Fatalf("expected identity handle to be stored, got %#v", st.identities)
	}
	if len(st.documents) != 1 {
		t.Fatalf("expected one profile document, got %d", len(st.documents))
	}
	doc := st.documents[0]
	if doc.RecordType != "profile" {
		t.Fatalf("expected profile document, got %q", doc.RecordType)
	}
	if doc.AuthorHandle != "desertthunder.dev" {
		t.Fatalf("expected author_handle desertthunder.dev, got %q", doc.AuthorHandle)
	}
	if doc.Title != "desertthunder.dev" {
		t.Fatalf("expected title desertthunder.dev, got %q", doc.Title)
	}
}

func TestRunner_LightrailIndexesReposDirectly(t *testing.T) {
	st := &fakeStore{collaborators: map[string][]string{}}
	tap := &fakeTapAdmin{}
	lightrail := &fakeLightrailRepoLister{
		dids: []string{"did:plc:xg2vq45muivyy3xwatcehspu"},
	}
	profiles := &fakeProfileFetcher{profiles: map[string]*ProfileRecord{
		"did:plc:xg2vq45muivyy3xwatcehspu": {
			Handle: "desertthunder.dev",
			Record: map[string]any{
				"description": "Twisted maintainer",
			},
			CID: "bafydesert123",
		},
	}}
	repos := &fakeRepoFetcher{repos: map[string][]RepoRecord{
		"did:plc:xg2vq45muivyy3xwatcehspu": {
			{
				RKey: "3mho6hukiei22",
				CID:  "bafyreitwisted123",
				Record: map[string]any{
					"name":        "twisted",
					"description": "A tangled mobile client",
					"topics":      []any{"go", "search"},
					"createdAt":   "2026-03-01T00:00:00Z",
				},
			},
		},
	}}
	log := slog.New(slog.NewTextHandler(io.Discard, nil))
	r := NewRunnerWithDeps(
		st, tap, &fakeResolver{}, &fakeFollowFetcher{}, profiles, repos, lightrail, log,
	)

	err := r.Run(context.Background(), Options{
		Source:      SourceLightrail,
		BatchSize:   10,
		Concurrency: 1,
		Collections: []string{"sh.tangled.repo"},
	})
	if err != nil {
		t.Fatalf("run lightrail backfill: %v", err)
	}

	if len(st.documents) != 2 {
		t.Fatalf("expected profile and repo bootstrap documents, got %d", len(st.documents))
	}

	var foundRepo *store.Document
	for _, doc := range st.documents {
		if doc.RecordType == "repo" {
			foundRepo = doc
			break
		}
	}
	if foundRepo == nil {
		t.Fatal("expected repo bootstrap document")
	}
	if foundRepo.Title != "twisted" {
		t.Fatalf("expected repo title twisted, got %q", foundRepo.Title)
	}
	if foundRepo.AuthorHandle != "desertthunder.dev" {
		t.Fatalf("expected repo author_handle desertthunder.dev, got %q", foundRepo.AuthorHandle)
	}
	if foundRepo.WebURL == "" {
		t.Fatal("expected repo web_url to be populated")
	}
}
