package store

import "context"

const (
	IndexSourceTap         = "tap"
	IndexSourceReadThrough = "read_through"
	IndexSourceBackfill    = "backfill"
	IndexSourceAdmin       = "admin"

	IndexingJobPending    = "pending"
	IndexingJobProcessing = "processing"
	IndexingJobCompleted  = "completed"
	IndexingJobFailed     = "failed"
	IndexingJobDeadLetter = "dead_letter"
)

type IndexingJobFilter struct {
	Status     string
	Source     string
	DocumentID string
	Limit      int
	Offset     int
}

type IndexingAuditFilter struct {
	Source     string
	Decision   string
	DocumentID string
	Limit      int
	Offset     int
}

type IndexingJobStats struct {
	Pending         int64
	Processing      int64
	Completed       int64
	Failed          int64
	DeadLetter      int64
	OldestPendingAt string
	OldestRunningAt string
	LastCompletedAt string
	LastProcessedAt string
}

type IndexingAuditEntry struct {
	ID         int64
	Source     string
	DocumentID string
	Collection string
	CID        string
	Decision   string
	Attempt    int
	Error      string
	CreatedAt  string
}

type IndexingAuditInput struct {
	Source     string
	DocumentID string
	Collection string
	CID        string
	Decision   string
	Attempt    int
	Error      string
}

type IndexingStore interface {
	GetDocument(ctx context.Context, id string) (*Document, error)
	GetIdentityHandle(ctx context.Context, did string) (string, error)
	MarkDeleted(ctx context.Context, id string) error
	UpdateRecordState(ctx context.Context, subjectURI string, state string) error
	UpsertDocument(ctx context.Context, doc *Document) error
}
