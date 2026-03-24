---
title: "Twister — Technical Specification Index"
updated: 2026-03-22
---

# Twister Technical Specifications

Twister is a Go-based index and search service for [Tangled](https://tangled.org) content on AT Protocol.
It ingests records through [Tap](https://github.com/bluesky-social/indigo/tree/main/cmd/tap), denormalizes them into search documents and graph summaries, indexes them in [Turso/libSQL](https://docs.turso.tech), and exposes public APIs for search and index-backed data gaps.

## Specifications

| #   | Document                                   | Description                                                     |
| --- | ------------------------------------------ | --------------------------------------------------------------- |
| 1   | [Architecture](01-architecture.md)         | Purpose, goals, design principles, system context, tech choices |
| 2   | [Tangled Lexicons](02-tangled-lexicons.md) | `sh.tangled.*` record schemas and fields                        |
| 3   | [Data Model](03-data-model.md)             | Database schema, search documents, sync state                   |
| 4   | [Data Pipeline](04-data-pipeline.md)       | Tap integration, normalization, failure handling                |
| 5   | [Search](05-search.md)                     | Search modes, API contract, scoring, filtering                  |
| 6   | [Operations](06-operations.md)             | Configuration, observability, security, deployment              |
| 7   | [Graph Backfill](07-graph-backfill.md)     | Seed-based user discovery and content backfill                  |
| 8   | [App Integration](08-app-integration.md)   | Mobile-facing contracts for search and graph summaries          |
| 9   | [Search Site](09-search-site.md)           | Static site for API docs and live search                        |
