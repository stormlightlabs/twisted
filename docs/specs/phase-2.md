# Phase 2 — Public Tangled Browsing

## Goal

Replace mock data on the shippable public-browsing surface with live Tangled API calls. Users can browse repos, profiles, file trees, README content, issues, and pull requests without signing in. Public entry points are intentionally scoped down for now: Home is a known-handle jump surface, while Explore and Activity remain clearly labeled placeholders until their dedicated work lands.

## Protocol Stack

| Package           | Version | Role                                           |
| ----------------- | ------- | ---------------------------------------------- |
| `@atcute/client`  | ^4.2.1  | XRPC HTTP client — `query()` and `procedure()` |
| `@atcute/tangled` | ^1.0.17 | `sh.tangled.*` lexicon type definitions        |

All protocol access goes through `src/services/tangled/`. No Vue component may import `@atcute/*` directly.

## Architecture: Protocol Isolation

```sh
Vue component
  → composable (useRepoDetail, useFileTree, ...)
    → TanStack Query hook
      → service function (services/tangled/queries.ts)
        → @atcute/client XRPC call
          → normalizer (services/tangled/normalizers.ts)
            → domain model
```

### Service Layer Responsibilities

**`services/atproto/client.ts`** — singleton `XRPC` client instance, base URL config, error interceptor.

**`services/tangled/endpoints.ts`** — typed wrappers around XRPC queries:

| Endpoint                           | Params                                      | Returns             |
| ---------------------------------- | ------------------------------------------- | ------------------- |
| `sh.tangled.repo.tree`             | `repo: did:plc:xxx/name`, `ref`, `path?`    | directory listing   |
| `sh.tangled.repo.blob`             | `repo`, `ref`, `path`                       | file content        |
| `sh.tangled.repo.log`              | `repo`, `ref`, `path?`, `limit?`, `cursor?` | commit history      |
| `sh.tangled.repo.branches`         | `repo`, `limit?`, `cursor?`                 | branch list         |
| `sh.tangled.repo.tags`             | `repo`                                      | tag list            |
| `sh.tangled.repo.getDefaultBranch` | `repo`                                      | default branch name |
| `sh.tangled.repo.diff`             | `repo`, `ref`                               | diff output         |
| `sh.tangled.repo.compare`          | `repo`, `rev1`, `rev2`                      | comparison          |
| `sh.tangled.repo.languages`        | `repo`                                      | language breakdown  |

The `repo` param format is `did:plc:xxx/repoName`. The XRPC calls go to the repo's **knot** hostname (e.g., `us-west.tangled.sh`), not to `tangled.org`.

**`services/tangled/normalizers.ts`** — transform raw lexicon responses into domain models (`RepoSummary`, `RepoDetail`, `RepoFile`, etc.).

**`services/tangled/queries.ts`** — TanStack Query wrapper functions with cache keys, stale times, and error handling.

## Appview vs Knot Routing

Tangled has two API surfaces:

| Surface | Host                       | Protocol                    | Used for                                          |
| ------- | -------------------------- | --------------------------- | ------------------------------------------------- |
| Appview | `tangled.org`              | HTTP (HTML, HTMX)           | Profile pages, repo listings, timeline, search    |
| Knots   | `us-west.tangled.sh`, etc. | XRPC (`/xrpc/sh.tangled.*`) | Git data — trees, blobs, commits, branches, diffs |

For Phase 2, git data comes from knots via XRPC. Profile and repo metadata come from PDS records queried through `com.atproto.repo.getRecord` and `com.atproto.repo.listRecords`, not from the HTML appview. The service layer must route requests to the correct host based on the operation.

## Features

### Repository Browsing

- List repos for a user (from their PDS records or appview)
- Repo overview: metadata, description, topics, default branch, language stats
- README rendering: fetch blob for `README.md` from default branch, render markdown
- File tree: navigate directories, open files
- File viewer: syntax-highlighted source display
- Commit log: paginated history for a ref/path
- Branch list with default branch indicator

### Profile Browsing

- View user profile: avatar, bio, links, pronouns, location, pinned repos
- Profile data comes from `sh.tangled.actor.profile` record (key: `self`) on the user's PDS
- List user's repos

### Public Discovery (scoped down)

- Home acts as the temporary public entry point: enter a known AT Protocol handle, then jump to profile or browse that handle's repos
- Explore remains visible as a placeholder for future search work, but should not pretend global search already exists
- Activity remains visible as a placeholder for future feed work, but should not pretend a public timeline already exists
- Unsupported global search/trending behavior should be omitted or clearly labeled as future work, never filled with silent mock data

### Pull Requests (read-only)

- List PRs for a repo with status filter (open/closed/merged)
- PR detail: title, body, author, source/target branches, round count
- PR comments list

### Issues (read-only)

- List issues for a repo with state filter (open/closed)
- Issue detail: title, body, author
- Issue comments (threaded — `replyTo` field)

## Caching Strategy

| Data          | Stale time | Cache time |
| ------------- | ---------- | ---------- |
| Repo metadata | 5 min      | 30 min     |
| File tree     | 2 min      | 10 min     |
| File content  | 5 min      | 30 min     |
| Commit log    | 2 min      | 10 min     |
| Profile       | 10 min     | 60 min     |
| README        | 5 min      | 30 min     |

Use TanStack Query's `staleTime` and `gcTime`. Add a query persister (IndexedDB-backed) for offline reads.

## Error Handling

Normalize these failure modes at the service layer:

- Network unreachable → offline banner, serve from cache
- 404 from knot → "Repository not found" or "File not found"
- XRPC error responses → map to typed app errors
- Malformed response → log + generic error state
