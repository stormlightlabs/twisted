# Twisted — Tangled Mobile Companion

A mobile-first Tangled client for iOS, Android, and web. Built with Ionic Vue, Capacitor, and the `@atcute` AT Protocol client stack.

## What is Tangled

[Tangled](https://tangled.org) is a Git hosting and collaboration platform built on the [AT Protocol](https://atproto.com). Identity, social graph (follows, stars, reactions), repos, issues, and PRs are all AT Protocol records stored on users' Personal Data Servers. Git hosting runs on **knots** — headless servers exposing XRPC APIs. The **appview** at `tangled.org` aggregates and renders the network view.

- Docs: <https://docs.tangled.org>
- Lexicon namespace: `sh.tangled.*`
- Source: <https://tangled.org/tangled.org/core>

## What Twisted Does

**Reader and social companion** for Tangled. Focused on direct browsing, indexed discovery, and lightweight interactions.

- Browse repos, files, READMEs, issues, PRs
- Jump to profiles and repos from a known AT Protocol handle
- Search indexed repos and profiles through the Twister API
- Use index-backed graph summaries where the public API is incomplete
- Sign in via AT Protocol OAuth
- Star repos, follow users, react to content
- Offline-capable with cached data

Out of scope: repo creation, git push/pull, CI/CD, full code review authoring.

## Technology

| Layer       | Choice                                                                                        |
| ----------- | --------------------------------------------------------------------------------------------- |
| Framework   | Vue 3 + TypeScript                                                                            |
| UI          | Ionic Vue                                                                                     |
| Native      | Capacitor (iOS, Android, Web)                                                                 |
| State       | Pinia                                                                                         |
| Async data  | TanStack Query (Vue)                                                                          |
| AT Protocol | `@atcute/client` (XRPC), `@atcute/oauth-browser-client` (OAuth), `@atcute/tangled` (lexicons) |

## Architecture

Three layers, strict dependency direction (presentation → domain → data):

**Presentation** — Ionic pages, Vue components, composables, Pinia stores.
**Domain** — Normalized models (`UserSummary`, `RepoDetail`, `ActivityItem`, etc.), action policies, pagination.
**Data** — `@atcute/client` XRPC calls, `@atcute/tangled` type definitions, local cache, and the Twister API for search/index-backed summaries.

Protocol isolation: no Vue component imports `@atcute/*` directly. All API access flows through `src/services/`.

## Tangled API Surface

Three distinct data hosts:

| Host                               | Protocol                           | Data                                                              |
| ---------------------------------- | ---------------------------------- | ----------------------------------------------------------------- |
| Knots (`us-west.tangled.sh`, etc.) | XRPC at `/xrpc/sh.tangled.*`       | Git data: trees, blobs, commits, branches, diffs, tags            |
| User's PDS                         | XRPC at `/xrpc/com.atproto.repo.*` | AT Protocol records: repos, issues, PRs, stars, follows, profiles |
| Twister API                        | HTTP JSON                          | Global search and index-backed graph/profile summaries            |

The appview (`tangled.org`) serves HTML — it's the web UI, not a JSON API. The mobile client talks to knots and PDS servers directly for canonical detail and uses the Twister API for cross-network discovery.

Repo param format: `did:plc:xxx/repoName`.

## Phases

| Phase | Focus                                                                    | Spec                                 | Tasks                                |
| ----- | ------------------------------------------------------------------------ | ------------------------------------ | ------------------------------------ |
| 1     | Project shell, tabs, mock data, design system                            | [phase-1.md](phase-1.md)             | [../tasks/phase-1.md](../tasks/phase-1.md) |
| 2     | Public browsing — repos, files, profiles, issues, PRs                    | [phase-2.md](phase-2.md)             | [../tasks/phase-2.md](../tasks/phase-2.md) |
| 3     | Index-backed search and handle-first public browsing                     | [phase-3.md](phase-3.md)             | [../tasks/phase-3.md](../tasks/phase-3.md) |
| 4     | OAuth sign-in, star, follow, react, personalized feed                    | [phase-4.md](phase-4.md)             | [../tasks/phase-4.md](../tasks/phase-4.md) |
| 5     | Offline persistence, performance, bundle optimization                    | [phase-5.md](phase-5.md)             | [../tasks/phase-5.md](../tasks/phase-5.md) |
| 6     | Write features, project service integration, push notifications          | [phase-6.md](phase-6.md)             | [../tasks/phase-6.md](../tasks/phase-6.md) |
| 7     | Real-time Jetstream feed, custom feeds, forking, labels, interdiff       | [phase-7.md](phase-7.md)             | [../tasks/phase-7.md](../tasks/phase-7.md) |

## Key Design Decisions

1. **`@atcute` end-to-end** for all AT Protocol interaction — no mixing client stacks.
2. **Tangled lexicon handling in one module boundary** (`src/services/tangled/`) — don't scatter `sh.tangled.*` awareness across pages.
3. **Read-first** — the primary product is a fast reader. Social mutations are a controlled second layer.
4. **Use the project API sparingly and intentionally.** Search and index-backed graph gaps belong there; canonical repo detail stays on Tangled's public APIs.
5. **Mobile-first, not desktop-forge-first** — prioritize readability, direct browsing, and small focused actions before broader discovery surfaces.
