---
title: "Spec 05 — Search"
updated: 2026-03-22
---

Covers all search modes, the public search API contract, scoring, and filtering.

## 1. Search Modes

| Mode       | Backing                              | Available |
| ---------- | ------------------------------------ | --------- |
| `keyword`  | Turso Tantivy-backed FTS             | MVP       |
| `semantic` | Vector similarity (DiskANN index)    | Phase 2   |
| `hybrid`   | Weighted merge of keyword + semantic | Phase 3   |

## 2. Keyword Search

### Implementation

Uses Turso's `fts_score()` function for BM25 ranking:

```sql
SELECT
    d.id, d.title, d.summary, d.repo_name, d.author_handle,
    d.collection, d.record_type, d.updated_at,
    fts_score(d.title, d.body, d.summary, d.repo_name, d.author_handle, d.tags_json, ?) AS score
FROM documents d
WHERE fts_match(d.title, d.body, d.summary, d.repo_name, d.author_handle, d.tags_json, ?)
  AND d.deleted_at IS NULL
ORDER BY score DESC
LIMIT ? OFFSET ?;
```

### Field Weights

Configured in the FTS index definition:

| Field           | Weight | Rationale                            |
| --------------- | ------ | ------------------------------------ |
| `title`         | 3.0    | Highest signal for relevance         |
| `repo_name`     | 2.5    | Exact repo lookups should rank first |
| `author_handle` | 2.0    | Author search is common              |
| `summary`       | 1.5    | More focused than body               |
| `tags_json`     | 1.2    | Topic matching                       |
| `body`          | 1.0    | Baseline                             |

### Query Features

Tantivy query syntax is exposed to users:

- Boolean: `go AND search`, `rust NOT unsafe`
- Phrase: `"pull request"`
- Prefix: `tang*`
- Field-specific: `title:parser`

### Snippets

Use `fts_highlight()` to generate highlighted snippets:

```sql
fts_highlight(d.body, '<mark>', '</mark>', ?) AS body_snippet
```

### FTS Operational Notes

- **Segment merging:** Turso FTS uses Tantivy's `NoMergePolicy`. Run `OPTIMIZE INDEX idx_documents_fts;` after bulk writes (backfill) and periodically in production to keep query performance stable.
- **Read-your-writes:** FTS queries within the same transaction see a pre-commit snapshot. If a document is written and immediately searched in the same transaction, FTS will not find it. The indexer and API are separate processes, so this is not a concern in normal operation.
- **Feature flag:** Turso FTS requires the `fts` feature flag to be enabled on the database.

## 3. Semantic Search

### Query Flow

1. Convert user query text to embedding via Ollama (self-hosted)
2. Query `vector_top_k` for nearest neighbors
3. Join back to `documents` to get metadata
4. Filter out deleted/hidden documents
5. Return results with distance as score

```sql
SELECT d.id, d.title, d.summary, d.repo_name, d.author_handle,
       d.collection, d.record_type, d.updated_at
FROM vector_top_k('idx_embeddings_vec', vector32(?), ?) AS v
JOIN document_embeddings e ON e.rowid = v.id
JOIN documents d ON d.id = e.document_id
WHERE d.deleted_at IS NULL;
```

### Score Normalization

Cosine distance ranges from 0 (identical) to 2 (opposite). Normalize to a 0–1 relevance score:

```text
semantic_score = 1.0 - (distance / 2.0)
```

## 4. Hybrid Search

### v1: Weighted Score Blending

```text
hybrid_score = 0.65 * keyword_score_normalized + 0.35 * semantic_score_normalized
```

### Score Normalization for Blending

Keyword (BM25) scores are unbounded. Normalize using min-max within the result set:

```text
keyword_normalized = (score - min_score) / (max_score - min_score)
```

Semantic scores are already bounded after the distance-to-relevance conversion.

### Merge Strategy

1. Fetch top N keyword results (e.g., N=50)
2. Fetch top N semantic results
3. Merge on `document_id`
4. For documents appearing in both sets, combine scores
5. For documents in only one set, use that score (with 0 for the missing signal)
6. Sort by `hybrid_score` descending
7. Deduplicate
8. Apply limit/offset

### v2: Reciprocal Rank Fusion (future)

If keyword and semantic score scales prove unstable under weighted blending, replace with RRF:

```text
rrf_score = Σ 1 / (k + rank_i)
```

where `k` is a constant (typically 60) and `rank_i` is the document's rank in each result list.

## 5. Filtering

All search modes support these filters, applied as SQL WHERE clauses:

| Filter      | Parameter    | SQL                                         |
| ----------- | ------------ | ------------------------------------------- |
| Collection  | `collection` | `d.collection = ?`                          |
| Author      | `author`     | `d.author_handle = ?` or `d.did = ?`        |
| Repo        | `repo`       | `d.repo_name = ?` or `d.repo_did = ?`       |
| Record type | `type`       | `d.record_type = ?`                         |
| Language    | `language`   | `d.language = ?`                            |
| Date range  | `from`, `to` | `d.created_at >= ?` and `d.created_at <= ?` |
| State       | `state`      | Join to `record_state` table                |

## 6. Embedding Eligibility

A document is eligible for embedding if:

- `deleted_at IS NULL`
- `record_type` is one of: `repo`, `issue`, `pull`, `string`, `profile`
- At least one of `title`, `body`, or `summary` is non-empty
- Total text length exceeds a minimum threshold (e.g., 20 characters)

## 7. API Endpoints

### Health

| Method | Path       | Description                      |
| ------ | ---------- | -------------------------------- |
| GET    | `/healthz` | Liveness — process is responsive |
| GET    | `/readyz`  | Readiness — DB is reachable      |

### Search

