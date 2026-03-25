---
title: Data Sources & Integration
updated: 2026-03-25
---

Twisted pulls data from five external sources and authenticates users via Bluesky OAuth. Each source has a distinct role — no single source is authoritative for everything.

## Source Overview

| Source | What it provides | Access pattern |
| --- | --- | --- |
| **Tangled XRPC (Knots)** | Git data — file trees, blobs, commits, branches, diffs, tags | Direct XRPC calls to the knot hosting each repo |
| **AT Protocol (PDS)** | User records — profiles, repos, issues, PRs, comments, stars, follows | `com.atproto.repo.getRecord` / `listRecords` on user's PDS |
| **Constellation** | Social signals — star counts, follower counts, reaction counts, backlink lists | Public JSON API at `constellation.microcosm.blue` |
| **Tap** | Real-time firehose of AT Protocol record events for authoritative indexing | WebSocket consumer, feeds the search index |
| **JetStream** | Recent JSON activity stream for cached feed data | WebSocket consumer, feeds a bounded recent-activity cache |

## Constellation

[Constellation](https://constellation.microcosm.blue) is a public, self-hosted index of AT Protocol backlinks. It answers "who linked to this?" across the entire network — making it the right source for aggregated social signals instead of maintaining our own counters.

### Key Endpoints

**`GET /xrpc/blue.microcosm.links.getBacklinks`** — Get records linking to a target.

- `subject` (required) — The target (AT-URI, DID, or URL)
- `source` (required) — Collection and path, e.g. `sh.tangled.feed.star:subject.uri`
- `did` — Filter to specific users (repeatable)
- `limit` — Default 16, max 100
- `reverse` — Reverse ordering

**`GET /xrpc/blue.microcosm.links.getBacklinksCount`** — Count of links to a target.

- `subject`, `source` — Same as above

**`GET /xrpc/blue.microcosm.links.getManyToManyCounts`** — Secondary link counts in many-to-many relationships.

- `subject`, `source`, `pathToOther` (required)
- `did`, `otherSubject`, `limit` (optional)

### Usage in Twisted

| Need                      | Constellation call                                                                       |
| ------------------------- | ---------------------------------------------------------------------------------------- |
| Star count for a repo     | `getBacklinksCount(subject=repo_at_uri, source=sh.tangled.feed.star:subject.uri)`        |
| Who starred a repo        | `getBacklinks(subject=repo_at_uri, source=sh.tangled.feed.star:subject.uri)`             |
| Follower count for a user | `getBacklinksCount(subject=user_did, source=sh.tangled.graph.follow:subject)`            |
| Who follows a user        | `getBacklinks(subject=user_did, source=sh.tangled.graph.follow:subject)`                 |
| Reaction count on content | `getBacklinksCount(subject=content_at_uri, source=sh.tangled.feed.reaction:subject.uri)` |

This replaces the need to index and count interaction records ourselves. Our Tap pipeline still indexes interaction records for search and graph discovery, but Constellation is the source of truth for counts and lists.

### Integration Notes

- No authentication required. Constellation asks for a user-agent header with project name and contact.
- Responses are paginated via cursor. Plan for multiple pages when listing (e.g., all followers).
- The API is read-only — social actions (star, follow, react) are still AT Protocol record writes to the user's PDS.

## Tangled XRPC (Knots)

Knots are Tangled's git hosting servers. Each repo lives on a specific knot, identified by the knot DID in the repo's AT Protocol record.

### Endpoints Used

- `sh.tangled.repo.tree` — File tree for a ref
- `sh.tangled.repo.blob` — File content
- `sh.tangled.repo.log` — Commit history
- `sh.tangled.repo.branches` / `sh.tangled.repo.tags` — Refs
- `sh.tangled.repo.getDefaultBranch` — Default branch name
- `sh.tangled.repo.diff` / `sh.tangled.repo.compare` — Diffs
- `sh.tangled.repo.languages` — Language breakdown
- `sh.tangled.knot.version` — Knot software version

### Routing

The app resolves which knot hosts a repo by reading the repo's AT Protocol record (which contains the knot DID), then resolving the knot DID to its service endpoint. XRPC calls go directly to that knot.

The Tangled appview at `tangled.org` serves HTML only — there is no JSON API at the appview level.

## AT Protocol (PDS)

Standard AT Protocol record access for reading and writing user data.

### Read Operations

- `com.atproto.repo.getRecord` — Fetch a single record by collection + rkey
- `com.atproto.repo.listRecords` — List records in a collection with pagination

Used for: profiles, repo metadata, issues, PRs, comments, stars, follows, reactions.

### Write Operations (Authenticated)

- `com.atproto.repo.createRecord` — Create a new record (star, follow, react, issue, comment)
- `com.atproto.repo.deleteRecord` — Delete a record (unstar, unfollow)

All writes go to the authenticated user's PDS using their OAuth session.

### Identity Resolution

- Handle → DID via `com.atproto.identity.resolveHandle`
- DID → DID document via PLC Directory (`plc.directory`) or `.well-known/did.json`
- DID document → PDS endpoint (from `#atprotoPersonalDataServer` service)

## Tap (Firehose)

Tap provides a filtered firehose of AT Protocol events. Our indexer consumes Tap via WebSocket, indexing records into the search database.

### What We Index via Tap

- Repos, issues, PRs, comments, strings, profiles — for full-text search
- Follows — for graph discovery during backfill
- Issue state and PR status changes — for state filtering in search

### What We Don't Need to Count via Tap

Stars, followers, reactions — Constellation handles counts and lists. We still process these events for graph discovery but don't need to maintain our own counters.

### Role In The Search Plan

Tap remains the authoritative ingestion and backfill path for searchable documents. If search correctness depends on complete historical coverage, Tap or a repo resync path is the right source.

### Tap Protocol

- WebSocket connection with cursor-based resume
- Events contain: operation (create/update/delete), DID, collection, rkey, CID, record payload
- Acks required after processing each event
- Backfill via `/repos/add` endpoint to request historical data for specific users

## JetStream

JetStream is a lighter JSON stream derived from the firehose. It is useful for recent activity and developer ergonomics, but it is not the authoritative source for search indexing.

### Usage In Twisted

- Recent activity cache for the Activity tab
- Collection-filtered stream for `sh.tangled.*` events
- Cursor-based resume using event timestamps

### Constraints

- Use JetStream for recent, cached activity only
- Do not rely on it as the only historical backfill mechanism
- Keep retention bounded and reconnect idempotent

### Role In The Search Plan

- Seed the cursor to roughly 24 hours ago on first boot
- Persist the last processed timestamp and rewind slightly on reconnect
- Cache normalized activity locally so clients do not each need a raw upstream stream
- Keep Tap as the source of truth for search indexing and bulk backfill

## Bluesky OAuth

Authentication uses AT Protocol OAuth via `@atcute/oauth-browser-client`.

### Flow

1. User enters their handle
2. App resolves handle → DID → PDS → authorization server metadata
3. App initiates OAuth with requested scopes
4. User authorizes in browser, redirected back to app
5. App exchanges code for tokens
6. Session provides `dpopFetch` for authenticated XRPC calls

### Scopes

The app requests scopes for:

- `sh.tangled.feed.star` — Star/unstar repos
- `sh.tangled.graph.follow` — Follow/unfollow users
- `sh.tangled.feed.reaction` — Add reactions
- `sh.tangled.actor.profile` — Edit profile
- `sh.tangled.repo.issue` / `sh.tangled.repo.issue.comment` — Create issues and comments
- `sh.tangled.repo.pull.comment` — Comment on PRs

### Capacitor Integration

On native platforms, OAuth callback uses a deep link URL scheme registered with Capacitor. The app listens via `App.addListener('appUrlOpen', ...)` to catch the redirect.

### Session Management

Tokens are stored in secure storage (encrypted localStorage on web, Capacitor Secure Storage on native). Sessions auto-refresh. The app supports multiple accounts with an account switcher.
