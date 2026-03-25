---
title: Search
updated: 2026-03-25
---

> Warning: this document is pretty long. Look at the roadmap and ADR summaries for a
> high-level overview, or jump to the relevant sections.

Search now has two phases:

1. Stabilize indexing and activity caching so search is cheap and reliable.
2. Resume semantic and hybrid work only after the base pipeline is stable.

## Immediate Priority

The current highest-priority search work is operational, not ranking:

- Stabilize experimentation around a local `file:` database workflow.
- Add cURL smoke tests for search, document fetches, indexing, and activity reads.
- Enqueue background indexing when the API fetches records that are not yet searchable.
- Cache recent JetStream activity server-side with a persisted 24-hour cursor.

Production storage is Turso cloud. The reasoning is recorded in `docs/adr/storage.md`, with the comparison inputs in `docs/adr/pg.md` and `docs/adr/turso.md`.

These tasks block further work on semantic and hybrid search.

## Planning Decisions

### Why This Comes First

Search quality is currently constrained more by ingestion cost and freshness gaps than by ranking quality.
The next iteration should make Twister cheaper to operate, resilient across restarts, and able to backfill misses on demand before any new semantic or hybrid work.

### Resolved Questions

#### Local-Only Storage

Twister can already run against a local `file:` database. That is useful for stabilizing development and experimentation while the indexing model is still changing. It should not automatically be treated as the final production architecture.

The production storage question remains open and should compare at least:

- PostgreSQL with native full-text search and conventional operational tooling
- Turso remote/libSQL
- Turso with embedded replicas or similar local-read, remote-sync patterns

That comparison has been completed, and the current production choice is Turso.

#### Tangled First-Commit Timestamp

The first Tangled commit timestamp is useful as a lower-bound hint for one-time experiments, but it should not become the default replay cursor.
JetStream has to default to recent history (< 72 hours from now is what's possible) so bootstrap cost stays bounded.

#### Tap Versus JetStream

Tap remains the authoritative indexing and bulk backfill path. JetStream should power only a bounded recent-activity cache.
Read-through API indexing closes gaps when a user fetches a record before Tap has delivered it.

## Goals

- Reduce search-related reads and writes enough that remote Turso cost is no longer the dominant constraint.
- Keep indexed content fresh enough for browsing and search without requiring a full-network rebuild after routine restarts.
- Serve recent activity cheaply from a local cache.
- Add a smoke-test layer that verifies search and indexing behavior end to end.

## Current Search Mode

### Keyword Search (Implemented)

Full-text search is powered by SQLite FTS5 with BM25 scoring. Queries match title, body, summary, repo name, author handle, and tags. Results are ranked with field-specific weights and snippets highlight matches with `<mark>` tags.

## Stabilization Plan

### Storage

Twister should use a local `file:` database to stabilize experimentation and reduce the messiness of iteration while the indexing pipeline is being hardened. Production storage should remain explicitly undecided until the project compares PostgreSQL and Turso-based options against the final workload.

Requirements:

- keep local-file mode as the simplest path for development and experimentation
- document what assumptions the local path makes about single-host or shared-disk execution
- document backup, restore, and disk-growth procedures
- produce a production storage decision record comparing PostgreSQL and Turso options, starting from `docs/adr/pg.md` and `docs/adr/turso.md`

Evaluation criteria for the production decision:

- write-heavy ingestion behavior
- FTS quality and indexing ergonomics
- operational complexity and backup story
- latency for reads and writes
- failure recovery and restore workflow
- support for future semantic search requirements

Acceptance:

- local development no longer depends on remote Turso for routine experimentation
- the production backend choice is documented with explicit tradeoffs
- the chosen production backend has a migration path from the experimental local setup

The concrete local DB operating procedure lives in `packages/api/README.md`.
The production migration path is documented in `docs/adr/storage.md`.

### Read-Through Indexing

When the API fetches a repo, issue, PR, profile, or similar record directly from upstream, it should enqueue background indexing work if that record is not already searchable. Tap remains the primary ingest path; read-through indexing only closes gaps.

Requirements:

- add a durable job table for on-demand indexing
- deduplicate jobs by stable document identity
- reuse the existing normalization and upsert path
- trigger jobs from the handlers that already fetch upstream records

Acceptance:

- a fetched-but-missing record becomes searchable shortly after the first successful API read
- repeated page views do not create unbounded duplicate work
- failures are visible through logs and smoke tests

### Activity Cache

JetStream should back a recent-activity cache, not the main search index. The server should persist a timestamp cursor, seed it to `now - ~24h` on first boot, rewind slightly on reconnect, and expire old events aggressively.

Requirements:

- add a dedicated activity cache table
- persist a separate JetStream consumer cursor
- seed missing cursors to recent history, not full history
- keep retention bounded by age and row count

Acceptance:

- common activity reads can be served from the cache
- restarts resume from the stored timestamp cursor
- reconnects are idempotent and tolerate a short rewind window

### Smoke Tests

Twister needs cURL-based smoke tests covering:

- `GET /healthz`
- `GET /readyz`
- `GET /search`
- `GET /documents/{id}`
- one fetch path that should enqueue indexing
- one activity endpoint backed by the cache

Acceptance:

- one local command can verify the critical API surface
- the same scripts can run against staging or production by changing the base URL

## Operational Model

1. Tap ingests the authoritative search corpus.
2. Direct API reads enqueue background indexing for misses.
3. JetStream fills only the recent-activity cache.
4. Smoke tests guard the critical paths.
5. Semantic and hybrid search remain blocked until the base pipeline is stable.

## Backfill Strategy

- Search index backfill should continue to use Tap admin backfill, firehose-driven repo sync, or repo export based resync.
- Activity cache bootstrap should use a recent JetStream timestamp cursor, defaulting to `now - 24h`.
- A manual cursor override can exist for one-time replay experiments, but it should not be the default startup path.

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

3. **Read-through indexing closes freshness gaps.** If a user can fetch a record, the system should be able to make it searchable shortly after.

4. **JetStream is for recent activity, not authoritative indexing.** Use it to power the cached feed, not to replace Tap or repo re-sync.

5. **Semantic search is additive.** It improves discovery for vague queries but is not required for the app to be useful.

6. **Graceful degradation.** The mobile app treats the search API as optional. If Twister is unavailable, handle-based direct browsing still works. Search results link into the same browsing screens.

## Quality Improvements (Planned)

- Field weight tuning based on real query patterns
- Recency boost for recently updated content
- Collection-aware ranking
- Star count as a ranking signal
- State filtering defaults
- Better snippet generation
- Relevance test fixtures

## Mobile Integration

The app calls the search API from the Explore tab. Results are displayed in segmented views (repos, users, issues/PRs).
Each result links to the corresponding browsing screen (repo detail, profile, issue detail).

When the search API is unavailable, the Explore tab shows an appropriate state rather than breaking.
The Home tab's handle-based browsing is fully independent of search.
