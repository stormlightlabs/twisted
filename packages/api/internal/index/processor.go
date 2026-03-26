package index

import (
	"context"
	"fmt"
	"log/slog"

	"tangled.org/desertthunder.dev/twister/internal/normalize"
	"tangled.org/desertthunder.dev/twister/internal/store"
	"tangled.org/desertthunder.dev/twister/internal/xrpc"
)

type Result struct {
	Decision   string
	DocumentID string
	Collection string
	CID        string
}

type Processor struct {
	store    store.IndexingStore
	registry *normalize.Registry
	xrpc     *xrpc.Client
	policy   Policy
	log      *slog.Logger
}

func NewProcessor(
	st store.IndexingStore, registry *normalize.Registry, xrpcClient *xrpc.Client,
	policy Policy, log *slog.Logger,
) *Processor {
	if log == nil {
		log = slog.Default()
	}
	return &Processor{store: st, registry: registry, xrpc: xrpcClient, policy: policy, log: log}
}

func (p *Processor) ProcessRecord(
	ctx context.Context, source string, event normalize.TapRecordEvent,
) (*Result, error) {
	if event.Record == nil {
		return &Result{Decision: "skip_missing_record"}, nil
	}
	record := event.Record
	result := &Result{
		Decision:   "skip_unknown",
		DocumentID: normalize.StableID(record.DID, record.Collection, record.RKey),
		Collection: record.Collection,
		CID:        record.CID,
	}
	if !p.policy.Allows(source, record.Collection) {
		result.Decision = "skip_collection"
		return result, nil
	}
	if handler, ok := p.registry.StateHandler(record.Collection); ok {
		if record.Action == "delete" {
			result.Decision = "skip_state_delete"
			return result, nil
		}
		update, err := handler.HandleState(event)
		if err != nil {
			return result, &PermanentError{Decision: "invalid_state_record", Err: err}
		}
		if err := p.store.UpdateRecordState(ctx, update.SubjectURI, update.State); err != nil {
			return result, fmt.Errorf("update state: %w", err)
		}
		result.Decision = "state_updated"
		return result, nil
	}
	adapter, ok := p.registry.Adapter(record.Collection)
	if !ok {
		result.Decision = "skip_unsupported_collection"
		return result, nil
	}
	if record.Action == "delete" {
		if err := p.store.MarkDeleted(ctx, result.DocumentID); err != nil {
			return result, fmt.Errorf("mark deleted: %w", err)
		}
		result.Decision = "document_deleted"
		return result, nil
	}
	if record.Record == nil {
		return result, &PermanentError{Decision: "missing_record_payload"}
	}
	if !adapter.Searchable(record.Record) {
		result.Decision = "skip_unsearchable"
		return result, nil
	}
	doc, err := adapter.Normalize(event)
	if err != nil {
		return result, &PermanentError{Decision: "normalize_failed", Err: err}
	}
	if err := p.enrichDocument(ctx, doc, record.Record); err != nil {
		return result, err
	}
	if err := p.store.UpsertDocument(ctx, doc); err != nil {
		return result, fmt.Errorf("upsert document: %w", err)
	}
	result.Decision = "document_upserted"
	return result, nil
}
