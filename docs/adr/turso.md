---
title: ADR Research - Turso For Production Search
updated: 2026-03-25
status: research
---

## Summary

Turso is the lowest-migration production candidate because Twister already uses libSQL/SQLite-style storage and query patterns. It preserves the current mental model and minimizes rewrite cost.

The open question is not whether Turso can work, but which Turso mode fits production:

- remote libSQL primary
- local experimentation via plain `file:` SQLite
- Turso embedded-replica style local-read, remote-sync patterns

## Why Consider It

Twister already depends on:

- `github.com/tursodatabase/libsql-client-go`
- SQLite-style migrations
- SQLite FTS5 behavior

That makes Turso the shortest path from current code to a production-capable deployment.

## Fit For Twister

### Strengths

#### Lowest Rewrite Cost

Staying with Turso/libSQL keeps Twister in the same family of database semantics it already uses. Compared with PostgreSQL, this means less work in:

- search query rewrites
- migration rewrites
- ranking behavior drift
- compatibility testing

#### Good Match For Local Experimentation

The current hardening plan already relies on local `file:` workflows to reduce the messiness and cost of experimentation. Turso and libSQL naturally support this style of development.

#### Embedded-Replica Model Is Relevant

Turso's embedded replica story is directly relevant to Twister's workload because it allows:

- local reads from a file-backed database
- sync to a remote primary
- read-your-writes behavior for the initiating replica
- periodic background sync

On paper, this is a strong match for a search service that wants cheap local reads while keeping a remote production database.

## Costs And Risks

### Remote Turso Alone Does Not Solve The Current Pain

The current problem statement came from burning reads and writes during experimentation. A plain remote Turso deployment keeps the same basic cost surface, even if production operations are cleaner than ad hoc local experiments.

### Embedded Replicas Have Important Caveats

Turso's embedded replicas are promising, but the docs call out constraints that matter for Twister:

- they require a real filesystem
- they are not suitable for serverless environments without disk
- local DB files should not be opened while syncing
- sync behavior can amplify writes because replication is frame-based

This means the operational model has to be chosen carefully. It is not a free "best of both worlds" switch.

### Current Go Stack Makes The Best Turso Story Harder

This is the biggest repo-specific caveat.

The Turso Go quickstart notes that `github.com/tursodatabase/libsql-client-go/libsql` does not support embedded replicas. Twister currently uses that library for remote libSQL access, while local file mode is handled separately with `modernc.org/sqlite`.

Twister also currently builds with `CGO_ENABLED=0` in `packages/api/justfile`.

That means the cleanest embedded-replica path may require:

- changing drivers
- reconsidering the pure-Go build constraint
- accepting CGO in production builds, or waiting for a better pure-Go story

So while Turso embedded replicas are attractive in principle, they are not a drop-in upgrade for the current codebase.

## Repo-Specific Implications

- Remote Turso/libSQL is the easiest production continuation of the current code.
- Local `file:` mode is already useful for stabilizing experimentation.
- Embedded replicas are strategically interesting but would likely force deeper driver and build changes than the current roadmap implies.

## When Turso Is The Better Choice

Choose Turso if most of the following are true:

- minimizing migration cost is the top priority
- preserving current SQLite FTS behavior matters
- production can tolerate a simpler deployment model, especially early on
- We want to keep search and experimentation close to the current implementation

## When Turso Needs Extra Caution

Be careful with Turso if most of the following are true:

- Twister needs multiple production writers across separate hosts
- the system must avoid CGO and keep pure-Go builds
- We expect embedded replicas to be a near-term production feature
- operational simplicity matters more than minimizing query rewrites

## Recommendation

Turso is the best near-term production candidate if the goal is minimum code churn and continuity with the current search stack.

Remote Turso is the easiest short path. Embedded replicas are the most interesting medium-term Turso option, but they should be treated as additional engineering work rather than an assumption, especially given the current Go driver and build setup.

## Sources

- [Turso Go quickstart](https://docs.turso.tech/sdk/go/quickstart#local-only)
- [Turso embedded replicas docs](https://docs.turso.tech/features/embedded-replicas)
