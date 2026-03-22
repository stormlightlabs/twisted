# Phase 1 Tasks — Project Shell & Design System

## Scaffold

- [x] Create Ionic Vue project with TypeScript (`ionic start twisted tabs --type vue`)
- [x] Configure Capacitor for iOS and Android
- [x] Set up path aliases (`@/` → `src/`)
- [x] Install and configure Pinia
- [x] Install and configure TanStack Query for Vue
- [x] Create the directory structure per spec (`app/`, `core/`, `services/`, `domain/`, `features/`, `components/`)

## Routing & Navigation

- [x] Define five-tab layout: Home, Explore, Activity, Profile (visible tabs) + Repo (pushed route)
- [x] Configure Vue Router with Ionic tab routing
- [x] Add route definitions for all Phase 1 placeholder pages
- [ ] Verify tab-to-tab navigation preserves scroll position and component state

## Domain Models

- [x] Create `domain/models/user.ts` — `UserSummary` type
- [x] Create `domain/models/repo.ts` — `RepoSummary`, `RepoDetail`, `RepoFile` types
- [x] Create `domain/models/pull-request.ts` — `PullRequestSummary` type
- [x] Create `domain/models/issue.ts` — `IssueSummary` type
- [x] Create `domain/models/activity.ts` — `ActivityItem` type

## Mock Data

- [x] Use realistic data: fetch `desertthunder.dev` to create mock data for repo names, timestamps within last 30 days
- [x] Create `src/mocks/users.ts` — factory for `UserSummary` instances
- [x] Create `src/mocks/repos.ts` — factory for `RepoSummary` and `RepoDetail` instances
- [x] Create `src/mocks/pull-requests.ts` — factory for `PullRequestSummary` instances
- [x] Create `src/mocks/issues.ts` — factory for `IssueSummary` instances
- [x] Create `src/mocks/activity.ts` — factory for `ActivityItem` instances

## Design System Components

- [x] `components/common/RepoCard.vue` — compact repo summary (name, owner, description, language, stars)
- [x] `components/common/UserCard.vue` — avatar + handle + bio snippet
- [x] `components/common/ActivityCard.vue` — icon + actor + verb + target + relative timestamp
- [x] `components/common/EmptyState.vue` — icon + message + optional action button
- [x] `components/common/ErrorBoundary.vue` — catch errors, show retry UI
- [x] `components/common/SkeletonLoader.vue` — shimmer placeholders (variants: card, list-item, profile)
- [x] `components/repo/FileTreeItem.vue` — file/dir icon + name
- [x] `components/repo/MarkdownRenderer.vue` — render markdown to HTML (stub with basic styling)

## Feature Pages (placeholder with mock data)

- [x] `features/home/HomePage.vue` — trending repos list, recent activity list
- [x] `features/explore/ExplorePage.vue` — search bar (non-functional), repo/user tabs, repo list
- [x] `features/repo/RepoDetailPage.vue` — segmented layout: Overview, Files, Issues, PRs
- [x] `features/repo/RepoOverview.vue` — header, description, README placeholder, stats
- [x] `features/repo/RepoFiles.vue` — file tree list from mock data
- [x] `features/repo/RepoIssues.vue` — issue list from mock data
- [x] `features/repo/RepoPRs.vue` — PR list from mock data
- [x] `features/activity/ActivityPage.vue` — filter chips + activity card list
- [x] `features/profile/ProfilePage.vue` — sign-in prompt (unauthenticated state)

## Quality

- [ ] Verify all pages render with skeleton loaders before mock data appears
- [ ] Verify tab switches don't cause layout shift
- [ ] Run Lighthouse on the web build — target first-paint under 2s
- [ ] Verify iOS and Android builds compile and launch via Capacitor
