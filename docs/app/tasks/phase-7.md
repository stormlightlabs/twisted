# Phase 7 Tasks — Real-Time Feed & Advanced Features

## Jetstream Integration

- [ ] Install `@atcute/jetstream`
- [ ] Create `services/atproto/jetstream.ts` — WebSocket connection manager
- [ ] Filter events for `sh.tangled.*` collections
- [ ] Normalize events into `ActivityItem` domain model
- [ ] Merge live events into TanStack Query feed cache
- [ ] Implement connection lifecycle: connect on foreground, disconnect on background
- [ ] Implement reconnection with exponential backoff and cursor tracking
- [ ] Add battery-aware throttling (Capacitor Battery API)

## Live UI Indicators

- [ ] Activity feed: "X new items" pill at top, tap to reveal
- [ ] Repo detail: "New commits available" banner on ref update events
- [ ] PR detail: live status badge updates (open → merged)
- [ ] Issue detail: live comment count updates

## Custom Feeds

- [ ] Create `domain/feed/custom-feed.ts` — feed configuration model
- [ ] Implement feed builder UI: name + filter rules (by repo, user, event type)
- [ ] Store custom feeds in IndexedDB
- [ ] Render custom feed as a selectable tab/option on Activity page
- [ ] "My repos" preset, "Watching" preset, "Team" preset

## Repo Forking

- [ ] Add fork button to repo detail (authenticated only)
- [ ] Implement fork creation via `sh.tangled.repo.create` with `source` field
- [ ] Show fork status badge: up-to-date, fast-forwardable, conflict, missing branch
- [ ] Implement "Sync fork" action via `sh.tangled.repo.forkSync`

## Labels

- [ ] Fetch label definitions for a repo
- [ ] Display color-coded label chips on issues and PRs
- [ ] Implement label filtering on issue/PR lists
- [ ] Add/remove labels on issues and PRs (authenticated, with label scopes)

## Expanded Reactions

- [ ] Add reaction picker component: thumbsup, thumbsdown, laugh, tada, confused, heart, rocket, eyes
- [ ] Show grouped reaction counts on PRs, issues, and comments
- [ ] Add/remove reactions with optimistic updates

## PR Interdiff

- [ ] Detect PR round count
- [ ] Add round selector to PR detail
- [ ] Fetch and display diff between selected rounds
- [ ] Use `sh.tangled.repo.compare` for cross-round comparison

## Knot Info

- [ ] Show knot hostname on repo detail
- [ ] Fetch knot version via `sh.tangled.knot.version`
- [ ] Display knot status/health indicator

## Quality

- [ ] Test Jetstream under network transitions (WiFi → cellular → offline → online)
- [ ] Verify no duplicate events after reconnection with cursor
- [ ] Measure battery impact of WebSocket connection on iOS and Android
- [ ] Test memory usage with long-running Jetstream connection
- [ ] Load test: simulate high-frequency events, verify UI stays responsive
