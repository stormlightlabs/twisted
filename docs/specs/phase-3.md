# Phase 3 — Search & Activity Feed

## Goal

Add repository/user search and a public activity feed so unauthenticated users can discover content and follow what's happening across Tangled.

## Search

### Discovery Problem

Tangled's appview serves HTML — there is no documented public JSON search API. Search implementation must be validated against one of these strategies:

1. **Appview JSON endpoint** — check if `tangled.org` exposes a search query endpoint (undocumented but possible)
2. **AT Protocol relay/firehose indexing** — build a lightweight search index from ingested records (requires backend)
3. **Client-side PDS enumeration** — impractical at scale
4. **Scrape appview HTML** — fragile, last resort

**Recommended approach**: Start with strategy 1 (probe for JSON endpoints). If unavailable, implement curated discovery (trending, recent) from cached data and defer full search to Phase 6 with a backend.

### Search UI

- Search bar at top of Explore tab
- Segmented results: Repos | Users
- Recent searches (persisted locally)
- Debounced input (300ms)
- Empty state with suggested queries

### Discovery Sections (fallback if search API unavailable)

- Trending repos (most stars in recent window)
- Recently created repos
- Active repos (recent commits)
- Suggested users

## Activity Feed

### Data Source

Activity is derived from AT Protocol records created by users. The appview's `/timeline` page shows this data. Options for the mobile client:

1. **Appview timeline endpoint** — check if there's a JSON variant
2. **Jetstream subscription** — `@atcute/jetstream` can subscribe to the AT Protocol event stream and filter for `sh.tangled.*` record types
3. **PDS record queries** — poll known users' PDS for recent records

**Recommended approach**: Try option 1 first. Fall back to option 2 (Jetstream) for a real-time feed. Option 3 is too slow for a general feed.

### Feed Item Types

Map these AT Protocol record creations to activity cards:

| Record Type                            | Activity Kind | Display                          |
| -------------------------------------- | ------------- | -------------------------------- |
| `sh.tangled.repo` created              | repo_created  | "{actor} created {repo}"         |
| `sh.tangled.feed.star` created         | repo_starred  | "{actor} starred {repo}"         |
| `sh.tangled.graph.follow` created      | user_followed | "{actor} followed {target}"      |
| `sh.tangled.repo.pull` created         | pr_opened     | "{actor} opened PR on {repo}"    |
| `sh.tangled.repo.pull.status` → merged | pr_merged     | "{actor} merged PR on {repo}"    |
| `sh.tangled.repo.issue` created        | issue_opened  | "{actor} opened issue on {repo}" |
| `sh.tangled.repo.issue.state` → closed | issue_closed  | "{actor} closed issue on {repo}" |
| `sh.tangled.feed.reaction` created     | reaction      | "{actor} reacted to {target}"    |

### Feed UI

- Filter chips: All, Repos, PRs, Issues, Social
- Infinite scroll with cursor-based pagination
- Pull-to-refresh
- Activity cards: actor avatar + verb + target + relative timestamp
- Tap card → navigate to repo/profile/PR/issue detail

### Feed Caching

- Cache last 100 feed items in IndexedDB
- Show cached feed immediately, refresh in background (stale-while-revalidate)
- Stale time: 1 min
- Persist across app restarts
