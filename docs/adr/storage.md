---
title: ADR - Choose Turso For Production Search Storage
updated: 2026-03-25
status: accepted
---

## Decision

Twister will use Turso as the production database backend for search and indexing.

This decision is based on current project constraints, not on a claim that Turso is universally superior to PostgreSQL. The goal is to ship a production-capable search service with the lowest migration cost from the current codebase while keeping room to revisit the decision later if the workload changes materially.

## Context

Twister's current search hardening work has two separate concerns:

1. make local experimentation cheaper and less messy
2. choose a production backend deliberately instead of letting the experimentation setup turn into production by accident

The codebase already relies on SQLite/libSQL-style behavior:

- SQLite FTS5 search
- SQLite-oriented migrations
- `database/sql` access via `github.com/tursodatabase/libsql-client-go`
- local experimentation through `file:` databases

The production candidates researched were:

- PostgreSQL
- Turso remote/libSQL
- Turso embedded-replica style deployment

The supporting research is recorded in:

- [PostgreSQL research](pg.md)
- [Turso research](turso.md)

## Why Turso

### 1. Lowest Migration Cost

Turso preserves the current SQLite/libSQL query model and avoids a full rewrite of:

- search queries
- migration files
- ranking behavior
- snippet generation behavior
- search regression expectations

PostgreSQL remains a credible long-term option, but adopting it now would force a larger rewrite at exactly the point where search hardening should focus on ingestion correctness, smoke tests, read-through indexing, and the activity cache.

### 2. Best Match For Current Priorities

The immediate work is not to invent a new search architecture. It is to stabilize:

- Tap ingestion
- read-through indexing
- JetStream activity caching
- local experimentation workflows
- end-to-end smoke testing

Turso lets the project do that without changing database families midstream.

### 3. Clear Path From Experimentation To Production

The local `file:` workflow remains the right choice for development and experimentation. For production, the chosen backend family is still Turso, which gives the project a cleaner transition than moving from local SQLite semantics to PostgreSQL semantics all at once.

### 4. Embedded Replicas Stay Optional

This ADR does not require Turso embedded replicas immediately.

The production choice is Turso as the backend family. The initial production shape can be plain remote libSQL if that is the least risky deployment path. Embedded replicas remain a future optimization if the Go driver and build constraints become acceptable.

## Why Not PostgreSQL Right Now

PostgreSQL was the strongest long-term alternative, but it loses on near-term fit.

Reasons not to choose it now:

- it requires rewriting the current FTS5-based search implementation
- it changes search behavior during a hardening phase where behavior stability matters
- it increases migration scope before the ingestion model itself is stabilized
- it solves an architectural future that the project has not yet fully reached

If Twister later becomes a larger multi-process, write-heavy service with operational requirements that outgrow Turso, PostgreSQL can be reconsidered with better evidence.

## Consequences

### Positive

- minimum code churn from the current search implementation
- fastest path to production-capable search hardening
- preserves current SQLite FTS behavior as the baseline
- keeps experimentation and production closer together conceptually

### Negative

- production remains in the SQLite/libSQL family, which may be less conventional than PostgreSQL for some operational teams
- embedded replicas are not a drop-in next step in the current Go setup
- a later move to PostgreSQL would still be a meaningful migration if Twister grows past Turso's sweet spot

## Production Shape

The production recommendation is:

1. keep local `file:` databases for experimentation and development
2. use Turso remote/libSQL as the default production target
3. evaluate embedded replicas only after the main search-hardening work is stable

This avoids coupling the production decision to a premature embedded-replica rollout.

## Follow-Up Work

- define the migration path from the experimental local DB to the production Turso database
- document backup and restore procedures for both local experimentation and production
- keep PostgreSQL as a revisit option if production requirements change
- explicitly evaluate embedded replicas later against Go driver and build constraints

## Experimental Local DB Procedures

The experimental local DB is a workflow aid, not a production artifact.

Operational rules:

1. Keep the database file out of git and treat it as disposable.
2. Use stop-and-copy backups for anything worth preserving.
3. Prefer restore-or-rebuild over repair if the DB becomes suspect.
4. Allow the file to grow during active experiments, then compact or delete it afterward.

The concrete local backup, restore, and disk-growth procedures live in [packages/api/README.md](/Users/owais/Projects/Twisted/packages/api/README.md).

## Migration Path To Production Turso

The migration path is intentionally code-first, not file-first.

Do not promote `twister-dev.db` directly into production. The experimental DB proves schema, queries, and workflow assumptions, but the production dataset should be rebuilt from authoritative upstream sources.

### Phase 1: Stabilize Local Behavior

- finalize schema changes in embedded migrations
- validate search behavior locally
- validate smoke tests against the local workflow

Exit condition:

- a fresh local database can be created from migrations and pass the smoke-test baseline

### Phase 2: Prepare Turso Production Target

- provision the production Turso database
- enable the required SQLite/libSQL features used by Twister
- configure production credentials and environment variables
- verify migrations apply cleanly to an empty production-shaped database

Exit condition:

- Twister can start against an empty Turso database and complete migrations successfully

### Phase 3: Rebuild The Dataset From Sources Of Truth

- start the indexer against Turso
- use Tap backfill and repo-resync paths to rebuild the searchable corpus
- let read-through indexing fill misses during verification
- build the JetStream activity cache from a recent timestamp cursor rather than from copied local state

Exit condition:

- the production Turso dataset is populated from Tap, repo recovery paths, and API-triggered indexing rather than from a copied experimental DB file

### Phase 4: Verify And Cut Over

- run the API smoke scripts against the Turso-backed environment
- confirm health, search, document fetches, indexing, and activity cache behavior
- switch app traffic only after the smoke-test baseline passes

Exit condition:

- production traffic points at the Turso-backed deployment and the local experimental DB is no longer part of the serving path

## Explicit Non-Goal For Migration

The migration plan does not include a direct file copy from local SQLite to production Turso as the default rollout path. If a one-off import becomes necessary later, it should be treated as a separate migration task with its own validation steps.

## Revisit Conditions

Re-open this ADR if any of the following become true:

- Twister needs multiple high-write production workers across separate hosts
- operational requirements start favoring standard PostgreSQL tooling over libSQL continuity
- embedded replicas prove impractical in the Go runtime the project wants to keep
- semantic and hybrid search work introduces storage requirements that fit PostgreSQL materially better
