---
title: App Features
updated: 2026-03-24
---

## Search & Discovery

**Depends on:** Search API (Twister), Constellation API

### Search

- Create search service pointing at Twister API
- Debounced search input on Explore tab
- Segmented results: repos, users, issues/PRs
- Recent search history (local storage, clearable)
- Graceful fallback when search API is unavailable

### Discovery Sections

- Explore tab shows search prominently
- Optional: trending repos or recently active repos (if data supports it)
- Profile summaries enriched with Constellation data (star counts, follower counts)

### Home Tab

- Handle-based direct browsing (already works)
- Surface recently viewed repos/profiles from local history
- Optional: personalized suggestions for signed-in users (later)

### Activity Feed

- Investigate data sources: Jetstream, polling PDS, or Twister-aggregated feed
- Activity tab shows recent events from followed users and starred repos
- Filters by event type (commits, issues, PRs, stars)
- Infinite scroll with pull-to-refresh

## Authentication & Social

**Depends on:** Bluesky OAuth, Constellation API

### OAuth Sign-In

- Install `@atcute/oauth-browser-client`
- Host client metadata JSON with required scopes
- Login page: handle input → resolution → OAuth redirect → callback
- Capacitor deep link handling for native redirect
- Session restoration on app launch, automatic token refresh
- Logout, account switcher for multiple accounts
- Auth state: idle → authenticating → authenticated → error

### Social Actions

All social actions are AT Protocol record writes to the user's PDS. Counts come from Constellation.

- **Star:** Create/delete `sh.tangled.feed.star` record. Show star count via Constellation `getBacklinksCount`.
- **Follow:** Create/delete `sh.tangled.graph.follow` record. Show follower count via Constellation.
- **React:** Create `sh.tangled.feed.reaction` record. Show reaction counts via Constellation.
- Optimistic UI updates via TanStack Query mutation + cache invalidation.

### Authenticated Profile

- Profile tab shows current user's data when signed in
- Pinned repos, stats (repos, stars, followers via Constellation)
- Starred repos list
- Following/followers lists (via Constellation `getBacklinks`)
- Settings and logout

### Personalized Feed

- Filter activity feed to followed users and starred repos
- "For You" / "Global" toggle on activity tab

## Write Features

**Depends on:** Authentication

### Issues

- Create issue: title + markdown body, posted as `sh.tangled.repo.issue` record
- Comment on issue: threaded comments as `sh.tangled.repo.issue.comment` records
- Close/reopen: create `sh.tangled.repo.issue.state` record

### Pull Requests

- Comment on PR: `sh.tangled.repo.pull.comment` records

### Profile Editing

- Edit bio, links, location, pronouns, pinned repos
- Avatar upload (max 1MB, png/jpeg)
- Cross-posting toggle
- Posted as updated `sh.tangled.actor.profile` record

### OAuth Scope Upgrade

- Detect when an action requires a scope not yet granted
- Prompt user to re-authorize with expanded scopes

## Offline & Performance

### Local Storage

All local persistence uses **Dexie** over IndexedDB. This works natively in Capacitor's WebView on both iOS and Android, and in the browser during local development — no platform branching or plugins needed.

Three storage layers, each with a distinct purpose:

- **TanStack Query persister (Dexie-backed)** — Automatic cache persistence. Previously-viewed data hydrates on launch and serves from cache when offline. Subject to normal cache eviction (stale times, GC).
- **Pinned content store (Dexie)** — User-initiated "save for offline" storage for files, READMEs, and other reference content. Exempt from cache eviction — only the user removes pinned items. Stores file content, metadata, repo handle, pinned timestamp.
- **Capacitor Preferences** — Small key-value settings (theme, recent search history, feed preferences).
- **Capacitor Secure Storage** — Auth tokens only. Never in Dexie or the query cache.

### Offline Behavior

- TanStack Query serves cached data when offline (stale-while-revalidate)
- Pinned files always available regardless of connectivity
- Offline detection via `navigator.onLine`, persistent banner
- Mutations disabled when offline
- Background refresh when connectivity returns

### Pinned Files

Users can pin/save references to files for offline reading:

- Pin action on file viewer saves content + metadata to the Dexie pinned store
- Pinned files list accessible from profile or a dedicated section
- Content persists until the user explicitly unpins
- Pinned items show last-fetched timestamp; refresh when online

### Cache Management

- Per-type limits: repo metadata (200 items/7 days), file trees (50/3 days), profiles (100/7 days), search results (20/1 day)
- Eviction on app launch and periodically
- Pinned content exempt from eviction
- Measure and cap IndexedDB usage

### Performance

- Prefetch on hover/visibility for likely navigation targets
- Virtualized lists for large datasets (1000+ items)
- Lazy-load avatars with initials fallback
- Route-level code splitting
- Tree-shake Ionic components
- Target: under 500KB JS, shell first-paint under 2s

## Real-Time & Advanced

**Depends on:** Authentication, Activity Feed

### Jetstream Integration

- Connect to Jetstream for real-time `sh.tangled.*` events
- Filter and normalize into ActivityItem, merge into TanStack Query cache
- Connect on foreground, disconnect on background
- Cursor tracking for gap-free resume
- Battery-aware throttling

### Live UI Indicators

- "New commits" banner in repo detail
- "X new items" pill on activity feed
- Live status updates on PR detail
- Issue comment count updates

### Custom Feeds

- Presets: "My repos", "Watching", "Team"
- Feed builder UI for custom filters
- Local storage in IndexedDB

### Advanced Features

- **Repo forking:** Create repo with source field, show fork status, sync action
- **Labels:** Display color-coded chips, filter by label, add/remove with auth
- **Expanded reactions:** Emoji picker, grouped counts, add/remove
- **PR interdiff:** Compare rounds via `sh.tangled.repo.compare`
- **Knot info:** Show hostname, version, health status on repo detail
