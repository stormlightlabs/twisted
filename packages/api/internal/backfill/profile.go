package backfill

import (
	"context"
	"errors"
	"fmt"

	"tangled.org/desertthunder.dev/twister/internal/normalize"
	"tangled.org/desertthunder.dev/twister/internal/store"
	"tangled.org/desertthunder.dev/twister/internal/xrpc"
)

const profileCollection = "sh.tangled.actor.profile"
const repoCollection = "sh.tangled.repo"

// ProfileRecord holds the fetched profile data and resolved handle.
type ProfileRecord struct {
	Record map[string]any
	CID    string
	Handle string
}

type profileFetcher interface {
	FetchProfile(ctx context.Context, did string) (*ProfileRecord, error)
}

type RepoRecord struct {
	RKey   string
	CID    string
	Record map[string]any
}

type repoFetcher interface {
	ListRepos(ctx context.Context, did string) ([]RepoRecord, error)
}

// XRPCProfileFetcher fetches sh.tangled.actor.profile records via xrpc.Client
// and resolves handles from the DID document.
type XRPCProfileFetcher struct {
	client *xrpc.Client
}

func NewXRPCProfileFetcher(client *xrpc.Client) *XRPCProfileFetcher {
	return &XRPCProfileFetcher{client: client}
}

func (f *XRPCProfileFetcher) FetchProfile(ctx context.Context, did string) (*ProfileRecord, error) {
	info, err := f.client.ResolveIdentity(ctx, did)
	if err != nil {
		return nil, fmt.Errorf("resolve identity: %w", err)
	}

	rec, err := f.client.GetRecord(ctx, info.PDS, did, profileCollection, "self")
	if err != nil {
		var nfe *xrpc.NotFoundError
		if errors.As(err, &nfe) {
			return &ProfileRecord{Handle: info.Handle}, nil
		}
		return nil, fmt.Errorf("getRecord: %w", err)
	}

	return &ProfileRecord{
		Record: rec.Value,
		CID:    rec.CID,
		Handle: info.Handle,
	}, nil
}

type XRPCRepoFetcher struct {
	client *xrpc.Client
}

func NewXRPCRepoFetcher(client *xrpc.Client) *XRPCRepoFetcher {
	return &XRPCRepoFetcher{client: client}
}

func (f *XRPCRepoFetcher) ListRepos(ctx context.Context, did string) ([]RepoRecord, error) {
	info, err := f.client.ResolveIdentity(ctx, did)
	if err != nil {
		return nil, fmt.Errorf("resolve identity: %w", err)
	}

	records, err := f.client.ListAllRecords(ctx, info.PDS, did, repoCollection)
	if err != nil {
		return nil, fmt.Errorf("list repos: %w", err)
	}

	repos := make([]RepoRecord, 0, len(records))
	for _, rec := range records {
		_, _, rkey, err := normalize.ParseATURI(rec.URI)
		if err != nil {
			continue
		}
		repos = append(repos, RepoRecord{
			RKey:   rkey,
			CID:    rec.CID,
			Record: rec.Value,
		})
	}
	return repos, nil
}

func bootstrapProfileDocument(did string, profile *ProfileRecord, handle string) *store.Document {
	if profile == nil || profile.Record == nil {
		return nil
	}

	description, _ := profile.Record["description"].(string)
	location, _ := profile.Record["location"].(string)
	summary := description
	if location != "" {
		if summary != "" {
			summary = summary + " · " + location
		} else {
			summary = location
		}
	}
	if len(summary) > 200 {
		summary = summary[:200]
	}

	return &store.Document{
		ID:           fmt.Sprintf("%s|%s|self", did, profileCollection),
		DID:          did,
		Collection:   profileCollection,
		RKey:         "self",
		ATURI:        fmt.Sprintf("at://%s/%s/self", did, profileCollection),
		CID:          profile.CID,
		RecordType:   "profile",
		Title:        handle,
		Body:         description,
		Summary:      summary,
		AuthorHandle: handle,
		TagsJSON:     "[]",
	}
}

func bootstrapRepoDocument(did, handle string, repo RepoRecord) *store.Document {
	adapter := &normalize.RepoAdapter{}
	if !adapter.Searchable(repo.Record) {
		return nil
	}

	event := normalize.TapRecordEvent{
		Type: "record",
		Record: &normalize.TapRecord{
			DID:        did,
			Collection: repoCollection,
			RKey:       repo.RKey,
			CID:        repo.CID,
			Record:     repo.Record,
		},
	}

	doc, err := adapter.Normalize(event)
	if err != nil {
		return nil
	}
	doc.AuthorHandle = handle
	doc.WebURL = xrpc.BuildWebURL(handle, doc.RepoName, doc.RecordType, doc.RKey)
	return doc
}