| Method | Path               | Description                                      |
| ------ | ------------------ | ------------------------------------------------ |
| GET    | `/search`          | Search with configurable mode (default: keyword) |
| GET    | `/search/keyword`  | Keyword-only search                              |
| GET    | `/search/semantic` | Semantic-only search                             |
| GET    | `/search/hybrid`   | Hybrid search                                    |

### Documents

| Method | Path              | Description                   |
| ------ | ----------------- | ----------------------------- |
| GET    | `/documents/{id}` | Fetch a single document by ID |

### Admin

| Method | Path             | Description          |
| ------ | ---------------- | -------------------- |
| POST   | `/admin/reindex` | Trigger reindex      |
| POST   | `/admin/reembed` | Trigger re-embedding |

Admin endpoints are disabled by default. Enable with `ENABLE_ADMIN_ENDPOINTS=true`.

## 8. Query Parameters

| Parameter    | Type   | Default   | Description                                                          |
| ------------ | ------ | --------- | -------------------------------------------------------------------- |
| `q`          | string | required  | Search query                                                         |
| `mode`       | string | `keyword` | `keyword`, `semantic`, or `hybrid`                                   |
| `limit`      | int    | 20        | Results per page (max: `SEARCH_MAX_LIMIT`)                           |
| `offset`     | int    | 0         | Pagination offset                                                    |
| `collection` | string | —         | Filter by `sh.tangled.*` collection                                  |
| `type`       | string | —         | Filter by record type (`repo`, `issue`, `pull`, `string`, `profile`) |
| `author`     | string | —         | Filter by author handle or DID                                       |
| `repo`       | string | —         | Filter by repo name or repo DID                                      |
| `language`   | string | —         | Filter by language                                                   |
| `from`       | string | —         | Created after (ISO 8601)                                             |
| `to`         | string | —         | Created before (ISO 8601)                                            |
| `state`      | string | —         | Filter by state (`open`, `closed`, `merged`)                         |

## 9. Search Response

```json
{
  "query": "rust markdown tui",
  "mode": "hybrid",
  "total": 142,
  "limit": 20,
  "offset": 0,
  "results": [
    {
      "id": "did:plc:abc|sh.tangled.repo|3kb3fge5lm32x",
      "collection": "sh.tangled.repo",
      "record_type": "repo",
      "title": "glow-rs",
      "body_snippet": "A TUI markdown viewer inspired by <mark>Glow</mark>...",
      "summary": "Rust TUI markdown viewer",
      "repo_name": "glow-rs",
      "author_handle": "desertthunder.dev",
      "score": 0.842,
      "matched_by": ["keyword", "semantic"],
      "created_at": "2026-03-20T10:00:00Z",
      "updated_at": "2026-03-22T15:03:11Z"
    }
  ]
}
```

### Result Fields

| Field              | Type     | Description                                 |
| ------------------ | -------- | ------------------------------------------- |
| `id`               | string   | Document stable ID                          |
| `collection`       | string   | ATProto collection NSID                     |
| `record_type`      | string   | Normalized type label                       |
| `title`            | string   | Document title                              |
| `body_snippet`     | string   | Highlighted body excerpt                    |
| `summary`          | string   | Short description                           |
| `repo_name`        | string   | Repository name (if applicable)             |
| `author_handle`    | string   | Author handle                               |
| `did`              | string   | Author DID when available                   |
| `at_uri`           | string   | Canonical AT URI when available             |
| `primary_language` | string   | Primary language for repo results           |
| `stars`            | number   | Indexed star count for repo results         |
| `follower_count`   | number   | Indexed follower count for profile results  |
| `following_count`  | number   | Indexed following count for profile results |
| `score`            | float    | Relevance score (0–1)                       |
| `matched_by`       | string[] | Which search modes produced this result     |
| `created_at`       | string   | ISO 8601 creation timestamp                 |
| `updated_at`       | string   | ISO 8601 last update timestamp              |

## 10. Document Response

`GET /documents/{id}` returns the full document:

```json
{
  "id": "did:plc:abc|sh.tangled.repo|3kb3fge5lm32x",
  "did": "did:plc:abc",
  "collection": "sh.tangled.repo",
  "rkey": "3kb3fge5lm32x",
  "at_uri": "at://did:plc:abc/sh.tangled.repo/3kb3fge5lm32x",
  "cid": "bafyreig...",
  "record_type": "repo",
  "title": "glow-rs",
  "body": "A TUI markdown viewer inspired by Glow, written in Rust.",
  "summary": "Rust TUI markdown viewer",
  "repo_name": "glow-rs",
  "author_handle": "desertthunder.dev",
  "tags_json": "[\"rust\", \"tui\", \"markdown\"]",
  "language": "en",
  "created_at": "2026-03-20T10:00:00Z",
  "updated_at": "2026-03-22T15:03:11Z",
  "indexed_at": "2026-03-22T15:05:00Z",
  "has_embedding": true
}
```

## 11. Error Responses

| Status | Condition                                                          |
| ------ | ------------------------------------------------------------------ |
| 400    | Missing `q` parameter, invalid `limit`/`offset`, malformed filters |
| 404    | Document not found                                                 |
| 503    | DB unreachable (readiness failure)                                 |

```json
{ "error": "invalid_parameter", "message": "limit must be between 1 and 100" }
```

## 12. API Behavior

- `keyword` returns only lexical matches via `fts_match`/`fts_score`
- `semantic` returns only embedding-backed matches via `vector_top_k`
- `hybrid` merges both result sets and reranks
- All modes exclude documents with `deleted_at IS NOT NULL` by default
- Pagination uses `limit`/`offset` (cursor-based pagination deferred)
- Mobile clients may use `type=repo` and `type=profile` to render repo/profile search directly
