---
title: "Phase 1 — MVP"
updated: 2026-03-22
---

# Phase 1 — MVP

Get a searchable product online: ingestion, keyword search, deployment, and operational tooling.

## MVP Complete When

- Tap ingests tracked `sh.tangled.*` records
- Documents normalize into a stable store
- Keyword search works publicly
- API and indexer are deployed on Railway
- Restart does not lose sync position
- Reindex exists for repair
- Graph backfill populates initial content from seed users

---

## M0 — Repository Bootstrap ✅

Executable layout, local tooling, and development conventions (completed 2026-03-22).

---

## M1 — Database Schema and Store Layer ✅

refs: [specs/03-data-model.md](../specs/03-data-model.md)

Implemented the Turso/libSQL schema and Go store package for document persistence.

---

## M2 — Normalization Layer ✅

refs: [specs/02-tangled-lexicons.md](../specs/02-tangled-lexicons.md), [specs/04-data-pipeline.md](../specs/04-data-pipeline.md)

Translate `sh.tangled.*` records into internal search documents.

---

## M3 — Tap Client and Ingestion Loop

refs: [specs/04-data-pipeline.md](../specs/04-data-pipeline.md), [specs/01-architecture.md](../specs/01-architecture.md)

### Goal

Connect the indexer to Tap (on Railway) and process live events into the store.

### Why Now

Tap is the point of truth for synchronized ATProto ingestion. It is already deployed on Railway.

### Deliverables

- Tap WebSocket client package (`internal/tapclient/`)
- Event decode layer (record events + identity events)
- Ingestion loop with retry/backoff
- Cursor persistence coupled to successful DB commits
- Identity event handler (DID → handle cache)

### Tasks

- [ ] Define Tap event DTOs matching the documented event shape:

  ```go
  type TapEvent struct {
      ID       int64           `json:"id"`
      Type     string          `json:"type"`     // "record" or "identity"
      Record   *TapRecord      `json:"record"`
      Identity *TapIdentity    `json:"identity"`
  }
  type TapRecord struct {
      Live       bool            `json:"live"`
      Rev        string          `json:"rev"`
      DID        string          `json:"did"`
      Collection string          `json:"collection"`
      RKey       string          `json:"rkey"`
      Action     string          `json:"action"`  // "create", "update", "delete"
      CID        string          `json:"cid"`
      Record     json.RawMessage `json:"record"`
  }
  type TapIdentity struct {
      DID      string `json:"did"`
      Handle   string `json:"handle"`
      IsActive bool   `json:"isActive"`
      Status   string `json:"status"`
  }
  ```

- [ ] Implement WebSocket client:
  - Connect to `TAP_URL` (e.g., `wss://tap.railway.internal/channel`)
  - HTTP Basic auth with `admin:TAP_AUTH_PASSWORD`
  - Auto-reconnect with exponential backoff
  - Ack protocol: send event `id` back after successful processing
- [ ] Implement ingestion loop:
  1. Receive event from WebSocket
  2. If `type == "identity"` → update handle cache, ack, continue
  3. If `type == "record"` → check collection allowlist
  4. Map `action` to operation (create/update → upsert, delete → tombstone)
  5. Decode `record.record` via adapter registry
  6. Normalize to `Document`
  7. Upsert to store
  8. Schedule embedding job if eligible (Phase 2)
  9. Persist cursor (event ID) after successful DB commit
  10. Ack the event
- [ ] Implement collection allowlist from `INDEXED_COLLECTIONS` config
- [ ] Handle state events (`sh.tangled.repo.issue.state`, `sh.tangled.repo.pull.status`) → update `record_state`
- [ ] Handle normalization failures: log, skip, advance cursor
- [ ] Handle DB failures: retry with backoff, do not advance cursor

### Verification

- [ ] Indexer connects to Tap via WebSocket in development
- [ ] A newly created tracked record appears in `documents` table
- [ ] An updated record changes the existing row (CID changes)
- [ ] A delete event tombstones the row (`deleted_at` set)
- [ ] Killing and restarting the indexer resumes from persisted cursor without duplication
- [ ] Identity events update handle cache
- [ ] Unsupported collections are silently skipped
- [ ] Connection drops trigger automatic reconnection

### Exit Criteria

The system continuously ingests and persists `sh.tangled.*` records from Tap.

---

## M4 — Keyword Search API

refs: [specs/05-search.md](../specs/05-search.md)

### Goal

Expose a usable public search API backed by Turso's Tantivy-backed FTS.

### Why Now

First real product milestone. Searchable Tangled content without waiting for embeddings.

### Deliverables

