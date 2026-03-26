package api

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"sync"
	"time"

	idx "tangled.org/desertthunder.dev/twister/internal/index"
	"tangled.org/desertthunder.dev/twister/internal/normalize"
	"tangled.org/desertthunder.dev/twister/internal/store"
	"tangled.org/desertthunder.dev/twister/internal/xrpc"
)

const (
	readThroughIdlePoll       = 1 * time.Second
	readThroughLeaseDuration  = 30 * time.Second
	readThroughStatusInterval = 30 * time.Second
)

func (s *Server) runReadThroughIndexer(ctx context.Context) {
	if s.policy.ReadThroughMode() == idx.ReadThroughOff {
		s.log.Info("read-through indexer worker disabled")
		return
	}

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

		leaseUntil := time.Now().UTC().Add(readThroughLeaseDuration).Format(time.RFC3339)
		job, err := s.store.ClaimIndexingJob(ctx, s.workerID, leaseUntil)
		if err != nil {
			s.log.Warn("read-through claim failed", slog.String("error", err.Error()))
			<-ticker.C
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

		result, err := s.processReadThroughJob(ctx, job)
		if err != nil {
			s.handleReadThroughFailure(ctx, job, err)
			continue
		}
		if err := s.store.CompleteIndexingJob(ctx, job.DocumentID); err != nil {
			s.log.Error("read-through complete failed",
				slog.String("document_id", job.DocumentID),
				slog.String("error", err.Error()),
			)
			continue
		}

		s.appendIndexingAudit(ctx, store.IndexingAuditInput{
			Source:     job.Source,
			DocumentID: job.DocumentID,
			Collection: job.Collection,
			CID:        job.CID,
			Decision:   result.Decision,
			Attempt:    job.Attempts,
		})
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

			stats, err := s.store.GetIndexingJobStats(ctx)
			if err != nil {
				s.log.Warn("read-through status: stats failed", slog.String("error", err.Error()))
				continue
			}
			s.log.Info("read-through indexer status",
				slog.Int64("jobs_processed", n),
				slog.Int64("pending", stats.Pending),
				slog.Int64("processing", stats.Processing),
				slog.Int64("failed", stats.Failed),
				slog.Int64("dead_letter", stats.DeadLetter),
			)
		}
	}
}

