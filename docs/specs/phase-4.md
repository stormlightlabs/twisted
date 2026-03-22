# Phase 4 — OAuth & Social Features

## Goal

Add AT Protocol OAuth sign-in and authenticated social actions: follow, star, react. Signed-in users get a personalized feed.

## Authentication

### Package

`@atcute/oauth-browser-client` ^3.0.0 — minimal browser OAuth client for AT Protocol.

### OAuth Flow

1. User enters handle or DID
2. Resolve handle → DID → PDS → authorization server metadata
3. Initiate OAuth with PKCE + DPoP (P-256)
4. Redirect to authorization server
5. Callback with auth code
6. Exchange code for access + refresh tokens
7. Store session, bind to XRPC client

### Key Functions

| Function                   | Purpose                                                      |
| -------------------------- | ------------------------------------------------------------ |
| `configureOAuth(opts)`     | One-time setup: client metadata URL, redirect URI            |
| `getSession(did)`          | Resume existing session (returns `Session` with `dpopFetch`) |
| `listStoredSessions()`     | List all stored accounts                                     |
| `deleteStoredSession(did)` | Remove stored session                                        |

### Session Object

A `Session` provides:

- `did` — authenticated user's DID
- `dpopFetch` — a `fetch` wrapper that auto-attaches DPoP + access token headers
- Token refresh is handled internally

### Client Metadata

The mobile app needs its own OAuth client metadata hosted at a public URL:

```json
{
    "client_id": "https://your-app-domain/oauth/client-metadata.json",
    "client_name": "Twisted",
    "client_uri": "https://your-app-domain",
    "redirect_uris": ["https://your-app-domain/oauth/callback"],
    "grant_types": ["authorization_code", "refresh_token"],
    "response_types": ["code"],
    "token_endpoint_auth_method": "none",
    "application_type": "web",
    "dpop_bound_access_tokens": true,
    "scope": "atproto repo:sh.tangled.graph.follow repo:sh.tangled.feed.star repo:sh.tangled.feed.reaction repo:sh.tangled.actor.profile"
}
```

Request only the scopes needed for Phase 4 social features. Expand scopes in later phases as write features are added.

### Capacitor Considerations

- Web: standard redirect flow works
- iOS/Android via Capacitor: use `App.addListener('appUrlOpen')` to capture the OAuth callback via deep link or custom URL scheme
- Session storage: abstract behind `core/storage/` — use `localStorage` on web, Capacitor Secure Storage plugin on native

### Auth State Machine

```sh
idle → authenticating → authenticated
                     → error
authenticated → refreshing → authenticated
                           → expired → idle
authenticated → logging_out → idle
```

Store in Pinia (`core/auth/`). Expose via `useAuth()` composable.

## Social Actions

All social actions create or delete AT Protocol records on the user's PDS via the XRPC `com.atproto.repo.createRecord` / `com.atproto.repo.deleteRecord` procedures. The `dpopFetch` from the session handles auth.

### Star a Repo

Create record:

```json
{
    "repo": "did:plc:user",
    "collection": "sh.tangled.feed.star",
    "record": {
        "$type": "sh.tangled.feed.star",
        "subject": "at://did:plc:owner/sh.tangled.repo/tid",
        "createdAt": "2026-03-22T00:00:00Z"
    }
}
```

Unstar: delete the record by its `rkey`.

### Follow a User

Create record:

```json
{
    "repo": "did:plc:user",
    "collection": "sh.tangled.graph.follow",
    "record": {
        "$type": "sh.tangled.graph.follow",
        "subject": "did:plc:target",
        "createdAt": "2026-03-22T00:00:00Z"
    }
}
```

Unfollow: delete the record by its `rkey`.

### React to Content

Create record:

```json
{
    "repo": "did:plc:user",
    "collection": "sh.tangled.feed.reaction",
    "record": {
        "$type": "sh.tangled.feed.reaction",
        "subject": "at://did:plc:owner/sh.tangled.repo.pull/tid",
        "reaction": "thumbsup",
        "createdAt": "2026-03-22T00:00:00Z"
    }
}
```

Available reactions: `thumbsup`, `thumbsdown`, `laugh`, `tada`, `confused`, `heart`, `rocket`, `eyes`.

### Optimistic Updates

All mutations use TanStack Query's `useMutation` with optimistic updates:

1. Immediately update the cache (star count +1, follow state toggled)
2. Fire the mutation
3. On error, roll back the cache and show a toast

## Personalized Feed

When signed in, the Activity tab shows a filtered feed based on:

- Users the signed-in user follows
- Repos the signed-in user has starred

Implementation depends on what the appview provides. If no personalized endpoint exists, filter the global feed client-side based on the user's follow/star records.

## Profile Tab (Authenticated)

When signed in, the Profile tab shows:

- User's avatar, handle, bio, location, pronouns, links
- Pinned repos
- Stats (selected from: merged PRs, open PRs, open issues, repo count, star count)
- Starred repos list
- Following/followers lists
- Edit profile (avatar, bio, links, pinned repos)
- Settings
- Logout
- Account switcher (multiple account support via `listStoredSessions`)
