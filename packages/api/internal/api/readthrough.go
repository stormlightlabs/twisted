package api

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"sync"
	"time"

	"tangled.org/desertthunder.dev/twister/internal/normalize"
	"tangled.org/desertthunder.dev/twister/internal/store"
	"tangled.org/desertthunder.dev/twister/internal/xrpc"
)

const (
	readThroughIdlePoll       = 1 * time.Second
	readThroughStatusInterval = 30 * time.Second
	maxIndexingAttempts       = 10
)

func (s *Server) runReadThroughIndexer(ctx context.Context) {
	ticker := time.NewTicker(readThroughIdlePoll)
	defer ticker.Stop()

	var mu sync.Mutex
	var processedTick int64
	go s.runIndexerStatusLogger(ctx, &mu, &processedTick)

	s.log.Info("read-through indexer worker started")
	for {
		if ctx.Err() != nil {
			s.log.Info("read-through indexer worker stopped")
			return
		}

		job, err := s.store.ClaimIndexingJob(ctx)
		if err != nil {
			s.log.Warn("read-through claim failed", slog.String("error", err.Error()))
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
			}
			continue
		}
		if job == nil {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
			}
			continue
		}

		if err := s.processReadThroughJob(ctx, job); err != nil {
			if job.Attempts+1 >= maxIndexingAttempts {
				s.log.Error("read-through job exceeded max attempts; discarding",
					slog.String("document_id", job.DocumentID),
					slog.Int("attempts", job.Attempts+1),
					slog.String("last_error", err.Error()),
				)
				_ = s.store.CompleteIndexingJob(ctx, job.DocumentID)
				continue
			}
			nextDelay := retryDelay(job.Attempts + 1)
			nextAt := time.Now().UTC().Add(nextDelay).Format(time.RFC3339)
			retryErr := s.store.RetryIndexingJob(ctx, job.DocumentID, nextAt, truncateErr(err))
			if retryErr != nil {
				s.log.Error("read-through retry update failed",
					slog.String("document_id", job.DocumentID),
					slog.String("error", retryErr.Error()),
				)
				continue
			}
			s.log.Warn("read-through job failed; scheduled retry",
				slog.String("document_id", job.DocumentID),
				slog.Int("attempt", job.Attempts+1),
				slog.Duration("retry_in", nextDelay),
				slog.String("error", err.Error()),
			)
			continue
		}

		if err := s.store.CompleteIndexingJob(ctx, job.DocumentID); err != nil {
			s.log.Error("read-through complete failed",
				slog.String("document_id", job.DocumentID),
				slog.String("error", err.Error()),
			)
			continue
		}

		s.log.Debug("read-through job completed", slog.String("document_id", job.DocumentID))
		mu.Lock()
		processedTick++
		mu.Unlock()
	}
}

func (s *Server) runIndexerStatusLogger(ctx context.Context, mu *sync.Mutex, processedTick *int64) {
	ticker := time.NewTicker(readThroughStatusInterval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			mu.Lock()
			n := *processedTick
			*processedTick = 0
			mu.Unlock()

			pending, err := s.store.CountPendingIndexingJobs(ctx)
			if err != nil {
				s.log.Warn("read-through status: count failed", slog.String("error", err.Error()))
				continue
			}
			s.log.Info("read-through indexer status",
				slog.Int64("jobs_processed", n),
				slog.Int64("jobs_pending", pending),
			)
		}
	}
}

func (s *Server) processReadThroughJob(ctx context.Context, job *store.IndexingJob) error {
	record := map[string]any{}
	if err := json.Unmarshal([]byte(job.RecordJSON), &record); err != nil {
		return fmt.Errorf("decode record json: %w", err)
	}

	event := normalize.TapRecordEvent{
		Type: "record",
		Record: &normalize.TapRecord{
			DID:        job.DID,
			Collection: job.Collection,
			RKey:       job.RKey,
			Action:     "create",
			CID:        job.CID,
			Record:     record,
		},
	}

	if handler, ok := s.registry.StateHandler(job.Collection); ok {
		update, err := handler.HandleState(event)
		if err != nil {
			return fmt.Errorf("state normalize: %w", err)
		}
		if err := s.store.UpdateRecordState(ctx, update.SubjectURI, update.State); err != nil {
			return fmt.Errorf("update state: %w", err)
		}
		return nil
	}

	adapter, ok := s.registry.Adapter(job.Collection)
	if !ok {
		return nil
	}

	doc, err := adapter.Normalize(event)
	if err != nil {
		return fmt.Errorf("normalize record: %w", err)
	}

	handle, err := s.store.GetIdentityHandle(ctx, job.DID)
	if err != nil {
		return fmt.Errorf("lookup identity handle: %w", err)
	}
	if handle != "" {
		doc.AuthorHandle = handle
		if doc.RecordType == "profile" {
			doc.Title = handle
		}
	}

	s.enrichDocument(ctx, doc, record)

	if err := s.store.UpsertDocument(ctx, doc); err != nil {
		return fmt.Errorf("upsert document: %w", err)
	}

	if adapter.Searchable(record) {
		if err := s.store.EnqueueEmbeddingJob(ctx, doc.ID); err != nil {
			s.log.Warn("read-through enqueue embedding failed",
				slog.String("document_id", doc.ID),
				slog.String("error", err.Error()),
			)
		}
	}
	return nil
}

