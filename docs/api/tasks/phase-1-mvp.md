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

## M0 — Repository Bootstrap ✅

Executable layout, local tooling, and development conventions (completed 2026-03-22).

## M1 — Database Schema and Store Layer ✅

refs: [specs/03-data-model.md](../specs/03-data-model.md)

Implemented the Turso/libSQL schema and Go store package for document persistence.

## M2 — Normalization Layer ✅

refs: [specs/02-tangled-lexicons.md](../specs/02-tangled-lexicons.md), [specs/04-data-pipeline.md](../specs/04-data-pipeline.md)

Translate `sh.tangled.*` records into internal search documents.

## M3 — Tap Client and Ingestion Loop

refs: [specs/04-data-pipeline.md](../specs/04-data-pipeline.md), [specs/01-architecture.md](../specs/01-architecture.md)

### Goal

Connect the indexer to Tap (on Railway) and process live events into the store.

### Deliverables

- Tap WebSocket client package (`internal/tapclient/`)
- Event decode layer (record events + identity events)
- Ingestion loop with retry/backoff
- Cursor persistence coupled to successful DB commits
- Identity event handler (DID → handle cache)

### Tasks

- [x] Define Tap event DTOs matching the documented event shape:

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

- [x] Implement WebSocket client:
  - Connect to `TAP_URL` (e.g., `wss://tap.railway.internal/channel`)
  - HTTP Basic auth with `admin:TAP_AUTH_PASSWORD`
  - Auto-reconnect with exponential backoff
  - Ack protocol: send event `id` back after successful processing
- [x] Implement ingestion loop:
  1. Receive event from WebSocket
  2. If `type == "identity"` → update handle cache, ack, continue
  3. If `type == "record"` → check collection allowlist
  4. Map `action` to operation (create/update → upsert, delete → tombstone)
  5. Decode `record.record` via adapter registry
  6. Normalize to `Document`
  7. Upsert to store
  8. Schedule embedding job if eligible ([Phase 2](phase-2-semantic.md))
  9. Persist cursor (event ID) after successful DB commit
  10. Ack the event
- [x] Implement collection allowlist from `INDEXED_COLLECTIONS` config
- [x] Handle state events (`sh.tangled.repo.issue.state`, `sh.tangled.repo.pull.status`) → update `record_state`
- [x] Handle normalization failures: log, skip, advance cursor
- [x] Handle DB failures: retry with backoff, do not advance cursor

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

## M4 — Graph Backfill from Seed Users

refs: [specs/07-graph-backfill.md](../specs/07-graph-backfill.md)

### Goal

Bootstrap the index with historical Tangled content by discovering and backfilling users from a curated seed set.

### Deliverables

- `twister backfill` CLI command
- Seed file parser and documented seed-file format
- Graph fan-out discovery (follows and collaborators)
- Tap `/repos/add` integration for discovered users
- Deduplication against already-tracked repos
- Dry-run mode and progress logging
- Basic operator runbook for first bootstrap and repeat runs

### Tasks

- [x] Implement `backfill` subcommand with flags:
  - `--seeds <file>` — required seed file path
  - `--max-hops <n>` — depth limit for fan-out (default: 2)
  - `--dry-run` — print the discovery plan without mutating Tap
  - `--concurrency <n>` — parallel discovery workers (default: 5)
  - `--batch-size <n>` — DIDs per `/repos/add` request
  - `--batch-delay <duration>` — delay between Tap registration batches
- [x] Implement seed file parsing:
  - One DID or handle per line
  - `#` comments allowed
  - Blank lines ignored
  - Handles resolved to DIDs before graph expansion
- [x] Decide and document the initial seed file location for operators:
  - Repository-managed example file for format/reference
  - Deployment-specific runtime file or mounted secret for real runs
  - Implemented: `docs/api/seeds.txt` and `packages/api/internal/backfill/doc.go`
- [x] Implement graph discovery:
  1. Start from hop-0 seed users
  2. Fetch `sh.tangled.graph.follow` records and collect subject DIDs
  3. Fetch repo collaborators by inspecting repos, issues, PRs, and comments
  4. Enqueue newly discovered DIDs with hop metadata
  5. Stop expanding beyond `max-hops`
- [x] Track discovery metadata for logs:
  - source DID
  - hop depth
  - discovery reason (`seed`, `follow`, `collaborator`)
- [x] Integrate with Tap admin endpoints:
  - `GET /info/:did` to skip already-tracked repos when practical
  - `POST /repos/add` to register new DIDs for backfill
- [x] Make the command safe to re-run:
  - in-memory visited DID set during crawl
  - tolerate duplicate `/repos/add`
  - rely on index upsert idempotency for re-delivered records
- [x] Add operator-friendly logging:
  - seed count
  - users discovered per hop
  - already-tracked vs newly-submitted DIDs
  - batch progress
  - final totals
- [x] Add a short runbook covering:
  - first bootstrap against an empty database
  - repeat run after expanding the seed list
  - dry-run before production mutation
  - Implemented: `packages/api/internal/backfill/doc.go`

### Verification

- [ ] A small seed file of known Tangled users produces a non-empty discovery graph
- [ ] `--max-hops 1` limits discovery to direct neighbors
- [ ] `--dry-run` does not call Tap mutation endpoints
- [ ] Already-tracked DIDs are reported and not re-submitted unnecessarily
- [ ] Re-running the same seeds is effectively idempotent
- [ ] Newly submitted DIDs cause Tap to begin historical backfill
- [ ] Search results become materially richer after bootstrap than they were under live-only ingestion

### Exit Criteria

Operators can bootstrap an empty environment to a usable historical baseline before public rollout.

## M5 — Keyword Search API

refs: [specs/05-search.md](../specs/05-search.md)

### Goal

Expose a usable public search API backed by Turso's Tantivy-backed FTS.

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

## M6 — Railway Deployment

refs: [specs/06-operations.md](../specs/06-operations.md)

### Goal

Deploy the API and indexer as Railway services alongside Tap.

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

## M7 — Reindex and Repair

refs: [specs/05-search.md](../specs/05-search.md)

### Goal

Make the system recoverable and operable with repair tools.

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

## M8 — Observability

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
