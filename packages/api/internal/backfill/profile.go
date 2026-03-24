package backfill

import (
	"context"
	"errors"
	"fmt"

	"tangled.org/desertthunder.dev/twister/internal/xrpc"
)

const profileCollection = "sh.tangled.actor.profile"

// ProfileRecord holds the fetched profile data and resolved handle.
type ProfileRecord struct {
	Record map[string]any
	CID    string
	Handle string
}

type profileFetcher interface {
	FetchProfile(ctx context.Context, did string) (*ProfileRecord, error)
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
