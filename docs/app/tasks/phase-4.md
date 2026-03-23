# Phase 4 Tasks — OAuth & Social Features

## OAuth Setup

- [ ] Install `@atcute/oauth-browser-client`
- [ ] Host OAuth client metadata JSON at a public URL & configure for local dev
- [ ] Create `core/auth/oauth.ts` — call `configureOAuth()` with client metadata URL and redirect URI
- [ ] Create `core/auth/session.ts` — session management: get, list, delete stored sessions
- [ ] Create `core/auth/store.ts` — Pinia auth store with state machine (idle → authenticating → authenticated → error)

## Login Flow

- [ ] Create `features/profile/LoginPage.vue` — handle input field + "Sign in" button
- [ ] Implement handle → DID resolution
- [ ] Implement OAuth redirect initiation
- [ ] Create `/oauth/callback` route to handle redirect back
- [ ] Implement token exchange on callback
- [ ] Store session and update auth store
- [ ] Redirect to Profile tab after successful login
- [ ] Handle auth errors: invalid handle, OAuth denied, network failure

## Session Management

- [ ] Implement session restoration on app launch (call `getSession()` for stored DID)
- [ ] Implement automatic token refresh (handled by `@atcute/oauth-browser-client` internally)
- [ ] Implement logout: clear session, reset auth store, redirect to Home
- [ ] Implement account switcher: `listStoredSessions()`, switch between accounts

## Capacitor Deep Links

- [ ] Configure custom URL scheme for OAuth callback on iOS/Android
- [ ] Add `App.addListener('appUrlOpen')` handler to capture callback
- [ ] Test OAuth flow on iOS simulator and Android emulator

## Auth-Aware XRPC Client

- [ ] Create authenticated XRPC client that uses `session.dpopFetch` for requests
- [ ] Service layer: use authenticated client for mutations, public client for queries
- [ ] Handle 401/expired session: trigger re-auth flow

## Social Actions — Star

- [ ] Create `services/tangled/mutations.ts` — mutation functions
- [ ] Implement `starRepo(repoAtUri)` — creates `sh.tangled.feed.star` record on user's PDS
- [ ] Implement `unstarRepo(rkey)` — deletes star record
- [ ] Add star/unstar button to `RepoDetailPage` overview
- [ ] Optimistic update: toggle star state and count immediately, rollback on error
- [ ] Track user's existing stars to show correct initial state

## Social Actions — Follow

- [ ] Implement `followUser(targetDid)` — creates `sh.tangled.graph.follow` record
- [ ] Implement `unfollowUser(rkey)` — deletes follow record
- [ ] Add follow/unfollow button to profile pages and user cards
- [ ] Optimistic update: toggle follow state immediately
- [ ] Track user's existing follows to show correct initial state

## Social Actions — React

- [ ] Implement `addReaction(subjectUri, reaction)` — creates `sh.tangled.feed.reaction` record
- [ ] Implement `removeReaction(rkey)` — deletes reaction record
- [ ] Add reaction button/picker to PR and issue detail views
- [ ] Show reaction counts grouped by type

## Profile Tab (Authenticated)

- [ ] Wire Profile tab to show current user's profile data
- [ ] Show pinned repos, stats, starred repos, following list
- [ ] Add logout button
- [ ] Add account switcher UI

## Personalized Feed

- [ ] When signed in, filter activity feed to show activity from followed users and starred repos
- [ ] Add "For You" / "Global" toggle on Activity tab
- [ ] If appview provides a personalized endpoint, use it; otherwise filter client-side

## Quality

- [ ] Test full OAuth flow: login → browse → star → follow → logout
- [ ] Test session restoration after app restart
- [ ] Test on web, iOS simulator, Android emulator
- [ ] Test error cases: denied OAuth, expired session, failed mutation
- [ ] Verify optimistic updates roll back correctly on mutation failure
