# Phase 1 — Project Shell & Design System

## Goal

Scaffold the Ionic Vue project with tab navigation, placeholder pages, mock data, and reusable UI primitives. Nothing touches the network. The result is a clickable prototype that validates navigation, layout, and component design before any API integration.

## Technology Stack

| Layer          | Choice                  |
| -------------- | ----------------------- |
| Framework      | Vue 3 + TypeScript      |
| UI kit         | Ionic Vue               |
| Native runtime | Capacitor               |
| State          | Pinia                   |
| Async data     | TanStack Query (Vue)    |
| Routing        | Vue Router (Ionic tabs) |

## Navigation Structure

Five-tab layout:

1. **Home** — trending repos, recent activity, personalized content (auth)
2. **Explore** — search repos/users, filters
3. **Repo** — deep-link target for repository detail (not a persistent tab icon — navigated to from Home/Explore/Activity)
4. **Activity** — global feed (anon), social graph feed (auth)
5. **Profile** — auth state, user card, follows, starred repos, settings

> Repo is a routed detail destination, not a standing tab. The tab bar shows Home, Explore, Activity, Profile. Repo pages are pushed onto the Home/Explore/Activity stacks.

## Directory Layout

```sh
src/
  app/
    router/           # route definitions, tab guards
    boot/             # app-level setup (query client, plugins)
    providers/        # provide/inject wrappers
  core/
    config/           # env, feature flags
    errors/           # error types and normalization
    storage/          # storage abstraction (IndexedDB / Capacitor Secure Storage)
    query/            # TanStack Query client config, persister setup
    auth/             # auth state machine, session store
  services/
    atproto/          # @atcute/client wrapper, identity helpers
    tangled/          # Tangled API: endpoints, adapters, normalizers, queries, mutations
  domain/
    models/           # UserSummary, RepoSummary, RepoDetail, etc.
    feed/             # feed-specific types and helpers
    repo/             # repo-specific types and helpers
    profile/          # profile-specific types and helpers
  features/
    home/
    explore/
    repo/
    activity/
    profile/
  components/
    common/           # cards, buttons, loaders, empty states, error boundaries
    repo/             # repo card, file tree item, README viewer
    feed/             # activity card, feed list
    profile/          # user card, follow button
```

## Domain Models

```ts
export type UserSummary = {
    did: string;
    handle: string;
    displayName?: string;
    avatar?: string;
    bio?: string;
    followerCount?: number;
    followingCount?: number;
};

export type RepoSummary = {
    atUri: string;
    ownerDid: string;
    ownerHandle: string;
    name: string;
    description?: string;
    primaryLanguage?: string;
    stars?: number;
    forks?: number;
    updatedAt?: string;
    knot: string;
};

export type RepoDetail = RepoSummary & {
    readme?: string;
    defaultBranch?: string;
    languages?: Record<string, number>;
    collaborators?: UserSummary[];
    topics?: string[];
};

export type RepoFile = {
    path: string;
    name: string;
    type: "file" | "dir" | "submodule";
    size?: number;
    lastCommitMessage?: string;
};

export type PullRequestSummary = {
    atUri: string;
    title: string;
    authorDid: string;
    authorHandle: string;
    status: "open" | "merged" | "closed";
    createdAt: string;
    updatedAt?: string;
    sourceBranch: string;
    targetBranch: string;
    roundCount?: number;
};

export type IssueSummary = {
    atUri: string;
    title: string;
    authorDid: string;
    authorHandle: string;
    state: "open" | "closed";
    createdAt: string;
    commentCount?: number;
};

export type ActivityItem = {
    id: string;
    kind:
        | "repo_created"
        | "repo_starred"
        | "user_followed"
        | "pr_opened"
        | "pr_merged"
        | "issue_opened"
        | "issue_closed";
    actorDid: string;
    actorHandle: string;
    targetUri?: string;
    targetName?: string;
    createdAt: string;
};
```

## Repo Detail Page Structure

Segmented tab layout within the repo detail view:

| Segment  | Content                                                                              |
| -------- | ------------------------------------------------------------------------------------ |
| Overview | owner/repo header, description, topics, social action buttons, README preview, stats |
| Files    | directory tree, file viewer (syntax-highlighted)                                     |
| Issues   | issue list with state filters                                                        |
| PRs      | pull request list with status filters                                                |

## Design System Primitives

Build these reusable components during this phase:

- **RepoCard** — compact repo summary for lists
- **UserCard** — avatar + handle + bio snippet
- **ActivityCard** — icon + actor + verb + target + timestamp
- **FileTreeItem** — icon (file/dir) + name + last commit message
- **EmptyState** — icon + message + optional action button
- **ErrorBoundary** — catch + retry UI
- **SkeletonLoader** — content placeholder shimmer for each card type
- **MarkdownRenderer** — render README content (Phase 2 will wire to real data)

## Mock Data

Create `src/mocks/` with factory functions returning typed domain models. All Phase 1 screens render from these factories. Mock data must be realistic — use real-looking handles (`alice.tngl.sh`), repo names, and timestamps.

## Performance Targets

- Shell first-paint under 2s on mid-range device
- Tab switches feel instant (no layout shift)
- Skeleton loaders shown within 100ms of navigation
