package backfill

import (
	"context"
	"fmt"
	"log/slog"
	"sort"
	"sync"
	"time"

	"tangled.org/desertthunder.dev/twister/internal/store"
	"tangled.org/desertthunder.dev/twister/internal/xrpc"
)

type discoveryStore interface {
	GetRepoCollaborators(ctx context.Context, repoOwnerDID string) ([]string, error)
	UpsertIdentityHandle(ctx context.Context, did, handle string, isActive bool, status string) error
	UpsertDocument(ctx context.Context, doc *store.Document) error
}

// Runner executes seed resolution, graph discovery, and Tap registration.
type Runner struct {
	store    discoveryStore
	tap      tapAdmin
	resolver handleResolver
	follows  followFetcher
	profiles profileFetcher
	log      *slog.Logger
}

func NewRunner(store discoveryStore, tap tapAdmin, xrpcClient *xrpc.Client, log *slog.Logger) *Runner {
	return NewRunnerWithDeps(
		store, tap,
		NewXRPCHandleResolver(xrpcClient),
		NewXRPCFollowFetcher(xrpcClient),
		NewXRPCProfileFetcher(xrpcClient),
		log,
	)
}

func NewRunnerWithDeps(store discoveryStore, tap tapAdmin, resolver handleResolver, follows followFetcher, profiles profileFetcher, log *slog.Logger) *Runner {
	if log == nil {
		log = slog.Default()
	}
	return &Runner{store: store, tap: tap, resolver: resolver, follows: follows, profiles: profiles, log: log}
}

func (r *Runner) Run(ctx context.Context, opts Options) error {
	if opts.SeedsPath == "" {
		return fmt.Errorf("--seeds is required")
	}
	if opts.MaxHops < 0 {
		return fmt.Errorf("--max-hops must be >= 0")
	}
	if opts.Concurrency <= 0 {
		opts.Concurrency = 5
	}
	if opts.BatchSize <= 0 {
		opts.BatchSize = 10
	}
	if opts.BatchDelay < 0 {
		return fmt.Errorf("--batch-delay must be >= 0")
	}

	seedEntries, err := parseSeedInput(opts.SeedsPath)
	if err != nil {
		return err
	}
	seeds, seedHandles, err := r.resolveSeeds(ctx, seedEntries)
	if err != nil {
		return err
	}
	if len(seeds) == 0 {
		return fmt.Errorf("no valid seed DIDs resolved")
	}

	r.log.Info("starting backfill discovery",
		slog.Int("seed_count", len(seeds)),
		slog.Int("max_hops", opts.MaxHops),
		slog.Int("concurrency", opts.Concurrency),
	)

	discovered, err := r.discover(ctx, seeds, opts.MaxHops, opts.Concurrency)
	if err != nil {
		return err
	}

	r.log.Info("discovery complete", slog.Int("discovered_total", len(discovered)))
	if opts.DryRun {
		r.log.Info("dry-run mode enabled; skipping Tap mutations")
		return nil
	}

	alreadyTracked := 0
	inProgress := 0
	statusFailures := 0
	toSubmit := make([]string, 0, len(discovered))
	for _, user := range discovered {
		status, err := r.tap.RepoStatus(ctx, user.DID)
		if err != nil {
			statusFailures++
			r.log.Warn("tap classification failed",
				slog.String("did", user.DID),
				slog.String("error", err.Error()),
			)
			continue
		}
		if status.Tracked && status.Backfilled {
			alreadyTracked++
			continue
		}
		if status.Tracked && status.Backfilling {
			inProgress++
			continue
		}
		toSubmit = append(toSubmit, user.DID)
	}

	r.log.Info("tap classification complete",
		slog.Int("already_tracked", alreadyTracked),
		slog.Int("backfill_in_progress", inProgress),
		slog.Int("status_failures", statusFailures),
		slog.Int("to_submit", len(toSubmit)),
	)

	submitted := 0
	submitFailures := 0
	for i := 0; i < len(toSubmit); i += opts.BatchSize {
		end := i + opts.BatchSize
		if end > len(toSubmit) {
			end = len(toSubmit)
		}
		batch := toSubmit[i:end]
		if err := r.tap.AddRepos(ctx, batch); err != nil {
			r.log.Warn("tap batch submission failed",
				slog.Int("batch_start", i),
				slog.Int("batch_end", end),
				slog.Int("batch_size", len(batch)),
				slog.String("error", err.Error()),
			)
			for _, did := range batch {
				if err := r.tap.AddRepos(ctx, []string{did}); err != nil {
					submitFailures++
					r.log.Warn("tap repo submission failed",
						slog.String("did", did),
						slog.String("error", err.Error()),
					)
					continue
				}
				submitted++
				r.log.Info("submitted Tap repo", slog.String("did", did), slog.Int("submitted_total", submitted))
			}
		} else {
			submitted += len(batch)
			r.log.Info("submitted Tap batch",
				slog.Int("batch_start", i),
				slog.Int("batch_end", end),
				slog.Int("batch_size", len(batch)),
				slog.Int("submitted_total", submitted),
			)
		}
		if end < len(toSubmit) && opts.BatchDelay > 0 {
			select {
			case <-ctx.Done():
				return ctx.Err()
			case <-time.After(opts.BatchDelay):
			}
		}
	}

	r.log.Info("backfill complete",
		slog.Int("discovered_total", len(discovered)),
		slog.Int("already_tracked", alreadyTracked),
		slog.Int("backfill_in_progress", inProgress),
		slog.Int("submitted", submitted),
		slog.Int("status_failures", statusFailures),
		slog.Int("submit_failures", submitFailures),
	)

	if err := r.indexProfiles(ctx, discovered, seedHandles, opts.Concurrency); err != nil {
		return fmt.Errorf("index profiles: %w", err)
	}

	return nil
}

