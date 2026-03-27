---
title: ADR - Choose PostgreSQL And Coolify For Search Storage
updated: 2026-03-26
status: accepted
---

## Decision

Twisted will use PostgreSQL as the primary database backend for search,
indexing, queue state, and activity cache. The production deploy target is one
Compose stack for `postgres`, `migrate`, `api`, `indexer`, `tap`, and
`llama-embeddings`. Coolify can host that stack, but the Compose file remains
the source of truth.

## Why

- PostgreSQL is the better fit for long-running multi-service deployment.
- Coolify still gives the project a straightforward Git-to-deploy path with
  built-in Traefik when we want it.
- The current service shape already wants two long-lived processes writing to
  one shared database.
- A local PostgreSQL workflow keeps development closer to production than the
  old Turso split.

## Consequences

### Positive

- one mainstream database for local and remote environments
- simpler production backups and restore story
- easier operational model for `api` and `indexer`
- explicit migration ownership through a one-shot `migrate` command
- no dependency on Turso-specific SQLite extension behavior

### Negative

- the search layer must move off SQLite FTS5
- ranking and snippet behavior will change
- SQLite remains only as a temporary rollback path during migration

## Search Shape

Keyword search will use PostgreSQL full-text search:

- weighted `tsvector`
- `websearch_to_tsquery('simple', ...)`
- `ts_rank_cd`
- `ts_headline`

The HTTP response shape stays stable, but exact scores and snippets are not
expected to match the previous FTS5 implementation.

## Migration Plan

1. add PostgreSQL connection/config support and local defaults
2. add a primary PostgreSQL migration set
3. move search and store implementations to PostgreSQL
4. deploy the Compose stack from `docker-compose.prod.yaml`
5. rebuild data through `backfill`, `enrich`, and `reindex`
6. cut traffic over only after smoke checks pass

## Explicit Non-Goal

The default migration does not include a Turso-to-PostgreSQL data import. The
serving dataset should be rebuilt from authoritative upstream sources.

## Related Records

- `docs/adr/pg.md` remains the background research for this decision
- `docs/adr/turso.md` is retained as superseded historical context
