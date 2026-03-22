# Phase 1 Tasks — Project Shell & Design System

## Scaffold

- [ ] Create Ionic Vue project with TypeScript (`ionic start twisted tabs --type vue`)
- [ ] Configure Capacitor for iOS and Android
- [ ] Set up path aliases (`@/` → `src/`)
- [ ] Install and configure Pinia
- [ ] Install and configure TanStack Query for Vue
- [ ] Create the directory structure per spec (`app/`, `core/`, `services/`, `domain/`, `features/`, `components/`)

## Routing & Navigation

- [ ] Define five-tab layout: Home, Explore, Activity, Profile (visible tabs) + Repo (pushed route)
- [ ] Configure Vue Router with Ionic tab routing
- [ ] Add route definitions for all Phase 1 placeholder pages
- [ ] Verify tab-to-tab navigation preserves scroll position and component state

## Domain Models

- [ ] Create `domain/models/user.ts` — `UserSummary` type
- [ ] Create `domain/models/repo.ts` — `RepoSummary`, `RepoDetail`, `RepoFile` types
- [ ] Create `domain/models/pull-request.ts` — `PullRequestSummary` type
- [ ] Create `domain/models/issue.ts` — `IssueSummary` type
- [ ] Create `domain/models/activity.ts` — `ActivityItem` type

## Mock Data

- [ ] Create `src/mocks/users.ts` — factory for `UserSummary` instances
- [ ] Create `src/mocks/repos.ts` — factory for `RepoSummary` and `RepoDetail` instances
- [ ] Create `src/mocks/pull-requests.ts` — factory for `PullRequestSummary` instances
- [ ] Create `src/mocks/issues.ts` — factory for `IssueSummary` instances
- [ ] Create `src/mocks/activity.ts` — factory for `ActivityItem` instances
- [ ] Use realistic data: handles like `alice.tngl.sh`, repo names, timestamps within last 30 days

## Design System Components

- [ ] `components/common/RepoCard.vue` — compact repo summary (name, owner, description, language, stars)
- [ ] `components/common/UserCard.vue` — avatar + handle + bio snippet
- [ ] `components/common/ActivityCard.vue` — icon + actor + verb + target + relative timestamp
- [ ] `components/common/EmptyState.vue` — icon + message + optional action button
- [ ] `components/common/ErrorBoundary.vue` — catch errors, show retry UI
- [ ] `components/common/SkeletonLoader.vue` — shimmer placeholders (variants: card, list-item, profile)
- [ ] `components/repo/FileTreeItem.vue` — file/dir icon + name
- [ ] `components/repo/MarkdownRenderer.vue` — render markdown to HTML (stub with basic styling)

## Feature Pages (placeholder with mock data)

- [ ] `features/home/HomePage.vue` — trending repos list, recent activity list
- [ ] `features/explore/ExplorePage.vue` — search bar (non-functional), repo/user tabs, repo list
- [ ] `features/repo/RepoDetailPage.vue` — segmented layout: Overview, Files, Issues, PRs
- [ ] `features/repo/RepoOverview.vue` — header, description, README placeholder, stats
- [ ] `features/repo/RepoFiles.vue` — file tree list from mock data
- [ ] `features/repo/RepoIssues.vue` — issue list from mock data
- [ ] `features/repo/RepoPRs.vue` — PR list from mock data
- [ ] `features/activity/ActivityPage.vue` — filter chips + activity card list
- [ ] `features/profile/ProfilePage.vue` — sign-in prompt (unauthenticated state)

## Quality

- [ ] Verify all pages render with skeleton loaders before mock data appears
- [ ] Verify tab switches don't cause layout shift
- [ ] Run Lighthouse on the web build — target first-paint under 2s
- [ ] Verify iOS and Android builds compile and launch via Capacitor