// resolveSeeds returns (dids, did→handle map, error). The handle map contains
// entries for seeds that were specified as handles rather than DIDs.
func (r *Runner) resolveSeeds(ctx context.Context, entries []seedEntry) ([]string, map[string]string, error) {
	seen := map[string]bool{}
	seeds := make([]string, 0, len(entries))
	handles := make(map[string]string) // did → handle
	for _, entry := range entries {
		if entry.isDID {
			seen[entry.raw] = true
			seeds = append(seeds, entry.raw)
			continue
		}
		did, err := r.resolver.Resolve(ctx, entry.raw)
		if err != nil {
			return nil, nil, fmt.Errorf("resolve handle at line %d (%s): %w", entry.lineNo, entry.raw, err)
		}
		if seen[did] {
			continue
		}
		seen[did] = true
		seeds = append(seeds, did)
		handles[did] = entry.raw
	}
	return seeds, handles, nil
}

func (r *Runner) discover(ctx context.Context, seeds []string, maxHops int, concurrency int) ([]DiscoveredUser, error) {
	visited := map[string]DiscoveredUser{}
	ordered := make([]DiscoveredUser, 0)
	frontier := make([]DiscoveredUser, 0, len(seeds))
	for _, did := range seeds {
		user := DiscoveredUser{DID: did, Hop: 0, Source: did, Reason: "seed"}
		visited[did] = user
		ordered = append(ordered, user)
		frontier = append(frontier, user)
	}

	for hop := 0; hop <= maxHops && len(frontier) > 0; hop++ {
		r.log.Info("processing discovery hop", slog.Int("hop", hop), slog.Int("users", len(frontier)))
		if hop == maxHops {
			break
		}

		type expansion struct {
			node          DiscoveredUser
			follows       []string
			collaborators []string
			err           error
		}

		jobs := make(chan DiscoveredUser)
		results := make(chan expansion, len(frontier))
		var wg sync.WaitGroup
		for i := 0; i < concurrency; i++ {
			wg.Add(1)
			go func() {
				defer wg.Done()
				for node := range jobs {
					follows, err := r.follows.ListFollowSubjects(ctx, node.DID)
					if err != nil {
						results <- expansion{node: node, err: fmt.Errorf("follows: %w", err)}
						continue
					}
					collaborators, err := r.store.GetRepoCollaborators(ctx, node.DID)
					if err != nil {
						results <- expansion{node: node, err: fmt.Errorf("collaborators: %w", err)}
						continue
					}
					results <- expansion{node: node, follows: follows, collaborators: collaborators}
				}
			}()
		}

		go func() {
			for _, node := range frontier {
				jobs <- node
			}
			close(jobs)
			wg.Wait()
			close(results)
		}()

		nextByDID := map[string]DiscoveredUser{}
		for res := range results {
			if res.err != nil {
				r.log.Warn("discovery expansion failed", slog.String("did", res.node.DID), slog.String("error", res.err.Error()))
				continue
			}

			r.log.Info("discovery expansion",
				slog.String("did", res.node.DID),
				slog.Int("hop", hop),
				slog.Int("follows", len(res.follows)),
				slog.Int("collaborators", len(res.collaborators)),
			)

			for _, did := range res.follows {
				if !isDID(did) {
					continue
				}
				if _, exists := visited[did]; exists {
					continue
				}
				if _, exists := nextByDID[did]; exists {
					continue
				}
				nextByDID[did] = DiscoveredUser{DID: did, Hop: hop + 1, Source: res.node.DID, Reason: "follow"}
			}
			for _, did := range res.collaborators {
				if !isDID(did) {
					continue
				}
				if _, exists := visited[did]; exists {
					continue
				}
				if _, exists := nextByDID[did]; exists {
					continue
				}
				nextByDID[did] = DiscoveredUser{DID: did, Hop: hop + 1, Source: res.node.DID, Reason: "collaborator"}
			}
		}

		next := make([]DiscoveredUser, 0, len(nextByDID))
		for _, user := range nextByDID {
			visited[user.DID] = user
			next = append(next, user)
			ordered = append(ordered, user)
		}
		sort.Slice(next, func(i, j int) bool { return next[i].DID < next[j].DID })
		frontier = next
	}

	return ordered, nil
}

