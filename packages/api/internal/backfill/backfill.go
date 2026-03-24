package backfill

import (
	"context"
	"fmt"
	"log/slog"
	"sort"
	"sync"
	"time"
)

type discoveryStore interface {
	GetRepoCollaborators(ctx context.Context, repoOwnerDID string) ([]string, error)
}

// Runner executes seed resolution, graph discovery, and Tap registration.
type Runner struct {
	store    discoveryStore
	tap      tapAdmin
	resolver handleResolver
	follows  followFetcher
	log      *slog.Logger
}

func NewRunner(store discoveryStore, tap tapAdmin, resolver handleResolver, log *slog.Logger) *Runner {
	return NewRunnerWithDeps(store, tap, resolver, NewHTTPFollowFetcher(), log)
}

func NewRunnerWithDeps(store discoveryStore, tap tapAdmin, resolver handleResolver, follows followFetcher, log *slog.Logger) *Runner {
	if log == nil {
		log = slog.Default()
	}
	if follows == nil {
		follows = NewHTTPFollowFetcher()
	}
	return &Runner{store: store, tap: tap, resolver: resolver, follows: follows, log: log}
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
	seeds, err := r.resolveSeeds(ctx, seedEntries)
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
	return nil
}

func (r *Runner) resolveSeeds(ctx context.Context, entries []seedEntry) ([]string, error) {
	seen := map[string]bool{}
	seeds := make([]string, 0, len(entries))
	for _, entry := range entries {
		if entry.isDID {
			seen[entry.raw] = true
			seeds = append(seeds, entry.raw)
			continue
		}
		did, err := r.resolver.Resolve(ctx, entry.raw)
		if err != nil {
			return nil, fmt.Errorf("resolve handle at line %d (%s): %w", entry.lineNo, entry.raw, err)
		}
		if seen[did] {
			continue
		}
		seen[did] = true
		seeds = append(seeds, did)
	}
	return seeds, nil
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
