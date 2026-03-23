# Phase 6 — Write Features & Project Services

## Goal

Add authenticated write operations (create issues, comment on PRs/issues, edit profile) and extend the Twister project services only where the client should not or cannot do the work directly.

## Why Project Services

Some operations are awkward or unsafe from a browser client:

- **Token hardening**: DPoP keys in browser storage are less secure than server-held credentials
- **Unstable procedures**: Tangled's API may change — a backend adapter isolates the mobile client from churn
- **Push notifications**: require server-side registration and delivery
- **Personalized feeds**: server-side aggregation is more efficient than client-side filtering
- **Graph gaps**: follower lists/counts and other cross-network summaries may require index-backed derivation
- **Rate limiting**: backend can batch and deduplicate requests

### Service Scope

Thin service layer — not a replacement for Tangled's public APIs. Use it for cross-network aggregation, search, notifications, and operations the SPA should not own.

| Endpoint                             | Purpose                                             |
| ------------------------------------ | --------------------------------------------------- |
| `POST /auth/session`                 | OAuth token exchange and session management         |
| `GET /feed/personalized`             | Pre-filtered activity feed for the user             |
| `GET /search`, `GET /profiles/:did/summary` | Search and index-backed graph/profile summaries |
| `POST /notifications/register`       | Push notification device registration               |
| Passthrough for stable XRPC calls    | Avoid duplicating what the client already does well |

## Write Features

### Create Issue

- Screen: issue creation form within repo detail
- Fields: title (required), body (markdown), mentions
- Creates `sh.tangled.repo.issue` record on user's PDS
- Optimistic: add to local issue list, remove on failure

### Comment on Issue / PR

- Screen: comment input at bottom of issue/PR detail
- Creates `sh.tangled.repo.issue.comment` or `sh.tangled.repo.pull.comment` record
- Supports `replyTo` for threaded issue comments
- Supports `mentions` (DID array) and `references` (AT-URI array)

### Edit Profile

- Screen: profile edit form
- Updates `sh.tangled.actor.profile` record (key: `self`)
- Fields: avatar (image upload, max 1MB, png/jpeg), bio (max 256 graphemes), links (max 5 URIs), location (max 40 graphemes), pronouns (max 40 chars), pinned repos (max 6 AT-URIs), display stats (max 2 from: merged-pr-count, closed-pr-count, open-pr-count, open-issue-count, closed-issue-count, repo-count, star-count), bluesky cross-posting toggle

### Issue State Management

- Close/reopen issues by creating `sh.tangled.repo.issue.state` records
- State values: `sh.tangled.repo.issue.state.open`, `sh.tangled.repo.issue.state.closed`

## Push Notifications

- Register device token with project services
- Project services subscribe to Jetstream or indexed events relevant to the user
- Deliver via APNs (iOS) / FCM (Android)
- Notification types: PR activity on your repos, issue comments, new followers, stars

## Expanded OAuth Scopes

Phase 6 requires additional scopes beyond Phase 4:

```sh
repo:sh.tangled.repo.issue
repo:sh.tangled.repo.issue.comment
repo:sh.tangled.repo.issue.state
repo:sh.tangled.repo.pull.comment
```

Handle scope upgrades gracefully — re-authorize if the user's existing session lacks required scopes.
