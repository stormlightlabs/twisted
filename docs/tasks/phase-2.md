# Phase 2 Tasks — Public Tangled Browsing

## Protocol Setup

- [x] Install `@atcute/client` and `@atcute/tangled`
- [x] Create `services/atproto/client.ts` — singleton XRPC client with configurable base URL
- [x] Add error interceptor that normalizes XRPC errors into typed app errors
- [x] Create `core/errors/tangled.ts` — error types: NotFound, NetworkError, MalformedResponse, RateLimited

## API Validation

- [x] Probe `tangled.org` for JSON API endpoints — returns HTML only (no JSON API); all metadata via PDS
- [x] Confirm knot XRPC endpoints work from browser (CORS check against knot) — `Access-Control-Allow-Origin: *` confirmed on `knot1.tangled.sh`; knot hostname comes from `sh.tangled.repo` PDS record, not a fixed host
- [x] Document which data comes from knots vs appview vs PDS (see endpoints.ts header comment)
- [x] Test `com.atproto.repo.getRecord` for fetching user profiles and repo records from PDS — confirmed working on `bsky.social`

## Service Layer

- [x] Create `services/tangled/endpoints.ts` — typed wrappers for each XRPC query
- [x] Create `services/tangled/normalizers.ts` — transform raw responses → domain models
- [x] Create `services/tangled/queries.ts` — TanStack Query hooks with cache keys and stale times
- [x] Implement knot routing: determine correct knot hostname for a given repo

## Repository Browsing

- [x] Wire `RepoDetailPage` to live repo data (metadata from PDS record + git data from knot)
- [x] Implement repo overview: description, topics, default branch, language breakdown
- [x] Implement README fetch: `sh.tangled.repo.blob` for `README.md` on default branch
- [x] Wire `MarkdownRenderer` to render real README content
- [x] Implement file tree: `sh.tangled.repo.tree` → navigate directories
- [x] Implement file viewer: `sh.tangled.repo.blob` → syntax-highlighted display
- [x] Implement commit log: `sh.tangled.repo.log` with cursor pagination
- [x] Implement branch list: `sh.tangled.repo.branches`

## Profile Browsing

- [x] Fetch user profile from PDS: `com.atproto.repo.getRecord` for `sh.tangled.actor.profile`
- [x] Display profile: avatar (via `avatar.tangled.sh`), bio, links, location, pronouns, pinned repos
- [x] List user's repos: fetch `sh.tangled.repo` records from user's PDS
- [x] Wire `UserCard` component to real data

## Issues (read-only)

- [x] Fetch issues for a repo from PDS records (`listIssueRecords` + `listIssueStateRecords` from owner's PDS)
- [x] Display issue list with state filter (open/closed)
- [x] Issue detail view: title, body, author, state
- [x] Issue comments: fetch `sh.tangled.repo.issue.comment` records, render threaded

## Pull Requests (read-only)

- [x] Fetch PRs for a repo from PDS records (`listPullRecords` + `listPullStatusRecords` from owner's PDS)
- [x] Display PR list with status filter (open/closed/merged)
- [x] PR detail view: title, body, author, source/target branches
- [x] PR comments: fetch `sh.tangled.repo.pull.comment` records

## Caching

- [x] Configure TanStack Query stale/gc times per data type (see spec)
- [x] Set up IndexedDB query persister for offline reads
- [ ] Verify stale-while-revalidate behavior: cached data shows immediately, refreshes in background

## Quality

- [ ] Replace all mock data usage with live queries (remove or gate mocks behind a flag)
- [ ] Test with real Tangled repos (e.g., `tangled.org/core`)
- [ ] Verify error states render correctly: 404, network failure, empty repos
- [ ] Test on slow network (throttled devtools) — verify skeleton → content transition
