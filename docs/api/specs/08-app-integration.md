---
title: "Spec 08 — App Integration"
updated: 2026-03-23
---

## 1. Purpose

Define the mobile-facing Twister API surface.

The Twisted app should keep using Tangled's public knot and PDS APIs for canonical repo/profile detail. Twister is responsible for:

- cross-network discovery via search
- index-backed summaries for data gaps such as followers

## 2. Client Boundary

The mobile client uses Twister only for:

- Explore search
- index-backed profile summaries
- future feed and notification features

The mobile client does not use Twister for:

- repo tree/blob/detail reads
- direct profile record reads
- issue/PR detail reads

Those remain on Tangled's public APIs.

## 3. Search Contract

`GET /search`

Required query parameters:

- `q`

Optional query parameters:

- `mode=keyword|semantic|hybrid`
- `type=repo|profile`
- `limit`
- `offset`

For mobile clients, repo and profile results should include:

- `did`
- `at_uri`
- `record_type`
- `title`
- `summary`
- `repo_name`
- `author_handle`
- `updated_at`
- `primary_language` for repos when known
- `stars` for repos when known
- `follower_count` and `following_count` for profiles when known

## 4. Profile Summary Contract

`GET /profiles/{did}/summary`

Response:

```json
{
  "did": "did:plc:abc123",
  "handle": "desertthunder.dev",
  "follower_count": 128,
  "following_count": 84,
  "indexed_at": "2026-03-23T10:15:00Z"
}
```

This endpoint exists because follower counts and follower lists are derived from indexed graph state, not from a single direct public Tangled API call.

## 5. Failure Handling

If Twister is unavailable:

- the app should keep direct known-handle browsing working
- Explore should show a clear "index unavailable" state
- profile pages should omit index-backed follower counts rather than fail entirely

## 6. Ownership

- Twister owns search ranking, document normalization, and graph summary derivation
- The app owns result presentation, route transitions, and fallback behavior