- HTTP server (chi or net/http)
- `GET /healthz` — liveness
- `GET /readyz` — readiness (DB connectivity)
- `GET /search` — keyword search with configurable mode
- `GET /search/keyword` — keyword-only search
- `GET /documents/{id}` — document lookup
- Search repository layer (FTS queries isolated from handlers)
- Pagination, filtering, snippets

### Tasks

- [ ] Set up HTTP server with chi router
- [ ] Implement `/healthz` (always 200) and `/readyz` (SELECT 1 against DB)
- [ ] Implement search repository with FTS queries:

  ```sql
  SELECT id, title, summary, repo_name, author_handle, collection, record_type,
         created_at, updated_at,
         fts_score(title, body, summary, repo_name, author_handle, tags_json, ?) AS score,
         fts_highlight(body, '<mark>', '</mark>', ?) AS body_snippet
  FROM documents
  WHERE fts_match(title, body, summary, repo_name, author_handle, tags_json, ?)
    AND deleted_at IS NULL
  ORDER BY score DESC
  LIMIT ? OFFSET ?;
  ```

- [ ] Implement request validation:
  - `q` required, non-empty
  - `limit` 1–100, default 20
  - `offset` >= 0, default 0
  - Reject unknown parameters with 400
- [ ] Implement filters (as WHERE clauses):
  - `collection` → `d.collection = ?`
  - `type` → `d.record_type = ?`
  - `author` → `d.author_handle = ?` or `d.did = ?`
  - `repo` → `d.repo_name = ?`
- [ ] Implement `/documents/{id}` — full document response
- [ ] Implement stable JSON response contract (see spec 05-search.md)
- [ ] Exclude tombstoned documents (`deleted_at IS NOT NULL`) by default
- [ ] Add request logging middleware (method, path, status, duration)
- [ ] Add CORS headers if needed

### Verification

- [ ] Searching by exact repo name returns the expected repo first
- [ ] Searching by title term returns expected documents
- [ ] Searching by author handle returns relevant docs
- [ ] Tombstoned documents do not appear
- [ ] Malformed query parameters return 400 with error JSON
- [ ] DB outage causes `/readyz` to fail (503)
- [ ] Pagination works: `offset=0&limit=5` then `offset=5&limit=5` returns different results
- [ ] Filter by collection returns only matching docs

### Exit Criteria

A user can search Tangled content reliably with keyword search.

---

## M5 — Railway Deployment

refs: [specs/06-operations.md](../specs/06-operations.md)

### Goal

Deploy the API and indexer as Railway services alongside Tap.

### Why Now

At this point, the product is useful enough to run continuously.

### Deliverables

- Finalized Dockerfile
- Railway project with services: `api`, `indexer`
- Health checks configured per service
- Secrets/env vars set
- Production startup commands documented

### Tasks

- [ ] Finalize Dockerfile (multi-stage, CGO_ENABLED=0, Alpine runtime)
- [ ] Create Railway services:
  - `api` — start command: `twister api`
  - `indexer` — start command: `twister indexer`
