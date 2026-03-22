# Phase 7 — Real-Time Feed & Advanced Features

## Goal

Add real-time event streaming, custom feed logic, and advanced social coding features. This phase makes the app feel alive.

## Jetstream Integration

### Package

`@atcute/jetstream` — subscribe to the AT Protocol event stream.

### Architecture

Connect to a Jetstream relay and filter for `sh.tangled.*` collections:

```sh
Jetstream WebSocket
  → filter: sh.tangled.* events
    → normalize into ActivityItem
      → merge into TanStack Query feed cache
        → reactive UI update
```

### Connection Management

- Connect on app foreground, disconnect on background
- Reconnect with exponential backoff
- Track cursor position for gap-fill on reconnect
- Battery-aware: reduce polling frequency on low battery (Capacitor Battery API)

### Live Indicators

- Repo detail: show "new commits" banner when ref updates arrive
- Activity feed: show "X new items" pill, tap to scroll to top and reveal
- PR detail: live status updates (open → merged)

## Custom Feeds

Allow users to create saved feed configurations:

- "My repos" — activity on repos I own
- "Watching" — activity on repos I starred
- "Team" — activity from users I follow
- Custom filters: by repo, by user, by event type

Feeds are stored locally in IndexedDB. If a BFF exists, they can optionally sync server-side for push notification filtering.

## Advanced Features

### Repo Forking

- Fork button on repo detail (requires `rpc:sh.tangled.repo.create` scope)
- Fork status indicator via `sh.tangled.repo.forkStatus` (up-to-date, fast-forwardable, conflict, missing branch)
- Sync fork via `sh.tangled.repo.forkSync`

### Label Support

- Display labels on issues and PRs
- Apply/remove labels (requires label scopes)
- Color-coded label chips

### Reaction Picker

- Expand reaction support beyond star/follow
- Emoji picker for: thumbsup, thumbsdown, laugh, tada, confused, heart, rocket, eyes
- Show reaction counts on PRs, issues, comments

### PR Interdiff

- View diff between PR rounds (round N vs round N+1)
- Useful for code review on mobile — see what changed since last review

### Knot Information

- Show which knot hosts a repo
- Knot version and status
- Useful for debugging and transparency

## Testing

- WebSocket reliability under network transitions (WiFi → cellular)
- Feed deduplication when Jetstream replays events
- Memory usage with long-running WebSocket connections
- Battery impact measurement on mobile
