package api

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"time"

	"tangled.org/desertthunder.dev/twister/internal/normalize"
	"tangled.org/desertthunder.dev/twister/internal/store"
	"tangled.org/desertthunder.dev/twister/internal/xrpc"
)

const readThroughIdlePoll = 1 * time.Second

func (s *Server) runReadThroughIndexer(ctx context.Context) {
	ticker := time.NewTicker(readThroughIdlePoll)
	defer ticker.Stop()

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

func retryDelay(attempt int) time.Duration {
	if attempt < 1 {
		attempt = 1
	}
	base := time.Second * time.Duration(1<<minInt(attempt-1, 8))
	if base > 5*time.Minute {
		return 5 * time.Minute
	}
	return base
}

func truncateErr(err error) string {
	if err == nil {
		return ""
	}
	msg := err.Error()
	if len(msg) > 500 {
		return msg[:500]
	}
	return msg
}

func minInt(a, b int) int {
	if a < b {
		return a
	}
	return b
}
