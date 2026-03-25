---
title: ADR Research - PostgreSQL For Production Search
updated: 2026-03-25
status: research
---

## Summary

PostgreSQL is the strongest production candidate if Twister needs a conventional server database with mature operational tooling, strong concurrent write handling, and a full-text search system designed for configurable ranking and long-lived production workloads.

It is not the cheapest path from the current codebase. Moving to PostgreSQL would require rewriting the current SQLite/libSQL search layer, migrations, and indexing queries.

## Why Consider It

Twister's current search hardening plan is explicitly about reducing experimentation overhead. That does not answer the production backend question. PostgreSQL should stay in scope because it offers:

- native full-text search primitives (`tsvector`, `tsquery`)
- ranking and highlighting support
- GIN indexes for inverted-index style search
- mature backup, restore, replication, and managed-hosting options
- familiar operational patterns for multi-process or multi-host deployments

## Fit For Twister

### Strengths

#### Good Match For Write-Heavy Ingest

Twister has several write-producing paths:

- Tap ingestion
- read-through indexing jobs
- JetStream activity cache writes
- future embedding and reindex jobs

PostgreSQL is designed for this class of service. If Twister eventually runs API, workers, and background consumers as separate production processes, PostgreSQL is the least surprising option.

#### Mature Full-Text Search

PostgreSQL's text search stack includes:

- document parsing and query parsing
- configurable dictionaries and stop-word handling
- ranking functions
- headline generation
- GIN indexes for `tsvector` search

This means Twister can keep keyword search in-database without depending on a separate search engine.

#### Operational Predictability

For a service that may evolve into a more conventional always-on backend, PostgreSQL has the most established story for:

- backups and point-in-time recovery
- observability
- migration tooling
- managed production hosting
- separation of app processes from storage

## Costs And Risks

### Migration Cost Is Real

The current codebase is built around SQLite/libSQL semantics:

- SQLite FTS5
- current migration files
- current query behavior and ranking assumptions

Switching to PostgreSQL would require:

- replacing FTS5 queries with PostgreSQL full-text search queries
- rewriting migrations
- revisiting search ranking and snippets
- re-testing all search filters and pagination behavior

This is a bigger code migration than staying inside the SQLite/libSQL family.

### GIN Needs Operational Tuning

PostgreSQL GIN indexes are powerful, but they are not free. The docs note that heavy updates can accumulate pending entries and shift cleanup cost into vacuum or foreground cleanup if not tuned carefully.

For Twister, that means ingestion-heavy workloads would need explicit attention to:

- autovacuum behavior
- index maintenance settings
- bulk reindex or reembed workflows

### Search Behavior Will Change

Even if the feature set remains the same, PostgreSQL text search will not behave identically to SQLite FTS5. Tokenization, ranking, and snippet behavior will need product-level review.

## Repo-Specific Implications

- The current API already uses `database/sql`, so adding a PostgreSQL driver is straightforward at the connection layer.
- The hard part is the search repository and migration layer, not connection management.
- PostgreSQL would decouple production deployment from single-host shared-disk assumptions introduced by the local experimentation workflow.

## When PostgreSQL Is The Better Choice

Choose PostgreSQL if most of the following become true:

- Twister needs multiple long-running workers and API instances writing concurrently.
- We want mainstream database operations over SQLite-family deployment tricks.
- Search hardening turns into a durable production service rather than a lightweight adjunct.
- The project can afford a query and migration rewrite now in exchange for simpler long-term production architecture.

## When PostgreSQL Is Probably Not Worth It

Avoid PostgreSQL for now if most of the following are true:

- The immediate goal is just to stabilize experimentation.
- We want the smallest migration from the current code.
- Single-host or single-writer production remains acceptable.
- Search behavior should stay as close as possible to current SQLite FTS5 behavior.

## Recommendation

PostgreSQL is the strongest long-term production architecture candidate, but not the lowest-friction next step.

If the near-term goal is production hardening with minimal code churn, PostgreSQL should remain an evaluated option rather than the immediate default. If Twister grows into a multi-process write-heavy service, PostgreSQL likely becomes the cleanest production destination.

## Sources

- [PostgreSQL Full Text Search docs](https://www.postgresql.org/docs/current/textsearch.html)
- [PostgreSQL GIN docs](https://www.postgresql.org/docs/current/gin.html)
