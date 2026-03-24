---
title: Search
updated: 2026-03-24
---

Search lets users find repos, issues, PRs, profiles, and code snippets across the Tangled network. The API supports three modes with progressive capability.

## Modes

### Keyword Search (Implemented)

Full-text search powered by SQLite FTS5 with BM25 scoring. Queries are tokenized, matched against title, body, summary, repo name, author handle, and tags. Results are ranked by relevance with field-specific weights (title highest, then author handle, summary, body).

Snippets are generated from the body field with match terms wrapped in `<mark>` tags.

### Semantic Search (Planned)

Vector similarity search using **Nomic Embed Text v1.5**, deployed on Railway via the [nomic-embed template](https://railway.com/deploy/nomic-embed). The template runs Ollama behind an authenticated Caddy proxy.

**Embedding service:**

- Model: `nomic-embed-text:latest` (8192-token context, 768-dimensional vectors, Matryoshka support for variable dimensionality)
- Endpoint: `POST /api/embeddings` with Bearer token auth
- Request: `{ "model": "nomic-embed-text:latest", "prompt": "text to embed" }`
- Deployed as a separate Railway service alongside the API and indexer

**Pipeline:**

- The embed-worker consumes the `embedding_jobs` queue, calls the Nomic Embed service, and stores 768-dim vectors in the `document_embeddings` table
- Documents are embedded asynchronously after indexing — the embed-worker runs independently of the ingestion loop
- Search queries are embedded at request time (single prompt, low latency)
- Vectors are matched via DiskANN cosine similarity index in Turso

### Hybrid Search (Planned)

Weighted combination of keyword and semantic results. Default blend: 0.65 keyword + 0.35 semantic (configurable). Scores are normalized to [0, 1] before blending. Results are deduplicated by document ID with the higher score retained. Each result includes a `matched_by` field indicating which mode(s) contributed.

## API Contract

**`GET /search`** — Unified endpoint, routes by `mode` parameter.

### Parameters

| Param        | Required | Default | Description                           |
| ------------ | -------- | ------- | ------------------------------------- |
| `q`          | Yes      | —       | Query string                          |
| `mode`       | No       | keyword | keyword, semantic, or hybrid          |
| `limit`      | No       | 20      | Results per page (1–100)              |
| `offset`     | No       | 0       | Pagination offset                     |
| `collection` | No       | —       | Filter by collection NSID             |
| `type`       | No       | —       | Filter by record type                 |
| `author`     | No       | —       | Filter by handle or DID               |
| `repo`       | No       | —       | Filter by repo name or DID            |
| `language`   | No       | —       | Filter by primary language            |
| `from`       | No       | —       | Created after (ISO 8601)              |
| `to`         | No       | —       | Created before (ISO 8601)             |
| `state`      | No       | —       | Issue/PR state (open, closed, merged) |

### Response

```json
{
  "query": "tangled vue",
  "mode": "keyword",
  "total": 42,
  "limit": 20,
  "offset": 0,
  "results": [
    {
      "id": "did:plc:abc|sh.tangled.repo|my-repo",
      "collection": "sh.tangled.repo",
      "record_type": "repo",
      "title": "my-repo",
      "summary": "A Vue component library",
      "body_snippet": "...building <mark>Vue</mark> components for <mark>Tangled</mark>...",
      "score": 4.82,
      "matched_by": ["keyword"],
      "repo_name": "my-repo",
      "author_handle": "alice.bsky.social",
      "did": "did:plc:abc",
      "at_uri": "at://did:plc:abc/sh.tangled.repo/my-repo",
      "web_url": "https://tangled.sh/alice.bsky.social/my-repo",
      "created_at": "2026-01-15T10:00:00Z",
      "updated_at": "2026-03-20T14:30:00Z"
    }
  ]
}
```

## Pragmatic Search Strategy

Indexing via Tap is useful but has proven unreliable for maintaining complete, up-to-date coverage. The approach:

1. **Keyword search is the foundation.** It works now and covers the primary use case — finding repos, issues, and people by name or content.

2. **Constellation supplements search results.** Star counts and follower counts from Constellation can be used as ranking signals without needing to index interaction records ourselves.

3. **Semantic search is additive.** It improves discovery for vague queries but isn't required for the app to be useful. It ships when the embedding pipeline is stable.

4. **Graceful degradation.** The mobile app treats the search API as optional. If Twister is unavailable, handle-based direct browsing still works. Search results link into the same browsing screens.

## Quality Improvements (Planned)

- Field weight tuning based on real query patterns
- Recency boost for recently updated content
- Collection-aware ranking (repos weighted higher for short queries)
- Star count as a ranking signal (via Constellation)
- State filtering (exclude closed issues by default)
- Better snippet generation with longer context windows
- Relevance test fixtures for regression testing

## Mobile Integration

The app calls the search API from the Explore tab. Results are displayed in segmented views (repos, users, issues/PRs). Each result links to the corresponding browsing screen (repo detail, profile, issue detail).

When the search API is unavailable, the Explore tab shows an appropriate state rather than breaking. The Home tab's handle-based browsing is fully independent of search.
