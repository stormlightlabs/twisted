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

// DocumentFilter scopes a ListDocuments query to a subset of documents.
type DocumentFilter struct {
	Collection string // filter by collection NSID
	DID        string // filter by author DID
	DocumentID string // filter to a single document by stable ID
}

// Store is the persistence interface for Twister.
type Store interface {
	UpsertDocument(ctx context.Context, doc *Document) error
	GetDocument(ctx context.Context, id string) (*Document, error)
	MarkDeleted(ctx context.Context, id string) error
	ListDocuments(ctx context.Context, filter DocumentFilter) ([]*Document, error)
	OptimizeFTS(ctx context.Context) error
	GetSyncState(ctx context.Context, consumer string) (*SyncState, error)
	SetSyncState(ctx context.Context, consumer string, cursor string) error
	UpdateRecordState(ctx context.Context, subjectURI string, state string) error
	UpsertIdentityHandle(ctx context.Context, did, handle string, isActive bool, status string) error
	GetIdentityHandle(ctx context.Context, did string) (string, error)
	EnqueueEmbeddingJob(ctx context.Context, documentID string) error
	GetFollowSubjects(ctx context.Context, did string) ([]string, error)
	GetRepoCollaborators(ctx context.Context, repoOwnerDID string) ([]string, error)
	CountDocuments(ctx context.Context) (int64, error)
	Ping(ctx context.Context) error
}
