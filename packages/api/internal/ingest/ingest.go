package ingest

import (
	"context"
	"fmt"
	"log/slog"
	"math"
	"strconv"
	"strings"
	"sync"
	"time"

	idx "tangled.org/desertthunder.dev/twister/internal/index"
	"tangled.org/desertthunder.dev/twister/internal/normalize"
	"tangled.org/desertthunder.dev/twister/internal/store"
	"tangled.org/desertthunder.dev/twister/internal/xrpc"
)

const (
	defaultConsumerName = "indexer-tap-v1"
	maxDBRetryBackoff   = 5 * time.Second
	statusLogInterval   = 30 * time.Second
)

type client interface {
	ReadEvent(ctx context.Context) (normalize.TapRecordEvent, error)
	AckEvent(ctx context.Context, id int64) error
	Close() error
}

// Runner ingests Tap events into the store.
type Runner struct {
	store        store.Store
	tap          client
	registry     *normalize.Registry
	policy       idx.Policy
	processor    *idx.Processor
	consumerName string
	log          *slog.Logger
	resumeCursor int64

	statusMu      sync.Mutex
	lastCursor    string
	processedTick int64
}

func NewRunner(st store.Store, registry *normalize.Registry, tap client, indexedCollections string, log *slog.Logger) *Runner {
	if log == nil {
		log = slog.Default()
	}
	policy := idx.NewPolicy(indexedCollections, indexedCollections, idx.ReadThroughMissing)
	return &Runner{
		store:        st,
		tap:          tap,
		registry:     registry,
		policy:       policy,
		processor:    idx.NewProcessor(st, registry, nil, policy, log),
		consumerName: defaultConsumerName,
		log:          log,
	}
}

// SetXRPCClient enables ingest-time enrichment via XRPC lookups.
func (r *Runner) SetXRPCClient(c *xrpc.Client) {
	if c == nil {
		return
	}
	r.processor = idx.NewProcessor(r.store, r.registry, c, r.policy, r.log)
}

func (r *Runner) Run(ctx context.Context) error {
	defer r.tap.Close()
	if err := r.initializeCursor(ctx); err != nil {
		return err
	}

	go r.runStatusLogger(ctx)

	for {
		if ctx.Err() != nil {
			return nil
		}

		event, err := r.tap.ReadEvent(ctx)
		if err != nil {
			if ctx.Err() != nil {
				return nil
			}
			r.log.Warn("tap read error", slog.String("error", err.Error()))
			continue
		}

		if r.shouldSkipEvent(event.ID) {
			if err := r.tap.AckEvent(ctx, event.ID); err != nil {
				r.log.Warn("tap ack skipped event failed",
					slog.Int64("event_id", event.ID),
					slog.String("error", err.Error()),
				)
				continue
			}
			r.log.Debug("skipped previously-processed event", slog.Int64("event_id", event.ID), slog.Int64("resume_cursor", r.resumeCursor))
			continue
		}

		if err := r.processWithRetry(ctx, event); err != nil {
			if ctx.Err() != nil {
				return nil
			}
			return err
		}
	}
}

func (r *Runner) initializeCursor(ctx context.Context) error {
	state, err := r.store.GetSyncState(ctx, r.consumerName)
	if err != nil {
		return fmt.Errorf("load sync cursor: %w", err)
	}
	if state == nil || strings.TrimSpace(state.Cursor) == "" {
		r.log.Info("indexer cursor resume disabled", slog.String("reason", "no prior sync_state"))
		return nil
	}

	cursor, err := strconv.ParseInt(strings.TrimSpace(state.Cursor), 10, 64)
	if err != nil {
		r.log.Warn("indexer cursor parse failed; resume disabled",
			slog.String("cursor", state.Cursor),
			slog.String("error", err.Error()),
		)
		return nil
	}

	r.resumeCursor = cursor
	r.statusMu.Lock()
	r.lastCursor = state.Cursor
	r.statusMu.Unlock()
	r.log.Info("indexer cursor resume enabled", slog.Int64("resume_cursor", cursor))
	return nil
}

func (r *Runner) shouldSkipEvent(eventID int64) bool {
	return r.resumeCursor > 0 && eventID <= r.resumeCursor
}

func (r *Runner) processWithRetry(ctx context.Context, event normalize.TapRecordEvent) error {
	attempt := 0
	for {
		if ctx.Err() != nil {
			return ctx.Err()
		}

		err := r.processEvent(ctx, event)
		if err == nil {
			return nil
		}

		attempt++
		backoff := retryBackoff(attempt)
		r.log.Warn("ingest retry",
			slog.Int64("event_id", event.ID),
			slog.Int("attempt", attempt),
			slog.Duration("retry_in", backoff),
			slog.String("error", err.Error()),
		)

		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(backoff):
		}
	}
}