func (s *Server) processReadThroughJob(
	ctx context.Context, job *store.IndexingJob,
) (*idx.Result, error) {
	doc, err := s.store.GetDocument(ctx, job.DocumentID)
	if err != nil {
		return nil, fmt.Errorf("get document: %w", err)
	}
	if doc != nil && doc.CID == job.CID && doc.DeletedAt == "" {
		return &idx.Result{
			Decision:   "skip_already_indexed",
			DocumentID: job.DocumentID,
			Collection: job.Collection,
			CID:        job.CID,
		}, nil
	}

	record := map[string]any{}
	if err := json.Unmarshal([]byte(job.RecordJSON), &record); err != nil {
		return nil, &idx.PermanentError{Decision: "decode_record_json", Err: err}
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
	return s.processor.ProcessRecord(ctx, job.Source, event)
}

func (s *Server) handleReadThroughFailure(
	ctx context.Context, job *store.IndexingJob, err error,
) {
	if perr, ok := idx.IsPermanent(err); ok {
		_ = s.store.FailIndexingJob(ctx, job.DocumentID, store.IndexingJobDeadLetter, truncateErr(perr))
		s.appendIndexingAudit(ctx, store.IndexingAuditInput{
			Source:     job.Source,
			DocumentID: job.DocumentID,
			Collection: job.Collection,
			CID:        job.CID,
			Decision:   perr.Decision,
			Attempt:    job.Attempts + 1,
			Error:      perr.Error(),
		})
		return
	}

	if job.Attempts+1 >= s.cfg.ReadThroughMaxAttempts {
		_ = s.store.FailIndexingJob(ctx, job.DocumentID, store.IndexingJobDeadLetter, truncateErr(err))
		s.appendIndexingAudit(ctx, store.IndexingAuditInput{
			Source:     job.Source,
			DocumentID: job.DocumentID,
			Collection: job.Collection,
			CID:        job.CID,
			Decision:   "dead_letter",
			Attempt:    job.Attempts + 1,
			Error:      err.Error(),
		})
		return
	}

	nextDelay := retryDelay(job.Attempts + 1)
	nextAt := time.Now().UTC().Add(nextDelay).Format(time.RFC3339)
	if retryErr := s.store.RetryIndexingJob(ctx, job.DocumentID, nextAt, truncateErr(err)); retryErr != nil {
		s.log.Error("read-through retry update failed",
			slog.String("document_id", job.DocumentID),
			slog.String("error", retryErr.Error()),
		)
		return
	}
	s.appendIndexingAudit(ctx, store.IndexingAuditInput{
		Source:     job.Source,
		DocumentID: job.DocumentID,
		Collection: job.Collection,
		CID:        job.CID,
		Decision:   "retry_scheduled",
		Attempt:    job.Attempts + 1,
		Error:      err.Error(),
	})
}

func (s *Server) enqueueXRPCRecord(ctx context.Context, uri, cid string, value map[string]any) {
	s.enqueueRecordForIndexing(ctx, store.IndexSourceReadThrough, uri, cid, value)
}

func (s *Server) enqueueXRPCList(ctx context.Context, entries []xrpc.ListRecordEntry) {
	for _, entry := range entries {
		s.enqueueRecordForIndexing(ctx, store.IndexSourceReadThrough, entry.URI, entry.CID, entry.Value)
	}
}

func (s *Server) enqueueRecordForIndexing(
	ctx context.Context, source, uri, cid string, value map[string]any,
) {
	did, collection, rkey, err := normalize.ParseATURI(uri)
	if err != nil {
		s.appendIndexingAudit(ctx, store.IndexingAuditInput{
			Source:     source,
			DocumentID: uri,
			Collection: collection,
			CID:        cid,
			Decision:   "skip_invalid_uri",
			Error:      err.Error(),
		})
		return
	}

	documentID := normalize.StableID(did, collection, rkey)
	if source == store.IndexSourceReadThrough && s.policy.ReadThroughMode() == idx.ReadThroughOff {
		s.appendIndexingAudit(ctx, store.IndexingAuditInput{
			Source: source, DocumentID: documentID, Collection: collection, CID: cid,
			Decision: "skip_mode_off",
		})
		return
	}
	if !s.policy.Allows(source, collection) {
		s.appendIndexingAudit(ctx, store.IndexingAuditInput{
			Source: source, DocumentID: documentID, Collection: collection, CID: cid,
			Decision: "skip_collection",
		})
		return
	}
	if source == store.IndexSourceReadThrough && s.policy.ReadThroughMode() == idx.ReadThroughMissing {
		if s.shouldSkipReadThrough(ctx, documentID, cid) {
			s.appendIndexingAudit(ctx, store.IndexingAuditInput{
				Source: source, DocumentID: documentID, Collection: collection, CID: cid,
				Decision: "skip_already_indexed",
			})
			return
		}
	}

	payload, err := json.Marshal(value)
	if err != nil {
		s.appendIndexingAudit(ctx, store.IndexingAuditInput{
			Source: source, DocumentID: documentID, Collection: collection, CID: cid,
			Decision: "skip_unmarshalable_record", Error: err.Error(),
		})
		return
	}
	input := store.IndexingJobInput{
		DocumentID: documentID,
		DID:        did,
		Collection: collection,
		RKey:       rkey,
		CID:        cid,
		RecordJSON: string(payload),
		Source:     source,
	}
	if err := s.store.EnqueueIndexingJob(ctx, input); err != nil {
		s.log.Warn("enqueue indexing job failed",
			slog.String("document_id", documentID),
			slog.String("error", err.Error()),
		)
		return
	}
	s.appendIndexingAudit(ctx, store.IndexingAuditInput{
		Source: source, DocumentID: documentID, Collection: collection, CID: cid,
		Decision: "enqueued",
	})
}

func (s *Server) shouldSkipReadThrough(ctx context.Context, documentID, cid string) bool {
	doc, err := s.store.GetDocument(ctx, documentID)
	if err == nil && doc != nil && doc.CID == cid && doc.DeletedAt == "" {
		return true
	}
	job, err := s.store.GetIndexingJob(ctx, documentID)
	if err != nil || job == nil {
		return false
	}
	return job.CID == cid
}

func (s *Server) syncStateEntry(ctx context.Context, entry xrpc.ListRecordEntry) {
	did, collection, rkey, err := normalize.ParseATURI(entry.URI)
	if err != nil {
		return
	}
	event := normalize.TapRecordEvent{
		Type: "record",
		Record: &normalize.TapRecord{
			DID:        did,
			Collection: collection,
			RKey:       rkey,
			Action:     "create",
			CID:        entry.CID,
			Record:     entry.Value,
		},
	}
	result, err := s.processor.ProcessRecord(ctx, store.IndexSourceReadThrough, event)
	if err != nil {
		s.handleReadThroughFailure(ctx, &store.IndexingJob{
			DocumentID: normalize.StableID(did, collection, rkey),
			Collection: collection,
			CID:        entry.CID,
			Source:     store.IndexSourceReadThrough,
		}, err)
		return
	}
	if result != nil {
		s.appendIndexingAudit(ctx, store.IndexingAuditInput{
			Source:     store.IndexSourceReadThrough,
			DocumentID: result.DocumentID,
			Collection: result.Collection,
			CID:        result.CID,
			Decision:   result.Decision,
		})
	}
}

func (s *Server) appendIndexingAudit(ctx context.Context, input store.IndexingAuditInput) {
	if err := s.store.AppendIndexingAudit(ctx, input); err != nil {
		s.log.Debug("append indexing audit failed", slog.String("error", err.Error()))
	}
}
