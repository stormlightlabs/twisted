// Package reindex re-syncs documents to the search index from stored fields.
// It is used by the `twister reindex` CLI command and the POST /admin/reindex endpoint.
package reindex

import (
	"context"
	"fmt"
	"log/slog"

	"tangled.org/desertthunder.dev/twister/internal/store"
)

// Options controls which documents are reindexed.
type Options struct {
	// reindex documents in this collection only
	Collection string
	// reindex documents authored by this DID only
	DID string
	// reindex a single document by stable ID
	DocumentID string
	// log intended work without writing
	DryRun bool
}

// Result summarises the outcome of a reindex run.
type Result struct {
	Total   int
	Updated int
	Errors  int
}

// Runner performs the reindex operation.
type Runner struct {
	store store.Store
	log   *slog.Logger
}

// New creates a Runner.
func New(st store.Store, log *slog.Logger) *Runner {
	return &Runner{store: st, log: log}
}

// Run reindexes documents matching opts.
// It re-upserts each document and then runs any backend-specific search index
// optimization step.
func (r *Runner) Run(ctx context.Context, opts Options) (*Result, error) {
	filter := store.DocumentFilter{
		Collection: opts.Collection,
		DID:        opts.DID,
		DocumentID: opts.DocumentID,
	}

	docs, err := r.store.ListDocuments(ctx, filter)
	if err != nil {
		return nil, fmt.Errorf("list documents: %w", err)
	}

	result := &Result{Total: len(docs)}

	r.log.Info("reindex: starting",
		slog.Int("total", result.Total),
		slog.Bool("dry_run", opts.DryRun),
		slog.String("collection", opts.Collection),
		slog.String("did", opts.DID),
		slog.String("document_id", opts.DocumentID),
	)

	for i, doc := range docs {
		if ctx.Err() != nil {
			break
		}

		if opts.DryRun {
			r.log.Info("reindex: would upsert",
				slog.String("id", doc.ID),
				slog.String("collection", doc.Collection),
				slog.Int("progress", i+1),
				slog.Int("total", result.Total),
			)
			result.Updated++
			continue
		}

		if err := r.store.UpsertDocument(ctx, doc); err != nil {
			r.log.Error("reindex: upsert failed",
				slog.String("id", doc.ID),
				slog.String("collection", doc.Collection),
				slog.String("error", err.Error()),
			)
			result.Errors++
			continue
		}

		result.Updated++

		if (i+1)%100 == 0 || i+1 == result.Total {
			r.log.Info("reindex: progress",
				slog.Int("done", i+1),
				slog.Int("total", result.Total),
				slog.Int("errors", result.Errors),
			)
		}
	}

	if !opts.DryRun {
		r.log.Info("reindex: finalizing search index")
		if err := r.store.OptimizeSearchIndex(ctx); err != nil {
			r.log.Error("reindex: search index finalize failed", slog.String("error", err.Error()))
			result.Errors++
		}
	}

	r.log.Info("reindex: complete",
		slog.Int("total", result.Total),
		slog.Int("updated", result.Updated),
		slog.Int("errors", result.Errors),
	)

	if result.Errors > 0 {
		return result, fmt.Errorf("reindex completed with %d error(s)", result.Errors)
	}
	return result, nil
}
