# Twister Backend Overview

Twister is a Go backend service that indexes Tangled network content and serves
search queries for the Twisted mobile client. It complements Tangled's public
APIs by providing global search and derived data that's hard to compute client-side.

## Core Responsibilities

1. **Real-time Indexing**: Consumes record changes from Tap (Tangled's event
   stream) and indexes them into SQLite FTS5 for full-text search.

2. **Search API**: Exposes HTTP endpoints for keyword search over repos,
   profiles, issues, pull requests, and follows.

3. **Graph Augmentation**: Caches follower relationships and provides profile
   summaries not easily derivable from the public knot/PDS APIs.

## Architecture

```text
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│    Tap      │────▶│  Indexer    │────▶│   Turso     │
│ (event stream)    │  (ingest)   │     │  (SQLite)   │
└─────────────┘     └─────────────┘     └──────┬──────┘
                                               │
┌─────────────┐     ┌─────────────┐            │
│  Twisted    │────▶│    API      │◀───────────┘
│   (mobile)  │     │  (search)   │
└─────────────┘     └─────────────┘
```

## Commands

The `twister` binary provides six subcommands:

- `api` / `serve`: HTTP server for search and proxy endpoints
- `indexer`: Tap consumer that processes record events into the index
- `backfill`: Discovers users from seeds and registers repos with Tap
- `reindex`: Rebuilds the FTS index from existing documents
- `enrich`: Backfills derived fields (handles, URLs) on existing documents
- `healthcheck`: One-shot health probe

## Data Flow

### Indexing Pipeline (internal/ingest)

1. **Tap Consumer** (`internal/tapclient`): Connects to Tap WebSocket, reads
   record events with cursor-based resume.

2. **Normalizers** (`internal/normalize`): Collection-specific adapters convert
   raw records into normalized `Document` structs. Each collection (repos,
   issues, PRs, follows, profiles) has a dedicated adapter.

3. **Store** (`internal/store`): Upserts documents into SQLite with FTS5 index.
   Tracks cursor position in `sync_state` table for resume-after-restart.

### Search (internal/search)

- **Keyword Search**: SQLite FTS5 full-text search with BM25 ranking
- **Filters**: By collection, author, repo, language, date range, state
- **Results**: Denormalized documents with snippet highlighting

## Key Packages

| Package                  | Purpose                                    |
| ------------------------ | ------------------------------------------ |
| `internal/api`           | HTTP router, handlers, middleware          |
| `internal/store`         | Database access layer (Turso/local SQLite) |
| `internal/ingest`        | Tap event processing pipeline              |
| `internal/normalize`     | Record adapters for each collection type   |
| `internal/search`        | FTS5 query execution                       |
| `internal/backfill`      | Graph discovery and Tap registration       |
| `internal/xrpc`          | XRPC client for Tangled PDS/knot APIs      |
| `internal/constellation` | External service for graph queries         |

## API Endpoints

### Search

- `GET /search` - Unified search across all collections
- `GET /search/keyword` - FTS5 keyword search

### Actors & Repos

- `GET /actors/{handle}` - Profile data
- `GET /actors/{handle}/repos` - User's repositories
- `GET /actors/{handle}/repos/{repo}` - Repo details (tree, log, branches)

### Issues & Pulls

- `GET /issues/{handle}/{rkey}` - Issue detail
- `GET /pulls/{handle}/{rkey}` - Pull request detail

### Identity

- `GET /identity/resolve` - Resolve handle to DID
- `GET /identity/did/{did}` - DID document lookup

### Proxy

- `GET /xrpc/knot/{knot}/{nsid}` - Proxy to Tangled knot
- `GET /xrpc/pds/{pds}/{nsid}` - Proxy to PDS
- `GET /xrpc/bsky/{nsid}` - Proxy to Bluesky

## Database Schema

Core tables in Turso/libSQL:

- `documents`: Denormalized search documents (title, body, metadata)
- `documents_fts`: FTS5 virtual table for full-text search
- `identity_handles`: DID → handle mapping with active status
- `record_state`: Issue/PR state (open/closed/merged)
- `sync_state`: Cursor tracking for Tap consumer resume
- `indexing_jobs`: Queue for async read-through indexing

## Configuration

Environment variables (loaded by `internal/config`):

| Variable              | Purpose                                    |
| --------------------- | ------------------------------------------ |
| `HTTP_BIND_ADDR`      | API server address (default `:8080`)       |
| `TURSO_DATABASE_URL`  | libsql:// URL for Turso or file: for local |
| `TURSO_AUTH_TOKEN`    | Turso auth token (empty for local)         |
| `TAP_URL`             | Tap WebSocket URL (required for indexer)   |
| `TAP_AUTH_PASSWORD`   | Tap authentication password                |
| `INDEXED_COLLECTIONS` | Comma-separated allowlist (empty = all)    |

## Local Development

```bash
# API only (uses local SQLite file)
just api-dev

# Indexer only
just api-run-indexer

# Both in parallel (three terminals)
pnpm dev           # Frontend
pnpm api:run:api   # API
pnpm api:run:indexer  # Indexer
```

For remote Turso, use `--remote` flag or set `TURSO_DATABASE_URL` in `.env`.