func (r *Runner) processEvent(ctx context.Context, event normalize.TapRecordEvent) error {
	switch event.Type {
	case "identity":
		if event.Identity == nil {
			return r.advanceCursorAndAck(ctx, event.ID)
		}
		id := event.Identity
		if err := r.store.UpsertIdentityHandle(ctx, id.DID, id.Handle, id.IsActive, id.Status); err != nil {
			return err
		}
		return r.advanceCursorAndAck(ctx, event.ID)
	case "record":
		return r.processRecordEvent(ctx, event)
	default:
		return r.advanceCursorAndAck(ctx, event.ID)
	}
}

func (r *Runner) processRecordEvent(ctx context.Context, event normalize.TapRecordEvent) error {
	record := event.Record
	result, err := r.processor.ProcessRecord(ctx, store.IndexSourceTap, event)
	if perr, ok := idx.IsPermanent(err); ok {
		r.log.Warn("tap processing skipped",
			slog.Int64("event_id", event.ID),
			slog.String("collection", record.Collection),
			slog.String("did", record.DID),
			slog.String("rkey", record.RKey),
			slog.String("decision", perr.Decision),
			slog.String("error", perr.Error()),
		)
		_ = r.store.AppendIndexingAudit(ctx, store.IndexingAuditInput{
			Source:     store.IndexSourceTap,
			DocumentID: normalize.StableID(record.DID, record.Collection, record.RKey),
			Collection: record.Collection,
			CID:        record.CID,
			Decision:   perr.Decision,
			Error:      perr.Error(),
		})
		return r.advanceCursorAndAck(ctx, event.ID)
	}
	if err != nil {
		return err
	}
	if result != nil {
		_ = r.store.AppendIndexingAudit(ctx, store.IndexingAuditInput{
			Source:     store.IndexSourceTap,
			DocumentID: result.DocumentID,
			Collection: result.Collection,
			CID:        result.CID,
			Decision:   result.Decision,
		})
	}
	return r.advanceCursorAndAck(ctx, event.ID)
}

func (r *Runner) advanceCursorAndAck(ctx context.Context, eventID int64) error {
	cursor := fmt.Sprintf("%d", eventID)
	if err := r.persistCursorWithRetry(ctx, cursor, eventID); err != nil {
		return err
	}
	if err := r.tap.AckEvent(ctx, eventID); err != nil {
		return err
	}
	r.markProcessed(cursor)
	return nil
}

func (r *Runner) persistCursorWithRetry(ctx context.Context, cursor string, eventID int64) error {
	attempt := 0
	for {
		if ctx.Err() != nil {
			return ctx.Err()
		}
		if err := r.store.SetSyncState(ctx, r.consumerName, cursor); err == nil {
			return nil
		} else {
			attempt++
			backoff := retryBackoff(attempt)
			r.log.Error("cursor persist failed before ack",
				slog.Int64("event_id", eventID),
				slog.Int("attempt", attempt),
				slog.Duration("retry_in", backoff),
				slog.String("error", err.Error()),
			)
			select {
			case <-ctx.Done():
				return ctx.Err()
			case <-time.After(backoff):
			}
		}
	}
}

func (r *Runner) runStatusLogger(ctx context.Context) {
	ticker := time.NewTicker(statusLogInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			r.statusMu.Lock()
			cursor := r.lastCursor
			processed := r.processedTick
			r.processedTick = 0
			r.statusMu.Unlock()

			docs, err := r.store.CountDocuments(ctx)
			if err != nil {
				r.log.Warn("indexer status failed", slog.String("error", err.Error()))
				continue
			}
			r.log.Info("indexer status",
				slog.String("cursor", cursor),
				slog.Int64("events_processed", processed),
				slog.Int64("documents", docs),
			)
		}
	}
}

func (r *Runner) markProcessed(cursor string) {
	r.statusMu.Lock()
	r.lastCursor = cursor
	r.processedTick++
	r.statusMu.Unlock()
}

func retryBackoff(attempt int) time.Duration {
	if attempt < 1 {
		attempt = 1
	}
	exponent := math.Pow(2, float64(attempt-1))
	d := time.Duration(float64(time.Second) * exponent)
	if d > maxDBRetryBackoff {
		return maxDBRetryBackoff
	}
	return d
}