- [ ] Configure environment variables per service:
  - Shared: `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `LOG_LEVEL`, `LOG_FORMAT`
  - API: `HTTP_BIND_ADDR`, `SEARCH_DEFAULT_LIMIT`, `SEARCH_MAX_LIMIT`
  - Indexer: `TAP_URL` (reference Tap service domain), `TAP_AUTH_PASSWORD`, `INDEXED_COLLECTIONS`
- [ ] Configure health checks:
  - API: HTTP check on `/healthz` port 8080
  - Indexer: HTTP check on `/health` port 9090
- [ ] Use Railway internal networking for indexer → Tap connection
- [ ] Connect GitHub repo for autodeploy
- [ ] Test graceful shutdown on redeploy (SIGTERM handling)
- [ ] Document deploy steps

### Verification

- [ ] API service becomes healthy and routable (public URL)
- [ ] Indexer service starts and stays healthy
- [ ] A new Tangled record ingested post-deploy becomes searchable
- [ ] A redeploy preserves API availability
- [ ] A restart does not lose sync position (cursor persisted)
- [ ] Health checks correctly report status

### Exit Criteria

The system runs as a deployed service with health-checked processes on Railway.

---

## M6 — Reindex and Repair

refs: [specs/05-search.md](../specs/05-search.md)

### Goal

Make the system recoverable and operable with repair tools.

### Why Now

Search systems are never perfect on first ingestion. Repair tools are needed before production.

### Deliverables

- `twister reindex` command with scoping options
- Dry-run mode
- Admin reindex endpoint (optional)
- Progress logging and error summary

### Tasks

- [ ] Implement `reindex` subcommand with flags:
  - `--collection` — reindex one collection
  - `--did` — reindex one DID's documents
  - `--document` — reindex one document by ID
  - `--dry-run` — show intended work without writes
  - No flags → reindex all
- [ ] Implement reindex logic:
  1. Select documents matching scope
  2. For each document, re-run normalization from stored fields (or re-fetch if source available)
  3. Update FTS-relevant fields
  4. Upsert back to store
  5. Log progress (N/total, errors)
- [ ] Implement `POST /admin/reindex` endpoint (behind `ENABLE_ADMIN_ENDPOINTS` + `ADMIN_AUTH_TOKEN`)
- [ ] Add error summary output on completion
- [ ] Exit non-zero on unrecoverable failures

### Verification

- [ ] Reindexing one document updates its stored normalized text
- [ ] Reindexing one collection repairs intentionally corrupted rows
- [ ] Dry-run shows intended work without writes
- [ ] Reindex command exits non-zero on failures
- [ ] Admin endpoint triggers reindex when enabled

### Exit Criteria

Operators can repair bad indexes without rebuilding everything manually.

---

## M7 — Observability

refs: [specs/06-operations.md](../specs/06-operations.md)

### Goal

Make the system diagnosable in production.

### Deliverables

- Structured slog fields across all services
- Error classification
- Ingestion lag visibility
- Periodic state logs
- Operator documentation

### Tasks

- [ ] Standardize slog fields across all packages:
  - `service`, `event_name`, `event_id`, `did`, `collection`, `rkey`, `document_id`, `cursor`, `error_class`, `duration_ms`
- [ ] Add error classification (normalize_error, db_error, tap_error, embed_error)
- [ ] Add periodic state logs in indexer:
  - Current cursor position
  - Events processed since last log
  - Documents in store (count)
- [ ] Add request logging in API (method, path, status, duration, query)
- [ ] Add search latency logging per query mode
- [ ] Write operator documentation:
  - Restart procedure
  - Reindex procedure
  - Backfill notes
  - Failure triage guide

### Verification

- [ ] A failed Tap decode surfaces enough context to debug (collection, DID, rkey, error class)
- [ ] DB connectivity failures are visible in logs and readiness
- [ ] Operator can follow the runbook to diagnose a broken indexer
- [ ] Search latency is logged per request

### Exit Criteria

The system is maintainable without guesswork.

---

## M-New — Graph Backfill from Seed Users

refs: [specs/07-graph-backfill.md](../specs/07-graph-backfill.md)

### Goal

Bootstrap the search index with existing Tangled content by discovering and backfilling users from a seed set.

### Why Now

Before MVP launch, the index needs existing content. Live ingestion only captures new events — backfill populates historical data.

### Deliverables

- `twister backfill` CLI command
- Seed file parser
- Graph fan-out discovery (follows/collaborators)
- Tap `/repos/add` integration for discovered users
- Deduplication against already-indexed users
- Progress logging

### Tasks

- [ ] Implement `backfill` subcommand with flags:
  - `--seeds <file>` — path to seed file (one DID or handle per line)
  - `--max-hops <n>` — depth limit for fan-out (default: 2)
  - `--dry-run` — show discovered users without triggering backfill
  - `--concurrency <n>` — parallel discovery workers (default: 5)
- [ ] Implement seed file parser (supports DIDs and handles, comments with `#`)
- [ ] Implement graph fan-out:
  1. For each seed user, resolve DID if handle provided
  2. Fetch `sh.tangled.graph.follow` records for the user
  3. Fetch collaborators from repos owned by the user
  4. Add discovered DIDs to the crawl queue
  5. Repeat up to `max-hops` depth
- [ ] Integrate with Tap `/repos/add` to register discovered DIDs for tracking
- [ ] Deduplicate: skip DIDs already tracked by Tap (check via `/info/:did`)
- [ ] Log progress: seeds processed, users discovered per hop, DIDs submitted to Tap
- [ ] Handle rate limiting and errors gracefully (retry with backoff)
- [ ] Make idempotent: safe to re-run; Tap handles duplicate `/repos/add` calls

### Verification

- [ ] Running with a seed file of 3 known users discovers their followers
- [ ] `--max-hops 1` limits discovery to direct connections only
- [ ] `--dry-run` lists discovered DIDs without calling Tap
- [ ] Already-tracked users are skipped
- [ ] Re-running the same seed file produces no duplicate work
- [ ] Tap begins backfilling records for newly added DIDs

### Exit Criteria

The index contains historical content from the seed user graph, not just new events.
