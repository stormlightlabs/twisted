package xrpc

import (
	"context"
	"fmt"
	"strings"
)

const repoCollection = "sh.tangled.repo"

// ResolveRepoName resolves a repo DID + rkey to the repo's human-readable name.
// It resolves the identity for PDS discovery, then fetches the repo record
// and extracts the "name" field.
func (c *Client) ResolveRepoName(ctx context.Context, repoDID, repoRKey string) (string, error) {
	cacheKey := repoDID + "/" + repoRKey
	if name, ok := c.repoNameCache.Get(cacheKey); ok {
		return name, nil
	}

	rec, err := c.GetRecord(ctx, "", repoDID, repoCollection, repoRKey)
	if err != nil {
		return "", fmt.Errorf("fetch repo record %s/%s: %w", repoDID, repoRKey, err)
	}

	name, _ := rec.Value["name"].(string)
	if name == "" {
		return "", fmt.Errorf("repo record %s/%s has no name field", repoDID, repoRKey)
	}

	c.repoNameCache.Set(cacheKey, name)
	return name, nil
}

// BuildWebURL builds a canonical tangled.sh URL for a record.
// recordType should be one of: "repo", "issue", "pull", "issue_comment", "pull_comment", "profile".
func BuildWebURL(ownerHandle, repoName, recordType, rkey string) string {
	if ownerHandle == "" {
		return ""
	}
	owner := strings.TrimPrefix(ownerHandle, "@")

	switch recordType {
	case "profile":
		return fmt.Sprintf("https://tangled.sh/%s", owner)
	case "repo":
		if repoName == "" {
			return ""
		}
		return fmt.Sprintf("https://tangled.sh/%s/%s", owner, repoName)
	case "issue":
		if repoName == "" || rkey == "" {
			return ""
		}
		return fmt.Sprintf("https://tangled.sh/%s/%s/issues/%s", owner, repoName, rkey)
	case "pull":
		if repoName == "" || rkey == "" {
			return ""
		}
		return fmt.Sprintf("https://tangled.sh/%s/%s/pulls/%s", owner, repoName, rkey)
	case "issue_comment":
		if repoName == "" {
			return ""
		}
		return fmt.Sprintf("https://tangled.sh/%s/%s/issues", owner, repoName)
	case "pull_comment":
		if repoName == "" {
			return ""
		}
		return fmt.Sprintf("https://tangled.sh/%s/%s/pulls", owner, repoName)
	default:
		return ""
	}
}
