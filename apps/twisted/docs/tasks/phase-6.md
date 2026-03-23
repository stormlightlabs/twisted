# Phase 6 Tasks — Write Features & Backend Adapter

## Backend (BFF) Setup

- [ ] Choose runtime (Node/Deno/Bun) and framework (Hono/Fastify/Express)
- [ ] Scaffold BFF project with TypeScript
- [ ] Implement health check endpoint
- [ ] Deploy to hosting (Fly.io, Railway, etc.)
- [ ] Configure CORS for the mobile app's origins

## Backend — Auth Proxy

- [ ] Implement OAuth token exchange endpoint (if moving auth server-side)
- [ ] Implement session endpoint that returns user info
- [ ] Decide: keep client-side OAuth or migrate to BFF-mediated auth

## Backend — Search

- [ ] Implement search indexer: subscribe to Jetstream, index `sh.tangled.repo` and `sh.tangled.actor.profile` records
- [ ] Implement `GET /search/repos?q=` endpoint
- [ ] Implement `GET /search/users?q=` endpoint
- [ ] Wire mobile client's search service to BFF endpoints

## Backend — Personalized Feed

- [ ] Implement `GET /feed/personalized` — aggregate activity for the user's follows and stars
- [ ] Index relevant events from Jetstream
- [ ] Wire mobile client's feed to BFF endpoint when authenticated

## Create Issue

- [ ] Create `features/repo/CreateIssuePage.vue` — title + body (markdown) form
- [ ] Implement `createIssue()` mutation in `services/tangled/mutations.ts`
- [ ] Create `sh.tangled.repo.issue` record on user's PDS
- [ ] Optimistic update: add issue to local list
- [ ] Navigate to new issue detail on success

## Comment on Issue

- [ ] Add comment input to issue detail view
- [ ] Implement `createIssueComment()` mutation
- [ ] Create `sh.tangled.repo.issue.comment` record with `replyTo` support for threading
- [ ] Optimistic update: append comment to list

## Comment on PR

- [ ] Add comment input to PR detail view
- [ ] Implement `createPRComment()` mutation
- [ ] Create `sh.tangled.repo.pull.comment` record

## Issue State Management

- [ ] Add close/reopen button to issue detail (author and repo owner only)
- [ ] Implement `closeIssue()` / `reopenIssue()` — create `sh.tangled.repo.issue.state` record
- [ ] Optimistic update: toggle state badge

## Edit Profile

- [ ] Create `features/profile/EditProfilePage.vue`
- [ ] Implement avatar upload (max 1MB, png/jpeg) via blob upload + record update
- [ ] Implement bio edit (max 256 graphemes)
- [ ] Implement links edit (max 5 URIs)
- [ ] Implement location, pronouns, pinned repos, stats selection, bluesky toggle
- [ ] Update `sh.tangled.actor.profile` record (key: `self`)

## Scope Upgrade

- [ ] Detect when user's session lacks scopes needed for write operations
- [ ] Prompt user to re-authorize with expanded scopes
- [ ] Handle scope upgrade flow gracefully (no data loss)

## Push Notifications (if BFF exists)

- [ ] Implement `POST /notifications/register` on BFF — register device token
- [ ] Configure Capacitor Push Notifications plugin
- [ ] Register device token on login
- [ ] BFF: subscribe to Jetstream events relevant to user, deliver via APNs/FCM
- [ ] Handle notification tap → deep link to relevant content

## Quality

- [ ] Test issue creation end-to-end: create → verify on tangled.org
- [ ] Test commenting on issues and PRs
- [ ] Test profile editing: avatar upload, bio change
- [ ] Test scope upgrade flow
- [ ] Verify mutations work offline-queued (if implemented) or show appropriate offline errors