// indexProfiles fetches sh.tangled.actor.profile records via XRPC for each
// discovered user, persists the DID→handle mapping, and upserts a searchable
// profile document.
func (r *Runner) indexProfiles(ctx context.Context, users []DiscoveredUser, seedHandles map[string]string, concurrency int) error {
	if concurrency <= 0 {
		concurrency = 5
	}

	type result struct {
		did     string
		profile *ProfileRecord
		err     error
	}

	jobs := make(chan string)
	results := make(chan result, len(users))
	var wg sync.WaitGroup
	for i := 0; i < concurrency; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for did := range jobs {
				pr, err := r.profiles.FetchProfile(ctx, did)
				results <- result{did: did, profile: pr, err: err}
			}
		}()
	}

	go func() {
		for _, u := range users {
			jobs <- u.DID
		}
		close(jobs)
		wg.Wait()
		close(results)
	}()

	indexed := 0
	identities := 0
	failures := 0
	for res := range results {
		if res.err != nil {
			failures++
			r.log.Warn("profile fetch failed",
				slog.String("did", res.did),
				slog.String("error", res.err.Error()),
			)
			continue
		}

		handle := res.profile.Handle
		if h, ok := seedHandles[res.did]; ok && h != "" {
			handle = h
		}

		if handle != "" {
			if err := r.store.UpsertIdentityHandle(ctx, res.did, handle, true, "active"); err != nil {
				r.log.Warn("upsert identity handle failed",
					slog.String("did", res.did),
					slog.String("handle", handle),
					slog.String("error", err.Error()),
				)
			} else {
				identities++
			}
		}

		if res.profile.Record == nil {
			continue
		}

		description, _ := res.profile.Record["description"].(string)
		location, _ := res.profile.Record["location"].(string)
		summary := description
		if location != "" {
			if summary != "" {
				summary = summary + " · " + location
			} else {
				summary = location
			}
		}
		if len(summary) > 200 {
			summary = summary[:200]
		}

		doc := &store.Document{
			ID:           fmt.Sprintf("%s|%s|self", res.did, profileCollection),
			DID:          res.did,
			Collection:   profileCollection,
			RKey:         "self",
			ATURI:        fmt.Sprintf("at://%s/%s/self", res.did, profileCollection),
			CID:          res.profile.CID,
			RecordType:   "profile",
			Title:        handle,
			Body:         description,
			Summary:      summary,
			AuthorHandle: handle,
			TagsJSON:     "[]",
		}

		if err := r.store.UpsertDocument(ctx, doc); err != nil {
			r.log.Warn("upsert profile document failed",
				slog.String("did", res.did),
				slog.String("error", err.Error()),
			)
			continue
		}
		indexed++
	}

	r.log.Info("profile indexing complete",
		slog.Int("identities_stored", identities),
		slog.Int("profiles_indexed", indexed),
		slog.Int("failures", failures),
	)
	return nil
}
