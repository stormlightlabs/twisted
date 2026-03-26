package index

import (
	"context"

	"tangled.org/desertthunder.dev/twister/internal/normalize"
	"tangled.org/desertthunder.dev/twister/internal/store"
	"tangled.org/desertthunder.dev/twister/internal/xrpc"
)

func (p *Processor) enrichDocument(
	ctx context.Context, doc *store.Document, record map[string]any,
) error {
	handle, err := p.store.GetIdentityHandle(ctx, doc.DID)
	if err != nil {
		return err
	}
	if handle != "" {
		doc.AuthorHandle = handle
		if doc.RecordType == "profile" {
			doc.Title = handle
		}
	}
	if p.xrpc == nil {
		return nil
	}
	if doc.RepoDID != "" && doc.RepoName == "" {
		if uri := repoURIFromRecord(record); uri != "" {
			_, _, repoRKey, err := normalize.ParseATURI(uri)
			if err == nil && repoRKey != "" {
				if name, err := p.xrpc.ResolveRepoName(ctx, doc.RepoDID, repoRKey); err == nil {
					doc.RepoName = name
				}
			}
		}
	}
	if doc.AuthorHandle == "" && doc.DID != "" {
		if info, err := p.xrpc.ResolveIdentity(ctx, doc.DID); err == nil && info.Handle != "" {
			doc.AuthorHandle = info.Handle
			if doc.RecordType == "profile" {
				doc.Title = info.Handle
			}
		}
	}
	if doc.WebURL == "" {
		ownerHandle := doc.AuthorHandle
		if doc.RepoDID != "" && doc.RepoDID != doc.DID {
			if handle, err := p.store.GetIdentityHandle(ctx, doc.RepoDID); err == nil && handle != "" {
				ownerHandle = handle
			} else if info, err := p.xrpc.ResolveIdentity(ctx, doc.RepoDID); err == nil && info.Handle != "" {
				ownerHandle = info.Handle
			}
		}
		if ownerHandle == "" {
			if doc.RepoDID != "" && doc.RepoDID != doc.DID {
				ownerHandle = doc.RepoDID
			} else {
				ownerHandle = doc.DID
			}
		}
		doc.WebURL = xrpc.BuildWebURL(ownerHandle, doc.RepoName, doc.RecordType, doc.RKey)
	}
	return nil
}

func repoURIFromRecord(record map[string]any) string {
	if uri, _ := record["repo"].(string); uri != "" {
		return uri
	}
	target, _ := record["target"].(map[string]any)
	if uri, _ := target["repo"].(string); uri != "" {
		return uri
	}
	return ""
}
