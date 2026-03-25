---
title: API Service Reference
updated: 2026-03-24
---

Twister is a Go service that indexes Tangled content and serves a search API. It connects to the AT Protocol ecosystem via Tap (firehose consumer), XRPC (direct record lookups), and Constellation (backlink queries), storing indexed data in Turso/libSQL with FTS5 full-text search.

## Architecture

The service is a single Go binary with multiple subcommands, each running a different runtime mode. All modes share the same database and configuration layer.

**Runtime modes:**

| Command       | Purpose                                                             |
| ------------- | ------------------------------------------------------------------- |
| `api` (serve) | HTTP search API server                                              |
| `indexer`     | Consumes Tap firehose events, normalizes and indexes records        |
| `backfill`    | Discovers users from seed files, registers them with Tap            |
| `enrich`      | Backfills missing metadata (repo names, handles, web URLs) via XRPC |
| `reindex`     | Re-syncs all documents into the FTS index                           |
| `healthcheck` | One-shot liveness probe for container orchestration                 |

The `embed-worker` and `reembed` commands exist as stubs for the upcoming semantic search pipeline (Nomic Embed Text v1.5 deployed via Railway template).

All commands accept a `--local` flag that switches to a local SQLite file and text-format logging for development.

## HTTP API

The API server binds to `:8080` by default (configurable via `HTTP_BIND_ADDR`). CORS is open (`*` origin, GET/OPTIONS).

### Search

**`GET /search`** — Main search endpoint. Routes to keyword, semantic, or hybrid based on `mode` parameter.

**`GET /search/keyword`** — Full-text search via FTS5 with BM25 scoring.

Parameters:

- `q` (required) — Query string
- `limit` (1–100, default 20) — Results per page
- `offset` (default 0) — Pagination offset
- `collection` — Filter by AT Protocol collection NSID
- `type` — Filter by record type (repo, issue, pull, profile, string)
- `author` — Filter by handle or DID
- `repo` — Filter by repo name or DID
- `language` — Filter by primary language
- `from`, `to` — Date range (ISO 8601)
- `state` — Filter issues/PRs by state (open, closed, merged)
- `mode` — Search mode (keyword, semantic, hybrid)

Response includes query metadata, total count, and an array of results each containing: ID, collection, record type, title, summary, body snippet (with `<mark>` highlights), score, repo name, author handle, DID, AT-URI, web URL, and timestamps.

**`GET /documents/{id}`** — Fetch a single document by stable ID.

### Health

- **`GET /healthz`** — Liveness probe, always 200
- **`GET /readyz`** — Readiness probe, pings database

### Admin

When `ENABLE_ADMIN_ENDPOINTS=true` with a configured `ADMIN_AUTH_TOKEN`:

- **`POST /admin/reindex`** — Trigger FTS re-sync

### Static Content

The API also serves a search site with live search and API documentation at `/` and `/docs*`, built with Alpine.js (no build step, embedded in `internal/view/`).

## Database

Turso (libSQL) with the following tables:

**documents** — Core search index. Each record gets a stable ID of `did|collection|rkey`. Stores title, body, summary, metadata (repo name, author handle, web URL, language, tags), and timestamps. Soft-deleted via `deleted_at`.

**documents_fts** — FTS5 virtual table for full-text search over title, body, summary, repo name, author handle, and tags. Uses `unicode61` tokenizer with tuned BM25 weights (title weighted highest at 2.5, then author handle at 2.0, summary at 1.5).

**sync_state** — Cursor tracking for the Tap consumer. Stores consumer name, current cursor, high water mark, and last update time. Enables crash-safe resume.

**identity_handles** — DID-to-handle cache. Updated from Tap identity events and XRPC lookups.

**record_state** — Issue and PR state cache (open/closed/merged). Keyed by subject AT-URI.

**document_embeddings** — Vector storage (768-dim F32_BLOB with DiskANN cosine index). Schema ready but not yet populated.

**embedding_jobs** — Async embedding job queue. Schema ready but worker not yet active.

## Indexing Pipeline

The indexer connects to Tap via WebSocket, consuming AT Protocol record events in real-time. For each event:

