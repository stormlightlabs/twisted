package api

import (
	"context"
	"sort"
	"time"

	"tangled.org/desertthunder.dev/twister/internal/store"
)

type apiTestStore struct {
	docs    map[string]*store.Document
	jobs    map[string]*store.IndexingJob
	audits  []*store.IndexingAuditEntry
	handles map[string]string
}

func newAPITestStore() *apiTestStore {
	return &apiTestStore{
		docs:    map[string]*store.Document{},
		jobs:    map[string]*store.IndexingJob{},
		handles: map[string]string{},
	}
}

func (s *apiTestStore) UpsertDocument(_ context.Context, doc *store.Document) error {
	clone := *doc
	s.docs[doc.ID] = &clone
	return nil
}
func (s *apiTestStore) GetDocument(_ context.Context, id string) (*store.Document, error) {
	return s.docs[id], nil
}
func (s *apiTestStore) MarkDeleted(_ context.Context, id string) error {
	if doc := s.docs[id]; doc != nil {
		doc.DeletedAt = time.Now().UTC().Format(time.RFC3339)
	}
	return nil
}
func (s *apiTestStore) ListDocuments(_ context.Context, _ store.DocumentFilter) ([]*store.Document, error) {
	return nil, nil
}
func (s *apiTestStore) OptimizeSearchIndex(_ context.Context) error { return nil }
func (s *apiTestStore) GetSyncState(_ context.Context, _ string) (*store.SyncState, error) {
	return nil, nil
}
func (s *apiTestStore) SetSyncState(_ context.Context, _, _ string) error      { return nil }
func (s *apiTestStore) UpdateRecordState(_ context.Context, _, _ string) error { return nil }
func (s *apiTestStore) UpsertIdentityHandle(_ context.Context, did, handle string, _ bool, _ string) error {
	s.handles[did] = handle
	return nil
}
func (s *apiTestStore) GetIdentityHandle(_ context.Context, did string) (string, error) {
	return s.handles[did], nil
}
func (s *apiTestStore) GetIndexingJob(_ context.Context, documentID string) (*store.IndexingJob, error) {
	return s.jobs[documentID], nil
}
func (s *apiTestStore) EnqueueIndexingJob(_ context.Context, input store.IndexingJobInput) error {
	s.jobs[input.DocumentID] = &store.IndexingJob{
		DocumentID: input.DocumentID, DID: input.DID, Collection: input.Collection,
		RKey: input.RKey, CID: input.CID, RecordJSON: input.RecordJSON, Source: input.Source,
		Status: store.IndexingJobPending, ScheduledAt: time.Now().UTC().Format(time.RFC3339),
		UpdatedAt: time.Now().UTC().Format(time.RFC3339),
	}
	return nil
}
func (s *apiTestStore) ClaimIndexingJob(context.Context, string, string) (*store.IndexingJob, error) {
	return nil, nil
}
func (s *apiTestStore) CompleteIndexingJob(_ context.Context, documentID string) error {
	if j := s.jobs[documentID]; j != nil {
		j.Status = store.IndexingJobCompleted
	}
	return nil
}
func (s *apiTestStore) RetryIndexingJob(_ context.Context, documentID, nextAt, lastError string) error {
	if j := s.jobs[documentID]; j != nil {
		j.Status, j.ScheduledAt, j.LastError = store.IndexingJobPending, nextAt, lastError
		j.Attempts++
	}
	return nil
}
func (s *apiTestStore) FailIndexingJob(_ context.Context, documentID, status, lastError string) error {
	if j := s.jobs[documentID]; j != nil {
		j.Status, j.LastError = status, lastError
		j.Attempts++
	}
	return nil
}
func (s *apiTestStore) ListIndexingJobs(_ context.Context, filter store.IndexingJobFilter) ([]*store.IndexingJob, error) {
	out := []*store.IndexingJob{}
	for _, job := range s.jobs {
		if filter.DocumentID != "" && job.DocumentID != filter.DocumentID {
			continue
		}
		if filter.Status != "" && job.Status != filter.Status {
			continue
		}
		if filter.Source != "" && job.Source != filter.Source {
			continue
		}
		clone := *job
		out = append(out, &clone)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].DocumentID < out[j].DocumentID })
	return out, nil
}
func (s *apiTestStore) GetIndexingJobStats(_ context.Context) (*store.IndexingJobStats, error) {
	stats := &store.IndexingJobStats{}
	for _, job := range s.jobs {
		switch job.Status {
		case store.IndexingJobPending:
			stats.Pending++
		case store.IndexingJobProcessing:
			stats.Processing++
		case store.IndexingJobCompleted:
			stats.Completed++
		case store.IndexingJobFailed:
			stats.Failed++
		case store.IndexingJobDeadLetter:
			stats.DeadLetter++
		}
	}
	return stats, nil
}
func (s *apiTestStore) AppendIndexingAudit(_ context.Context, input store.IndexingAuditInput) error {
	s.audits = append(s.audits, &store.IndexingAuditEntry{
		ID: int64(len(s.audits) + 1), Source: input.Source, DocumentID: input.DocumentID,
		Collection: input.Collection, CID: input.CID, Decision: input.Decision,
		Attempt: input.Attempt, Error: input.Error, CreatedAt: time.Now().UTC().Format(time.RFC3339),
	})
	return nil
}
func (s *apiTestStore) ListIndexingAudit(_ context.Context, filter store.IndexingAuditFilter) ([]*store.IndexingAuditEntry, error) {
	out := []*store.IndexingAuditEntry{}
	for _, entry := range s.audits {
		if filter.DocumentID != "" && entry.DocumentID != filter.DocumentID {
			continue
		}
		if filter.Source != "" && entry.Source != filter.Source {
			continue
		}
		if filter.Decision != "" && entry.Decision != filter.Decision {
			continue
		}
		out = append(out, entry)
	}
	return out, nil
}
func (s *apiTestStore) GetFollowSubjects(context.Context, string) ([]string, error) { return nil, nil }
func (s *apiTestStore) GetRepoCollaborators(context.Context, string) ([]string, error) {
	return nil, nil
}
func (s *apiTestStore) CountDocuments(_ context.Context) (int64, error) {
	return int64(len(s.docs)), nil
}
func (s *apiTestStore) CountPendingIndexingJobs(_ context.Context) (int64, error) { return 0, nil }
func (s *apiTestStore) InsertJetstreamEvent(context.Context, *store.JetstreamEvent, int) error {
	return nil
}
func (s *apiTestStore) ListJetstreamEvents(context.Context, store.JetstreamEventFilter) ([]*store.JetstreamEvent, error) {
	return nil, nil
}
func (s *apiTestStore) Ping(context.Context) error { return nil }
