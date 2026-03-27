---
title: ADR Research - Turso For Production Search
updated: 2026-03-26
status: superseded
---

## Status

This research record is kept for history. It no longer describes the active
deployment direction.

## Historical Summary

Turso was originally attractive because Twisted already used SQLite-style
queries, migrations, and FTS5 search behavior. It offered the shortest path
from local file-backed development to a remotely hosted production database.

## Why It Was Superseded

The project has now chosen PostgreSQL plus Coolify instead.

Main reasons:

- Twisted now runs as multiple long-lived services against one shared database
- the project wants standard production operations and restore tooling
- local and production environments should converge on one database family
- the cost of carrying Turso-specific behavior forward outweighed the migration

## What Still Matters From This Research

- rebuilding the dataset from upstream sources remains the safer default than
  promoting an experimental local database
- embedded-replica ideas were interesting but were not a fit for the Go stack
  the project kept
- search behavior changes must be treated as product-visible, not just as a
  storage swap

## Current Source Of Truth

See `docs/adr/storage.md` for the accepted storage decision.