// enrichDocument fills RepoName, AuthorHandle, and WebURL via XRPC when possible.
// Failures are logged but never block indexing.
func (s *Server) enrichDocument(ctx context.Context, doc *store.Document, record map[string]any) {
	if s.xrpc == nil {
		return
	}

	if doc.RepoDID != "" && doc.RepoName == "" {
		repoURI := repoURIFromRecord(record)
		if repoURI != "" {
			_, _, repoRKey, err := normalize.ParseATURI(repoURI)
			if err == nil && repoRKey != "" {
				name, err := s.xrpc.ResolveRepoName(ctx, doc.RepoDID, repoRKey)
				if err == nil {
					doc.RepoName = name
				} else {
					s.log.Debug("read-through enrich: resolve repo name failed",
						slog.String("doc_id", doc.ID),
						slog.String("repo_did", doc.RepoDID),
						slog.String("error", err.Error()),
					)
				}
			}
		}
	}

	if doc.AuthorHandle == "" && doc.DID != "" {
		info, err := s.xrpc.ResolveIdentity(ctx, doc.DID)
		if err == nil && info.Handle != "" {
			doc.AuthorHandle = info.Handle
			if doc.RecordType == "profile" {
				doc.Title = info.Handle
			}
		} else if err != nil {
			s.log.Debug("read-through enrich: resolve author handle failed",
				slog.String("doc_id", doc.ID),
				slog.String("did", doc.DID),
				slog.String("error", err.Error()),
			)
		}
	}

	if doc.WebURL == "" {
		ownerHandle := doc.AuthorHandle
		if doc.RepoDID != "" && doc.RepoDID != doc.DID {
			if h, err := s.store.GetIdentityHandle(ctx, doc.RepoDID); err == nil && h != "" {
				ownerHandle = h
			} else if info, err := s.xrpc.ResolveIdentity(ctx, doc.RepoDID); err == nil && info.Handle != "" {
				ownerHandle = info.Handle
			}
		}
		doc.WebURL = xrpc.BuildWebURL(ownerHandle, doc.RepoName, doc.RecordType, doc.RKey)
	}
}

// repoURIFromRecord extracts the repo AT-URI from common record fields.
// Issues store it in rec["repo"]; pulls store it in rec["target"]["repo"].
func repoURIFromRecord(record map[string]any) string {
	if uri, _ := record["repo"].(string); uri != "" {
		return uri
	}
	if target, _ := record["target"].(map[string]any); target != nil {
		if uri, _ := target["repo"].(string); uri != "" {
			return uri
		}
	}
	return ""
}

func (s *Server) enqueueXRPCRecord(ctx context.Context, uri, cid string, value map[string]any) {
	did, collection, rkey, err := normalize.ParseATURI(uri)
	if err != nil {
		s.log.Debug("read-through skip invalid at-uri", slog.String("uri", uri), slog.String("error", err.Error()))
		return
	}
	payload, err := json.Marshal(value)
	if err != nil {
		s.log.Debug("read-through skip unmarshalable record", slog.String("uri", uri), slog.String("error", err.Error()))
		return
	}
	input := store.IndexingJobInput{
		DocumentID: normalize.StableID(did, collection, rkey),
		DID:        did,
		Collection: collection,
		RKey:       rkey,
		CID:        cid,
		RecordJSON: string(payload),
	}
	if err := s.store.EnqueueIndexingJob(ctx, input); err != nil {
		s.log.Warn("enqueue read-through indexing job failed",
			slog.String("document_id", input.DocumentID),
			slog.String("error", err.Error()),
		)
	}
}

func (s *Server) enqueueXRPCList(ctx context.Context, entries []xrpc.ListRecordEntry) {
	for _, e := range entries {
		s.enqueueXRPCRecord(ctx, e.URI, e.CID, e.Value)
	}
}
