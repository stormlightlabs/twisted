---
title: API Service Reference
updated: 2026-03-26
---

Twisted is a Go service that indexes Tangled content, serves search, and caches
recent activity. It uses PostgreSQL for the primary runtime and retains a
temporary local SQLite fallback behind `--local`.

## Runtime Modes

| Command | Purpose |
| --- | --- |
| `api` | HTTP API server |
| `indexer` | Tap consumer and index writer |
| `backfill` | register repos with Tap |
| `enrich` | fill missing repo names, handles, and web URLs |
| `reindex` | re-upsert documents and finalize the search index |
| `healthcheck` | one-shot config and process probe |

## HTTP API

- `GET /healthz` — liveness probe
- `GET /readyz` — readiness probe, checks database reachability
- `GET /search` — keyword search
- `GET /documents/{id}` — fetch one indexed document
- `GET /admin/status` — cursor and queue state when admin routes are enabled

The API also serves the built-in search/docs site from `/` and `/docs*`.

## Search

Keyword search is implemented with PostgreSQL full-text search.

- weighted fields: title, author handle, repo name, summary, body, tags
- query parser: `websearch_to_tsquery('simple', ...)`
- ranking: `ts_rank_cd`
- snippets: `ts_headline`

Response shape stays the same as the previous FTS5 API. Ranking and snippet
details are allowed to differ from the SQLite-era implementation.

## Database

Primary backend: PostgreSQL.

Main tables:

- `documents`
- `sync_state`
- `identity_handles`
- `record_state`
- `indexing_jobs`
- `indexing_audit`
- `jetstream_events`

`documents` stores a generated weighted `tsvector` column plus a GIN index for
keyword search.

## Configuration

Primary env vars:

- `DATABASE_URL`
- `HTTP_BIND_ADDR`
- `INDEXER_HEALTH_ADDR`
- `TAP_URL`
- `TAP_AUTH_PASSWORD`
- `INDEXED_COLLECTIONS`
- `READ_THROUGH_MODE`
- `READ_THROUGH_COLLECTIONS`
- `READ_THROUGH_MAX_ATTEMPTS`
- `ENABLE_ADMIN_ENDPOINTS`
- `ADMIN_AUTH_TOKEN`

Default local database URL:

```sh
postgresql://localhost/${USER}_dev?sslmode=disable
```

`--local` is deprecated and switches to the legacy SQLite fallback at
`packages/api/twister-dev.db`.

## Local Operation

Start local Postgres with the repo compose file:

```sh
just db-up
just api-dev
just api-run-indexer
```

That dev compose file also runs Tap locally at `ws://localhost:2480/channel`.

Use `just api-dev sqlite` only when you need the temporary SQLite rollback path.

## Deployment

Production uses:

- Coolify Application with `docker-compose.prod.yaml`
- separate Coolify-managed PostgreSQL resource
- private Tap service from the pinned Indigo image
- built-in Coolify Traefik for the public `api` domain

See `docs/reference/deployment-walkthrough.md` for the full production flow.
