---
title: Roadmap
updated: 2026-03-26
---

## API: Search Stabilization

Highest priority. This work blocks further investment in search quality and broader discovery features.

- [x] Stabilize local development around PostgreSQL, with SQLite kept only as a rollback path
- [x] Document backup, restore, and disk-growth procedures for the experimental local DB
- [x] Research production backend options: PostgreSQL, Turso remote/libSQL, and Turso embedded replicas
- [x] Write a production storage decision record with workload and operational tradeoffs, using `docs/adr/pg.md` and `docs/adr/turso.md`
- [x] Define the migration path from the experimental local setup to the chosen production backend
- [x] Add a durable read-through indexing job queue for records fetched through the API
- [x] Add API smoke tests for `healthz`, `readyz`, `search`, `documents`, indexing, and activity in `packages/scripts/api/`
  - desertthunder.dev DID: `did:plc:xg2vq45muivyy3xwatcehspu`
  - Twisted AT URI: `at://did:plc:xg2vq45muivyy3xwatcehspu/sh.tangled.repo/3mho6hukiei22`
  - Profile AT URI: `at://did:plc:xg2vq45muivyy3xwatcehspu/sh.tangled.actor.profile/self`
  - Follow AT URI (desertthunder.dev follows npmx): `at://did:plc:xg2vq45muivyy3xwatcehspu/sh.tangled.graph.follow/3mhofstanru22`
  - Star AT URI (desertthunder.dev stars microcosm-rs): `at://did:plc:lulmyldiq4sb2ikags5sfb25/sh.tangled.repo/3lvsxzinfz222`
- ~~Add `just` targets for smoke-test runs locally and against a remote base URL~~ directly invoking the scripts is fine.
- [x] Reuse the existing normalization and upsert path for on-demand indexing jobs
- [x] Trigger indexing jobs from repo, issue, PR, profile, and similar fetch handlers
- [x] Add dedupe, retries, and observability for indexing jobs
- [x] Add a JetStream cache consumer with a persisted timestamp cursor
- [x] Seed the JetStream cursor to `now - 24h` on first boot and rewind slightly on reconnect
- [x] Store and serve bounded recent activity from the local cache
- [x] Keep Tap as the authoritative indexing and bulk backfill path
- [x] Define a controlled backfill and repo-resync playbook for recovery (`docs/reference/resync.md`)

## API: Constellation Integration

Completed on [2026-03-25](../CHANGELOG.md#2026-03-25)

## API: Keyword Search Quality

Improve keyword search quality without external dependencies.

**Depends on:** API: Search Stabilization

- [ ] Synonym expansion at query time (e.g. "repo" matches "repository")
- [ ] Stemming and parser tuning for PostgreSQL full-text search
- [ ] Prefix search support for autocomplete
- [ ] Field weight tuning based on real query patterns
- [ ] Recency boost for recently updated content
- [ ] Star count ranking signal (via Constellation)
- [ ] State filtering defaults (exclude closed issues)
- [ ] Better snippets with longer context
- [ ] Relevance test fixtures

## API: Observability

**Depends on:** API: Search Stabilization

- [ ] Structured metrics: ingestion rate, search latency, embedding throughput
- [ ] Dashboard or log-based monitoring

## API: Embedding Adapter

**Depends on:** API: Search Stabilization

- [ ] Add an embedding provider interface in the API
- [ ] Add a `llama.cpp` HTTP adapter targeting `llama-embeddings`
- [ ] Add PostgreSQL embedding schema and jobs using `pgvector`
- [ ] Define source-code chunking and repo re-embed triggers
- [ ] Add `embed` and `reembed` operational commands
- [ ] Add queue-depth, latency, and throughput metrics for embeddings
- [ ] Keep semantic or hybrid retrieval behind a non-default search mode

## App: Search & Discovery

Wire the Explore tab to the search API and add activity feed.

**Depends on:** API: Constellation Integration

- [x] Search service pointing at Twister API
- [x] Constellation service for star/follower counts
- [x] Debounced search on Explore tab with segmented results
- [x] Recent search history (local)
- [x] Graceful fallback when search API unavailable
- [x] Activity feed data source investigation (Jetstream vs polling)
- [x] Activity tab with filters, infinite scroll, pull-to-refresh
- [x] Home tab: surface recently viewed repos/profiles

## App: Authentication & Social

Bluesky OAuth and authenticated actions.

**Depends on:** App: Search & Discovery (for Constellation service), API: Constellation Integration

- [x] OAuth setup with `@atcute/oauth-browser-client`
- [x] Login page, OAuth flow, callback handling
- [x] Capacitor deep link configuration
- [x] Session management (restore, refresh, logout, account switcher)
- [x] Auth-aware XRPC client using dpopFetch
- [ ] Star repos (write to PDS, count from Constellation)
- [ ] Follow users (write to PDS, count from Constellation)
- [ ] React to content (write to PDS, count from Constellation)
- [ ] Authenticated profile tab (pinned repos, stats, starred, following)
- [ ] Personalized feed ("For You" / "Global" toggle)

## App: Write Features

**Depends on:** App: Authentication & Social

- [ ] Create issue (title + markdown body)
- [ ] Comment on issues and PRs (threaded)
- [ ] Close/reopen issues
- [ ] Edit profile (bio, links, avatar, pinned repos)
- [ ] OAuth scope upgrade flow

## App: Offline & Performance

**Depends on:** App: Search & Discovery (for cache persistence of search/feed data)

- [x] IndexedDB-backed local cache and bookmark storage for first release
- [ ] Migrate offline cache and saved-content storage from IndexedDB to SQLite
- [ ] TanStack Query persister backed by SQLite or equivalent app-managed store
- [ ] Pinned content store (save/unsave files for offline reading)
- [ ] Pinned files UI (list, pin/unpin actions on file viewer, last-fetched timestamp)
- [ ] Offline detection and banner
- [ ] Migrate auth/session data to Ionic secure storage
- [ ] Cache eviction (per-type limits and TTL, pinned content exempt)
- [ ] List virtualization for large datasets
- [ ] Lazy-load avatars, prefetch on hover
- [ ] Code splitting and bundle optimization (target <500KB JS)

## App: Real-Time & Advanced

**Depends on:** App: Authentication & Social, App: Offline & Performance

- [ ] Jetstream integration for live `sh.tangled.*` events
- [ ] Live UI indicators (new commits, new feed items, PR status)
- [ ] Custom feed presets ("My repos", "Watching", "Team")
- [ ] Repo forking
- [ ] Labels (display, filter, manage)
- [ ] Expanded reactions with emoji picker
- [ ] PR interdiff (compare rounds)
- [ ] Knot info display

## App: Push Notifications

**Depends on:** App: Authentication & Social

- [ ] Register device token on login
- [ ] Subscribe to relevant events
- [ ] Deliver via APNs/FCM
- [ ] Handle notification taps (deep link to relevant screen)
