# Phase 5 Tasks — Offline & Performance Polish

## Query Persistence

- [ ] Set up `persistQueryClient` with IndexedDB adapter
- [ ] Configure persistence: debounced writes, max cache size, TTL per data type
- [ ] Hydrate query cache from IndexedDB before first render
- [ ] Verify: kill app → relaunch → cached data appears immediately without network

## Offline Detection

- [ ] Create `core/network/status.ts` — reactive online/offline state (composable)
- [ ] Show persistent offline banner when `navigator.onLine` is false
- [ ] Disable mutation buttons (star, follow, react) when offline
- [ ] Show toast when network returns: "Back online — refreshing"

## Secure Storage

- [ ] Abstract auth token storage behind `core/storage/secure.ts`
- [ ] Web: encrypted localStorage wrapper
- [ ] Native: Capacitor Secure Storage plugin
- [ ] Verify tokens are never stored in IndexedDB query cache
- [ ] Clear secure storage on logout

## Cache Eviction

- [ ] Implement max-item limits per data type (repos: 200, files: 100, profiles: 100)
- [ ] Implement TTL eviction (remove entries older than their configured TTL)
- [ ] Run eviction on app launch and periodically (every 30 min)
- [ ] Measure IndexedDB size and log warnings if approaching limits

## Navigation Performance

- [ ] Verify Ionic `keep-alive` preserves tab state and scroll position
- [ ] Implement data prefetch on repo card visibility (Intersection Observer)
- [ ] Test tab switch speed — should feel instant with cached data
- [ ] Profile and fix any layout shifts during navigation

## List Virtualization

- [ ] Replace flat lists with virtualized scroll for: repo lists, activity feed, file trees
- [ ] Test with 1000+ item lists — verify smooth scrolling
- [ ] Verify scroll position restoration when navigating back

## Image Optimization

- [ ] Lazy-load all avatars
- [ ] Add initials fallback for missing avatars
- [ ] Use appropriate image sizes from `avatar.tangled.sh`

## Bundle Optimization

- [ ] Add route-level code splitting (lazy imports per feature)
- [ ] Tree-shake unused Ionic components (configure Ionic's component imports)
- [ ] Measure bundle size — target under 500KB initial JS
- [ ] Run Lighthouse audit — target 90+ performance score on mobile

## Quality

- [ ] Test offline → online transition: data refreshes without duplicates
- [ ] Test low-bandwidth (3G throttle): skeleton → content transitions are smooth
- [ ] Test memory usage over extended use: navigate many repos, check heap doesn't grow unbounded
- [ ] Test on real iOS and Android devices (not just simulators)
- [ ] Measure and document cold start time, tab switch time, scroll performance
