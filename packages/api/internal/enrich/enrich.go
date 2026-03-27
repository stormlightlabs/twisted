// Package enrich backfills RepoName, AuthorHandle, and WebURL on existing documents.
package enrich

import (
	"context"
	"fmt"
	"log/slog"

	"tangled.org/desertthunder.dev/twister/internal/store"
	"tangled.org/desertthunder.dev/twister/internal/xrpc"
)

// Options controls which documents are enriched.
type Options struct {
	Collection  string
	DID         string
	DocumentID  string
	DryRun      bool
	Concurrency int
}

// Result summarises the outcome of an enrich run.
type Result struct {
	Total   int
	Updated int
	Skipped int
	Errors  int
}

// Runner performs the enrichment operation.
type Runner struct {
	store store.Store
	xrpc  *xrpc.Client
	log   *slog.Logger
}

// New creates a Runner.
func New(st store.Store, xrpcClient *xrpc.Client, log *slog.Logger) *Runner {
	return &Runner{store: st, xrpc: xrpcClient, log: log}
}

// Run enriches documents matching opts.
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

	r.log.Info("enrich: starting",
		slog.Int("total", result.Total),
		slog.Bool("dry_run", opts.DryRun),
	)

	for i, doc := range docs {
		if ctx.Err() != nil {
			break
		}

		if !needsEnrichment(doc) {
			result.Skipped++
			continue
		}

		if opts.DryRun {
			r.log.Info("enrich: would update",
				slog.String("id", doc.ID),
				slog.String("record_type", doc.RecordType),
				slog.String("repo_name", doc.RepoName),
				slog.String("web_url", doc.WebURL),
			)
			result.Updated++
			continue
		}

		changed := r.enrichDoc(ctx, doc)
		if !changed {
			result.Skipped++
			continue
		}

		if err := r.store.UpsertDocument(ctx, doc); err != nil {
			r.log.Error("enrich: upsert failed",
				slog.String("id", doc.ID),
				slog.String("error", err.Error()),
			)
			result.Errors++
			continue
		}

		result.Updated++

		if (i+1)%100 == 0 {
			r.log.Info("enrich: progress",
				slog.Int("done", i+1),
				slog.Int("total", result.Total),
				slog.Int("updated", result.Updated),
			)
		}
	}

	if !opts.DryRun && result.Updated > 0 {
		r.log.Info("enrich: optimizing fts index")
		if err := r.store.OptimizeSearchIndex(ctx); err != nil {
			r.log.Error("enrich: search index finalize failed", slog.String("error", err.Error()))
			result.Errors++
		}
	}

	r.log.Info("enrich: complete",
		slog.Int("total", result.Total),
		slog.Int("updated", result.Updated),
		slog.Int("skipped", result.Skipped),
		slog.Int("errors", result.Errors),
	)

	if result.Errors > 0 {
		return result, fmt.Errorf("enrich completed with %d error(s)", result.Errors)
	}
	return result, nil
}

func needsEnrichment(doc *store.Document) bool {
	switch doc.RecordType {
	case "issue", "pull", "issue_comment", "pull_comment":
		return doc.RepoName == "" || doc.WebURL == "" || doc.AuthorHandle == ""
	case "repo":
		return doc.WebURL == "" || doc.AuthorHandle == ""
	case "profile":
		return doc.WebURL == "" || doc.AuthorHandle == ""
	default:
		return doc.WebURL == "" && doc.AuthorHandle == ""
	}
}

func (r *Runner) enrichDoc(ctx context.Context, doc *store.Document) bool {
	changed := false

	if doc.AuthorHandle == "" && doc.DID != "" {
		handle, err := r.store.GetIdentityHandle(ctx, doc.DID)
		if err == nil && handle != "" {
			doc.AuthorHandle = handle
			changed = true
		} else {
			info, err := r.xrpc.ResolveIdentity(ctx, doc.DID)
			if err == nil && info.Handle != "" {
				doc.AuthorHandle = info.Handle
				changed = true
			} else if err != nil {
				r.log.Debug("enrich: resolve identity failed",
					slog.String("did", doc.DID),
					slog.String("error", err.Error()),
				)
			}
		}
	}

	if doc.RepoDID != "" && doc.RepoName == "" {
		repoName := r.findRepoNameFromStore(ctx, doc.RepoDID)
		if repoName != "" {
			doc.RepoName = repoName
			changed = true
		}
	}

	ownerHandle := doc.AuthorHandle
	if doc.RepoDID != "" && doc.RepoDID != doc.DID {
		repoOwnerHandle, err := r.store.GetIdentityHandle(ctx, doc.RepoDID)
		if err == nil && repoOwnerHandle != "" {
			ownerHandle = repoOwnerHandle
		} else {
			info, err := r.xrpc.ResolveIdentity(ctx, doc.RepoDID)
			if err == nil && info.Handle != "" {
				ownerHandle = info.Handle
			}
		}
	}
	if ownerHandle == "" {
		if doc.RepoDID != "" && doc.RepoDID != doc.DID {
			ownerHandle = doc.RepoDID
		} else {
			ownerHandle = doc.DID
		}
	}

	if doc.WebURL == "" {
		webURL := xrpc.BuildWebURL(ownerHandle, doc.RepoName, doc.RecordType, doc.RKey)
		if webURL != "" {
			doc.WebURL = webURL
			changed = true
		}
	}

	return changed
}

// findRepoNameFromStore looks for a sh.tangled.repo document for the given repo DID
// and returns the repo name (title) if found.
func (r *Runner) findRepoNameFromStore(ctx context.Context, repoDID string) string {
	docs, err := r.store.ListDocuments(ctx, store.DocumentFilter{
		Collection: "sh.tangled.repo",
		DID:        repoDID,
	})
	if err != nil || len(docs) == 0 {
		return ""
	}
	for _, d := range docs {
		if d.Title != "" {
			return d.Title
		}
	}
	return ""
}
