package store

import "context"

// Document is the denormalized search document stored in the database.
type Document struct {
	ID           string
	DID          string
	Collection   string
	RKey         string
	ATURI        string
	CID          string
	RecordType   string
	Title        string
	Body         string
	Summary      string
	RepoDID      string
	RepoName     string
	AuthorHandle string
	TagsJSON     string
	Language     string
	CreatedAt    string
	UpdatedAt    string
	IndexedAt    string
	WebURL       string
	DeletedAt    string
}

// SyncState tracks the Tap consumer cursor for resuming on restart.
type SyncState struct {
	ConsumerName  string
	Cursor        string
	HighWaterMark string
	UpdatedAt     string
}

// RecordState caches issue/PR open-closed-merged state.
type RecordState struct {
	SubjectURI string
	State      string
	UpdatedAt  string
}

// IndexingJob stores queued read-through indexing work fetched through the API.
type IndexingJob struct {
	DocumentID  string
	DID         string
	Collection  string
	RKey        string
	CID         string
	RecordJSON  string
	Source      string
	Attempts    int
	Status      string
	LastError   string
	ScheduledAt string
	UpdatedAt   string
	LeaseOwner  string
	LeaseUntil  string
	CompletedAt string
}

// JetstreamEvent is a cached JetStream activity event.
type JetstreamEvent struct {
	ID         int64
	TimeUS     int64
	DID        string
	Kind       string
	Collection string
	RKey       string
	Operation  string
	Payload    string
	ReceivedAt string
}

// JetstreamEventFilter scopes a ListJetstreamEvents query.
type JetstreamEventFilter struct {
	Collection string
	DID        string
	Operation  string
	Limit      int
	Offset     int
}

// IndexingJobInput is the payload used to enqueue or refresh an indexing job.
type IndexingJobInput struct {
	DocumentID string
	DID        string
	Collection string
	RKey       string
	CID        string
	RecordJSON string
	Source     string
}

// DocumentFilter scopes a ListDocuments query to a subset of documents.
type DocumentFilter struct {
	// filter by collection NSID
	Collection string
	// filter by author DID
	DID string
	// filter to a single document by stable ID
	DocumentID string
}

// Store is the persistence interface for Twister.
type Store interface {
	UpsertDocument(ctx context.Context, doc *Document) error
	GetDocument(ctx context.Context, id string) (*Document, error)
	MarkDeleted(ctx context.Context, id string) error
	ListDocuments(ctx context.Context, filter DocumentFilter) ([]*Document, error)
	OptimizeSearchIndex(ctx context.Context) error
	GetSyncState(ctx context.Context, consumer string) (*SyncState, error)
	SetSyncState(ctx context.Context, consumer string, cursor string) error
	UpdateRecordState(ctx context.Context, subjectURI string, state string) error
	UpsertIdentityHandle(ctx context.Context, did, handle string, isActive bool, status string) error
	GetIdentityHandle(ctx context.Context, did string) (string, error)
	GetIndexingJob(ctx context.Context, documentID string) (*IndexingJob, error)
	EnqueueIndexingJob(ctx context.Context, input IndexingJobInput) error
	ClaimIndexingJob(ctx context.Context, workerID string, leaseUntil string) (*IndexingJob, error)
	CompleteIndexingJob(ctx context.Context, documentID string) error
	RetryIndexingJob(ctx context.Context, documentID string, nextScheduledAt string, lastError string) error
	FailIndexingJob(ctx context.Context, documentID string, status string, lastError string) error
	ListIndexingJobs(ctx context.Context, filter IndexingJobFilter) ([]*IndexingJob, error)
	GetIndexingJobStats(ctx context.Context) (*IndexingJobStats, error)
	AppendIndexingAudit(ctx context.Context, input IndexingAuditInput) error
	ListIndexingAudit(ctx context.Context, filter IndexingAuditFilter) ([]*IndexingAuditEntry, error)
	GetFollowSubjects(ctx context.Context, did string) ([]string, error)
	GetRepoCollaborators(ctx context.Context, repoOwnerDID string) ([]string, error)
	CountDocuments(ctx context.Context) (int64, error)
	CountPendingIndexingJobs(ctx context.Context) (int64, error)
	InsertJetstreamEvent(ctx context.Context, event *JetstreamEvent, maxEvents int) error
	ListJetstreamEvents(ctx context.Context, filter JetstreamEventFilter) ([]*JetstreamEvent, error)
	Ping(ctx context.Context) error
}
