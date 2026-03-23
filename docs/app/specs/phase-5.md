# Phase 5 — Offline & Performance Polish

## Goal

Make the app feel native. Cached data loads instantly, offline mode is graceful, and navigation is smooth on mid-range devices.

## Offline Strategy

### Query Persistence

Use TanStack Query's `persistQueryClient` with an IndexedDB adapter:

- Persist all query cache to IndexedDB on each update (debounced)
- On app launch, hydrate TanStack Query cache from IndexedDB before rendering
- Stale-while-revalidate: show persisted data immediately, refresh in background

### What to Persist

| Data                           | Max cached items | TTL    |
| ------------------------------ | ---------------- | ------ |
| Repo metadata                  | 200              | 7 days |
| File trees                     | 50               | 3 days |
| File content (recently viewed) | 100              | 3 days |
| README content                 | 100              | 7 days |
| User profiles                  | 100              | 7 days |
| Activity feed pages            | 10 pages         | 1 day  |
| Search results                 | 20 queries       | 1 day  |

### Offline Detection

- Listen to `navigator.onLine` + `online`/`offline` events
- Show a persistent banner when offline: "You're offline — showing cached data"
- Disable mutation buttons (star, follow) when offline
- Queue mutations for retry when back online (optional, simple queue)

### Sensitive Data

- Auth tokens: Capacitor Secure Storage on native, encrypted `localStorage` wrapper on web
- Never persist tokens in IndexedDB alongside query cache
- Clear auth storage on logout

## Performance Optimizations

### Navigation

- Prefetch repo detail data on repo card hover/long-press
- Keep previous tab's scroll position and data in memory (Ionic's `ion-router-outlet` + `keep-alive`)
- Use `<ion-virtual-scroll>` or a virtualized list for long lists (repos, activity feed)

### Images

- Lazy-load avatars with `loading="lazy"` or Intersection Observer
- Use `avatar.tangled.sh` CDN URLs with size params if available
- Placeholder avatar component with initials fallback

### Bundle

- Route-level code splitting per feature folder
- Tree-shake unused Ionic components
- Measure and optimize with Lighthouse

### Rendering

- Skeleton screens for every data-driven view (already built in Phase 1)
- Debounce search input (already in Phase 3)
- Throttle scroll-based pagination triggers

## Testing Focus

- Offline → online transition: verify data refreshes without duplicates
- Large repo file trees: ensure virtual scroll handles 1000+ items
- Low-bandwidth simulation: verify skeleton → content transitions
- Memory pressure: verify cache eviction works and app doesn't grow unbounded
