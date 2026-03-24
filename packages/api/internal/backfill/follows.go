package backfill

import (
	"context"
	"fmt"

	"tangled.org/desertthunder.dev/twister/internal/xrpc"
)

const followCollection = "sh.tangled.graph.follow"

type followFetcher interface {
	ListFollowSubjects(ctx context.Context, did string) ([]string, error)
}

// XRPCFollowFetcher resolves a DID's PDS endpoint and reads follow records
// via xrpc.Client.
type XRPCFollowFetcher struct {
	client *xrpc.Client
}

func NewXRPCFollowFetcher(client *xrpc.Client) *XRPCFollowFetcher {
	return &XRPCFollowFetcher{client: client}
}

func (f *XRPCFollowFetcher) ListFollowSubjects(ctx context.Context, did string) ([]string, error) {
	records, err := f.client.ListAllRecords(ctx, "", did, followCollection)
	if err != nil {
		return nil, fmt.Errorf("list follow records for %s: %w", did, err)
	}

	seen := map[string]bool{}
	var subjects []string
	for _, rec := range records {
		subject, _ := rec.Value["subject"].(string)
		if !isDID(subject) || seen[subject] {
			continue
		}
		seen[subject] = true
		subjects = append(subjects, subject)
	}

	return subjects, nil
}
