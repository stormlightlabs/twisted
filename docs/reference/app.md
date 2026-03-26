---
title: Mobile App Reference
updated: 2026-03-25
---

Twisted is an Ionic Vue mobile app for browsing Tangled, a git hosting platform built on the AT Protocol. It targets iOS and Android via Capacitor (no web target).

## Tech Stack

- **Vue 3** with TypeScript and Composition API
- **Ionic Vue** for native-feeling UI components
- **Capacitor** for iOS/Android builds
- **Pinia** for state management
- **TanStack Query** for async data with caching
- **@atcute/client** and **@atcute/tangled** for AT Protocol XRPC

TypeScript files use `.js` extensions in imports. Package management via pnpm.

## Architecture

Three-layer design:

**Presentation** — Vue components and pages using Ionic's component library. Five-tab navigation: Home, Explore, Activity, Bookmarks/Profile, Settings. Repo detail uses segmented tabs: Overview, Files, Issues, PRs.

**Domain** — TypeScript types modeling the app's data: UserSummary, RepoSummary, RepoDetail, RepoFile, PullRequestSummary, IssueSummary, ActivityItem. These are app-internal representations, decoupled from API response shapes.

**Data** — Service layer that fetches from external sources and normalizes into domain types. The flow is: Vue component → composable → TanStack Query hook → service function → XRPC call → normalizer → domain model.

## Directory Structure

```sh
src/
  app/          — App shell, router, global config
  core/         — Shared utilities, constants
  services/     — API clients and data fetching
    atproto/    — @atcute client setup, error handling
    tangled/    — Endpoints, normalizers, TanStack Query hooks
  domain/       — TypeScript type definitions
  features/     — Feature modules (home, explore, repo, etc.)
  components/   — Shared UI components
```

## Data Sources

The app reads from multiple sources depending on what's needed:

- **Knots** (Tangled XRPC servers) — Git data: file trees, blobs, commits, branches, diffs. Each repo is hosted on a specific knot.
- **PDS** (Personal Data Servers) — AT Protocol records: profiles, issues, PRs, comments, stars, follows. Accessed via `com.atproto.repo.getRecord` and `com.atproto.repo.listRecords`.
- **Twister API** — Search and index-backed summaries (when available).
- **Constellation** — Social signal counts and backlinks (stars, followers, reactions).

The app calls the Twister API for app data. Twister proxies knot and PDS reads,
handle resolution, Constellation counts, and the Jetstream activity stream.

## Completed Features

### Navigation & Shell (Phase 1)

Five-tab layout with Vue Router, skeleton loaders, placeholder pages, and a
local Bookmarks area for repos, strings, and saved files.

### Public Browsing (Phase 2)

All release-mode browsing works without authentication:

**Repository browsing** — Metadata display, README rendering (markdown), file tree navigation, file viewer with syntax context, commit log with pagination, branch listing.

**Profile browsing** — Avatar, bio, links fetched from PDS. User's repos listed.

**Issues** — List view with open/closed state filter, detail view with threaded comments.

**Pull Requests** — List view with status filter (open/closed/merged), detail view with comments.

**Caching** — TanStack Query configured with per-data-type stale times.
Persistence currently uses IndexedDB via `idb-keyval`, with a separate local
bookmarks store for saved repos, strings, files, and READMEs.

## Storage Migration

IndexedDB is the current implementation for cache and bookmark persistence, but
it should be treated as an interim step.

- Local cache and offline-content storage should migrate toward SQLite so larger
  saved payloads, better inspection, and more explicit schema management are
  available on-device.
- Sensitive auth/session material should migrate toward Ionic secure storage
  instead of living in browser-style storage primitives.
- Until that migration lands, IndexedDB should stay limited to non-sensitive
  cached data and user-saved offline reading content.

## Auth Split

Production builds are read-only and hide auth entry points. Dev builds keep the
current OAuth flow available for testing future authenticated features.

## Routing

The app resolves identities through AT Protocol: handle → DID (via PDS resolution) → records. For repo git data, the knot hostname is extracted from the repo's DID document.

Home tab currently provides direct handle-based browsing: enter a known handle to view their profile and repos. This works without any index or search dependency.
