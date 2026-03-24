---
title: Mobile App Reference
updated: 2026-03-24
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

**Presentation** — Vue components and pages using Ionic's component library. Five-tab navigation: Home, Explore, Activity, Profile (visible tabs) plus Repo (pushed route). Repo detail uses segmented tabs: Overview, Files, Issues, PRs.

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

Knots serve XRPC endpoints for git operations. The appview at `tangled.org` returns HTML only (no JSON API), so the app goes directly to knots for git data and PDS for AT Protocol records.

## Completed Features

### Navigation & Shell (Phase 1)

Five-tab layout with Vue Router, skeleton loaders, placeholder pages. Design system components: RepoCard, UserCard, ActivityCard, FileTreeItem, EmptyState, ErrorBoundary, SkeletonLoader, MarkdownRenderer.

### Public Browsing (Phase 2)

All read-only browsing works without authentication:

**Repository browsing** — Metadata display, README rendering (markdown), file tree navigation, file viewer with syntax context, commit log with pagination, branch listing.

**Profile browsing** — Avatar, bio, links fetched from PDS. User's repos listed.

**Issues** — List view with open/closed state filter, detail view with threaded comments.

**Pull Requests** — List view with status filter (open/closed/merged), detail view with comments.

**Caching** — TanStack Query configured with per-data-type stale times. Persistence via Dexie (IndexedDB) — works in Capacitor's WebView on device and in the browser during local dev.

## Routing

The app resolves identities through AT Protocol: handle → DID (via PDS resolution) → records. For repo git data, the knot hostname is extracted from the repo's DID document.

Home tab currently provides direct handle-based browsing: enter a known handle to view their profile and repos. This works without any index or search dependency.
