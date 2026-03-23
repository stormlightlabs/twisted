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

	"tangled.org/desertthunder.dev/twister/internal/normalize"
	"tangled.org/desertthunder.dev/twister/internal/store"
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
	registry     *normalize.Registry
	tap          client
	allowlist    allowlist
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
	return &Runner{
		store:        st,
		registry:     registry,
		tap:          tap,
		allowlist:    parseAllowlist(indexedCollections),
		consumerName: defaultConsumerName,
		log:          log,
	}
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
			r.log.Info("skipped previously-processed event", slog.Int64("event_id", event.ID), slog.Int64("resume_cursor", r.resumeCursor))
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
	if event.Record == nil {
		return r.advanceCursorAndAck(ctx, event.ID)
	}

	record := event.Record
	if !r.allowlist.match(record.Collection) {
		return r.advanceCursorAndAck(ctx, event.ID)
	}

	if handler, ok := r.registry.StateHandler(record.Collection); ok {
		if record.Action == "delete" {
			return r.advanceCursorAndAck(ctx, event.ID)
		}
		update, err := handler.HandleState(event)
		if err != nil {
			r.log.Warn("state normalization failed",
				slog.Int64("event_id", event.ID),
				slog.String("collection", record.Collection),
				slog.String("did", record.DID),
				slog.String("rkey", record.RKey),
				slog.String("error", err.Error()),
			)
			return r.advanceCursorAndAck(ctx, event.ID)
		}
		if err := r.store.UpdateRecordState(ctx, update.SubjectURI, update.State); err != nil {
			return err
		}
		return r.advanceCursorAndAck(ctx, event.ID)
	}

	adapter, ok := r.registry.Adapter(record.Collection)
	if !ok {
		return r.advanceCursorAndAck(ctx, event.ID)
	}

	switch record.Action {
	case "delete":
		docID := normalize.StableID(record.DID, record.Collection, record.RKey)
		if err := r.store.MarkDeleted(ctx, docID); err != nil {
			return err
		}
		return r.advanceCursorAndAck(ctx, event.ID)
	case "create", "update":
		if record.Record == nil {
			r.log.Warn("record payload missing",
				slog.Int64("event_id", event.ID),
				slog.String("collection", record.Collection),
				slog.String("did", record.DID),
				slog.String("rkey", record.RKey),
			)
			return r.advanceCursorAndAck(ctx, event.ID)
		}
	default:
		return r.advanceCursorAndAck(ctx, event.ID)
	}

	doc, err := adapter.Normalize(event)
	if err != nil {
		r.log.Warn("normalization failed",
			slog.Int64("event_id", event.ID),
			slog.String("collection", record.Collection),
			slog.String("did", record.DID),
			slog.String("rkey", record.RKey),
			slog.String("error", err.Error()),
		)
		return r.advanceCursorAndAck(ctx, event.ID)
	}

	handle, err := r.store.GetIdentityHandle(ctx, record.DID)
	if err != nil {
		return err
	}
	if handle != "" {
		doc.AuthorHandle = handle
		if doc.RecordType == "profile" {
			doc.Title = handle
		}
	}

	if err := r.store.UpsertDocument(ctx, doc); err != nil {
		return err
	}

	if adapter.Searchable(record.Record) {
		if err := r.store.EnqueueEmbeddingJob(ctx, doc.ID); err != nil {
			r.log.Warn("embedding enqueue failed",
				slog.Int64("event_id", event.ID),
				slog.String("document_id", doc.ID),
				slog.String("error", err.Error()),
			)
		}
	}

	return r.advanceCursorAndAck(ctx, event.ID)
}

func (r *Runner) advanceCursorAndAck(ctx context.Context, eventID int64) error {
	cursor := fmt.Sprintf("%d", eventID)
	if err := r.tap.AckEvent(ctx, eventID); err != nil {
		return err
	}
	if err := r.persistCursorWithRetry(ctx, cursor, eventID); err != nil {
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
			r.log.Error("cursor persist failed after ack",
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

type allowlist struct {
	entries []string
}

func parseAllowlist(raw string) allowlist {
	if strings.TrimSpace(raw) == "" {
		return allowlist{entries: nil}
	}
	parts := strings.FieldsFunc(raw, func(r rune) bool {
		return r == ',' || r == ' ' || r == '\n' || r == '\t'
	})
	entries := make([]string, 0, len(parts))
	for _, part := range parts {
		entry := strings.TrimSpace(part)
		if entry == "" {
			continue
		}
		entries = append(entries, entry)
	}
	return allowlist{entries: entries}
}

func (a allowlist) match(collection string) bool {
	if len(a.entries) == 0 {
		return true
	}
	for _, entry := range a.entries {
		if entry == collection {
			return true
		}
		if strings.HasSuffix(entry, "*") {
			prefix := strings.TrimSuffix(entry, "*")
			if strings.HasPrefix(collection, prefix) {
				return true
			}
		}
	}
	return false
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
