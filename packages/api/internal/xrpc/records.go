package xrpc

import (
	"context"
	"encoding/json"
	"fmt"
	"net/url"
	"strings"
)

// GetRecordResponse is the response from com.atproto.repo.getRecord.
type GetRecordResponse struct {
	URI   string         `json:"uri"`
	CID   string         `json:"cid"`
	Value map[string]any `json:"value"`
}

// ListRecordsResponse is the response from com.atproto.repo.listRecords.
type ListRecordsResponse struct {
	Cursor  string            `json:"cursor"`
	Records []ListRecordEntry `json:"records"`
}

// ListRecordEntry is a single record in a listRecords response.
type ListRecordEntry struct {
	URI   string         `json:"uri"`
	CID   string         `json:"cid"`
	Value map[string]any `json:"value"`
}

// GetRecord fetches a single record via com.atproto.repo.getRecord.
// If pdsURL is empty, it resolves the PDS from the repo DID.
func (c *Client) GetRecord(ctx context.Context, pdsURL, repo, collection, rkey string) (*GetRecordResponse, error) {
	pds, err := c.ensurePDS(ctx, pdsURL, repo)
	if err != nil {
		return nil, err
	}

	params := url.Values{
		"repo":       {repo},
		"collection": {collection},
		"rkey":       {rkey},
	}

	body, err := c.Call(ctx, strings.TrimSuffix(pds, "/"), "com.atproto.repo.getRecord", params)
	if err != nil {
		return nil, err
	}
	defer body.Close()

	var resp GetRecordResponse
	if err := json.NewDecoder(body).Decode(&resp); err != nil {
		return nil, fmt.Errorf("decode getRecord response: %w", err)
	}
	return &resp, nil
}

// ListRecords fetches a page of records via com.atproto.repo.listRecords.
// If pdsURL is empty, it resolves the PDS from the repo DID.
func (c *Client) ListRecords(ctx context.Context, pdsURL, repo, collection string, limit int, cursor string) (*ListRecordsResponse, error) {
	pds, err := c.ensurePDS(ctx, pdsURL, repo)
	if err != nil {
		return nil, err
	}

	params := url.Values{
		"repo":       {repo},
		"collection": {collection},
		"limit":      {fmt.Sprintf("%d", limit)},
	}
	if cursor != "" {
		params.Set("cursor", cursor)
	}

	body, err := c.Call(ctx, strings.TrimSuffix(pds, "/"), "com.atproto.repo.listRecords", params)
	if err != nil {
		return nil, err
	}
	defer body.Close()

	var resp ListRecordsResponse
	if err := json.NewDecoder(body).Decode(&resp); err != nil {
		return nil, fmt.Errorf("decode listRecords response: %w", err)
	}
	return &resp, nil
}

const maxPaginationPages = 100

// ListAllRecords auto-paginates through all records in a collection.
// If pdsURL is empty, it resolves the PDS from the repo DID.
func (c *Client) ListAllRecords(ctx context.Context, pdsURL, repo, collection string) ([]ListRecordEntry, error) {
	var all []ListRecordEntry
	cursor := ""

	for page := 0; page < maxPaginationPages; page++ {
		resp, err := c.ListRecords(ctx, pdsURL, repo, collection, 100, cursor)
		if err != nil {
			return all, err
		}
		all = append(all, resp.Records...)

		if resp.Cursor == "" || resp.Cursor == cursor {
			break
		}
		cursor = resp.Cursor
	}

	return all, nil
}

func (c *Client) ensurePDS(ctx context.Context, pdsURL, repo string) (string, error) {
	if pdsURL != "" {
		return pdsURL, nil
	}
	if !strings.HasPrefix(repo, "did:") {
		return "", fmt.Errorf("cannot auto-resolve PDS: repo %q is not a DID", repo)
	}
	info, err := c.ResolveIdentity(ctx, repo)
	if err != nil {
		return "", fmt.Errorf("resolve pds for %s: %w", repo, err)
	}
	return info.PDS, nil
}