1. Filter against the configured collection allowlist (supports wildcards like `sh.tangled.*`)
2. Route to the appropriate normalizer based on collection
3. Normalize into a document (extract title, body, summary, metadata)
4. Optionally enrich via XRPC (resolve author handle, repo name, web URL)
5. Upsert into the database (auto-syncs FTS)
6. Advance cursor and acknowledge to Tap

The indexer resumes from its last cursor on restart (no duplicate processing). It logs status every 30 seconds and uses exponential backoff (1s–5s) for transient failures.

## Record Normalizers

Each AT Protocol collection has a dedicated normalizer that extracts searchable content:

| Collection                      | Record Type   | Searchable               | Content                     |
| ------------------------------- | ------------- | ------------------------ | --------------------------- |
| `sh.tangled.repo`               | repo          | Yes (if named)           | Name, description, topics   |
| `sh.tangled.repo.issue`         | issue         | Yes                      | Title, body, repo reference |
| `sh.tangled.repo.pull`          | pull          | Yes                      | Title, body, target branch  |
| `sh.tangled.repo.issue.comment` | issue_comment | Yes (if has body)        | Comment body                |
| `sh.tangled.repo.pull.comment`  | pull_comment  | Yes (if has body)        | Comment body                |
| `sh.tangled.string`             | string        | Yes (if has content)     | Filename, contents          |
| `sh.tangled.actor.profile`      | profile       | Yes (if has description) | Profile description         |
| `sh.tangled.graph.follow`       | follow        | No                       | Graph edge only             |

State records (`sh.tangled.repo.issue.state`, `sh.tangled.repo.pull.status`) update the `record_state` table rather than creating documents.

## XRPC Client

The built-in XRPC client provides typed access to AT Protocol endpoints with caching (1-hour TTL for DID docs and repo names):

- DID resolution via PLC Directory (`did:plc:`) or `.well-known/did.json` (`did:web:`)
- Identity resolution (PDS endpoint + handle from DID document)
- Record fetching (`com.atproto.repo.getRecord`, `com.atproto.repo.listRecords`)
- Repo name resolution from `sh.tangled.repo` records
- Web URL construction for Tangled entities

## Backfill

The backfill command discovers users from a seed file and registers them with Tap for indexing. Discovery fans out via follow graphs and repo collaborators up to a configurable hop depth (default 2). Supports dry-run mode, configurable concurrency and batch sizes, and is idempotent.

## Configuration

All configuration is via environment variables (with `.env` file support):

| Variable                   | Default                 | Purpose                                         |
| -------------------------- | ----------------------- | ----------------------------------------------- |
| `TURSO_DATABASE_URL`       | —                       | Database connection (required unless `--local`) |
| `TURSO_AUTH_TOKEN`         | —                       | Auth token (required for remote)                |
| `TAP_URL`                  | —                       | Tap WebSocket URL                               |
| `TAP_AUTH_PASSWORD`        | —                       | Tap admin password                              |
| `INDEXED_COLLECTIONS`      | all                     | Collection allowlist (CSV, supports wildcards)  |
| `HTTP_BIND_ADDR`           | `:8080`                 | API server bind address                         |
| `INDEXER_HEALTH_ADDR`      | `:9090`                 | Indexer health probe address                    |
| `LOG_LEVEL`                | info                    | debug/info/warn/error                           |
| `LOG_FORMAT`               | json                    | json or text                                    |
| `ENABLE_ADMIN_ENDPOINTS`   | false                   | Enable admin routes                             |
| `ADMIN_AUTH_TOKEN`         | —                       | Bearer token for admin                          |
| `ENABLE_INGEST_ENRICHMENT` | true                    | XRPC enrichment at ingest time                  |
| `PLC_DIRECTORY_URL`        | `https://plc.directory` | PLC Directory                                   |
| `XRPC_TIMEOUT`             | 15s                     | XRPC HTTP timeout                               |

## Deployment

Deployed on Railway with three services:

- **api** — HTTP server (port 8080, health at `/healthz`)
- **indexer** — Tap consumer (health at `:9090/healthz`)
- **tap** — Tap instance (external dependency)

All services share the same Turso database. The API and indexer are separate deployments of the same binary with different subcommands.
