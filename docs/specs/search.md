---
title: Search
updated: 2026-03-26
---

Twisted search is now operationally centered on PostgreSQL, Tap ingest, and a
small set of rebuild tools.

## Current State

- primary storage: PostgreSQL
- local default URL: `postgresql://localhost/${USER}_dev?sslmode=disable`
- production deploy target: Coolify application plus managed PostgreSQL
- legacy fallback: local SQLite behind `--local`

## Goals

- keep search fresh through Tap ingest and targeted backfill
- preserve the current `/search` API contract
- make local development and production use the same database family
- keep rebuild and recovery workflows simple enough to rehearse

## Keyword Search

Implemented with PostgreSQL full-text search:

- weighted `tsvector` over title, author handle, repo name, summary, body, tags
- `websearch_to_tsquery('simple', ...)`
- `ts_rank_cd`
- `ts_headline`

Result scores and snippets may differ from the old SQLite FTS5 implementation.

## Ingest Model

1. Tap is the authoritative indexing path.
2. Read-through indexing fills misses from detail fetches.
3. JetStream powers only the bounded activity cache.
4. `backfill`, `enrich`, and `reindex` rebuild the serving dataset.

## Operational Rules

- use explicit collection allowlists in production
- do not import Turso data as the default migration path
- treat PostgreSQL backups and restore drills as part of normal operations
- keep the SQLite path only until the PostgreSQL rollout is fully bedded in

## Next Search Work

- synonym expansion
- stemming and better tokenizer choices
- field weight tuning from real queries
- recency boosts
- relevance fixtures that assert behavior, not exact score strings
