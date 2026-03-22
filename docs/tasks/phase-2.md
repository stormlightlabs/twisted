# Phase 2 Tasks — Public Tangled Browsing

## Protocol Setup

- [ ] Install `@atcute/client` and `@atcute/tangled`
- [ ] Create `services/atproto/client.ts` — singleton XRPC client with configurable base URL
- [ ] Add error interceptor that normalizes XRPC errors into typed app errors
- [ ] Create `core/errors/tangled.ts` — error types: NotFound, NetworkError, MalformedResponse, RateLimited

## API Validation

- [ ] Probe `tangled.org` for JSON API endpoints (check headers, try `Accept: application/json`)
- [ ] Confirm knot XRPC endpoints work from browser (CORS check against `us-west.tangled.sh`)
- [ ] Document which data comes from knots vs appview vs PDS
- [ ] Test `com.atproto.repo.getRecord` for fetching user profiles and repo records from PDS

## Service Layer

- [ ] Create `services/tangled/endpoints.ts` — typed wrappers for each XRPC query
- [ ] Create `services/tangled/normalizers.ts` — transform raw responses → domain models
- [ ] Create `services/tangled/queries.ts` — TanStack Query hooks with cache keys and stale times
- [ ] Implement knot routing: determine correct knot hostname for a given repo

## Repository Browsing

- [ ] Wire `RepoDetailPage` to live repo data (metadata from PDS record + git data from knot)
- [ ] Implement repo overview: description, topics, default branch, language breakdown
- [ ] Implement README fetch: `sh.tangled.repo.blob` for `README.md` on default branch
- [ ] Wire `MarkdownRenderer` to render real README content
- [ ] Implement file tree: `sh.tangled.repo.tree` → navigate directories
- [ ] Implement file viewer: `sh.tangled.repo.blob` → syntax-highlighted display
- [ ] Implement commit log: `sh.tangled.repo.log` with cursor pagination
- [ ] Implement branch list: `sh.tangled.repo.branches`

## Profile Browsing

- [ ] Fetch user profile from PDS: `com.atproto.repo.getRecord` for `sh.tangled.actor.profile`
- [ ] Display profile: avatar (via `avatar.tangled.sh`), bio, links, location, pronouns, pinned repos
- [ ] List user's repos: fetch `sh.tangled.repo` records from user's PDS
- [ ] Wire `UserCard` component to real data

## Issues (read-only)

- [ ] Fetch issues for a repo from PDS records
- [ ] Display issue list with state filter (open/closed)
- [ ] Issue detail view: title, body, author, state
- [ ] Issue comments: fetch `sh.tangled.repo.issue.comment` records, render threaded

## Pull Requests (read-only)

- [ ] Fetch PRs for a repo from PDS records
- [ ] Display PR list with status filter (open/closed/merged)
- [ ] PR detail view: title, body, author, source/target branches
- [ ] PR comments: fetch `sh.tangled.repo.pull.comment` records

## Caching

- [ ] Configure TanStack Query stale/gc times per data type (see spec)
- [ ] Set up IndexedDB query persister for offline reads
- [ ] Verify stale-while-revalidate behavior: cached data shows immediately, refreshes in background

## Quality

- [ ] Replace all mock data usage with live queries (remove or gate mocks behind a flag)
- [ ] Test with real Tangled repos (e.g., `tangled.org/core`)
- [ ] Verify error states render correctly: 404, network failure, empty repos
- [ ] Test on slow network (throttled devtools) — verify skeleton → content transition
