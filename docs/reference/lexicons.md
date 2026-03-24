---
title: Tangled Lexicons
updated: 2026-03-24
---

Tangled defines its AT Protocol record types under the `sh.tangled.*` namespace. These are the records stored on users' Personal Data Servers (PDS) and consumed by the indexing pipeline.

## Searchable Records

### sh.tangled.repo

Repository metadata. Created when a user registers a repo with Tangled.

- `name` (string, required) — Repository name
- `description` (string) — Short description
- `createdAt` (datetime) — Creation timestamp
- `knot` (string) — Knot DID hosting the git data
- `topics` (array of strings) — Tags/topics

### sh.tangled.repo.issue

Issue on a repository.

- `repo` (at-uri, required) — Reference to the parent repo record
- `title` (string, required) — Issue title
- `body` (string) — Issue body (markdown)
- `createdAt` (datetime)

### sh.tangled.repo.pull

Pull request on a repository.

- `repo` (at-uri, required) — Reference to the parent repo record
- `title` (string, required) — PR title
- `body` (string) — PR body (markdown)
- `head` (string) — Source branch
- `base` (string) — Target branch
- `createdAt` (datetime)

### sh.tangled.string

Code snippet or gist.

- `filename` (string) — File name with extension
- `contents` (string, required) — Code content
- `language` (string) — Programming language
- `createdAt` (datetime)

### sh.tangled.actor.profile

User profile information.

- `displayName` (string) — Display name
- `description` (string) — Bio/about text
- `avatar` (blob) — Profile image
- `pronouns` (string) — Pronouns
- `location` (string) — Location
- `links` (array of strings) — External links
- `pinnedRepos` (array of at-uri) — Pinned repository references

## Interaction Records

### sh.tangled.feed.star

Star/favorite on a repository.

- `subject` (object, required) — `{ uri: at-uri, cid: cid }` referencing the starred repo

### sh.tangled.graph.follow

Follow relationship between users.

- `subject` (did, required) — DID of the followed user
- `createdAt` (datetime)

### sh.tangled.feed.reaction

Emoji reaction on content.

- `subject` (object, required) — `{ uri: at-uri, cid: cid }` referencing the target
- `emoji` (string, required) — Reaction emoji

## State Records

### sh.tangled.repo.issue.state

Tracks whether an issue is open or closed.

- `issue` (at-uri, required) — Reference to the issue
- `state` (string, required) — `open` or `closed`

### sh.tangled.repo.pull.status

Tracks pull request lifecycle.

- `pull` (at-uri, required) — Reference to the PR
- `status` (string, required) — `open`, `closed`, or `merged`

## Comment Records

### sh.tangled.repo.issue.comment

Comment on an issue.

- `issue` (at-uri, required) — Reference to the parent issue
- `body` (string, required) — Comment body (markdown)
- `parent` (at-uri) — Parent comment for threading
- `createdAt` (datetime)

### sh.tangled.repo.pull.comment

Comment on a pull request.

- `pull` (at-uri, required) — Reference to the parent PR
- `body` (string, required) — Comment body (markdown)
- `parent` (at-uri) — Parent comment for threading
- `createdAt` (datetime)

## Infrastructure Records

### sh.tangled.knot.member

Knot membership record.

- `knot` (did, required) — Knot DID
- `permission` (string) — Permission level

### sh.tangled.knot.version

Knot software version metadata.

## Stable ID Format

Documents in the search index use the stable ID format: `did|collection|rkey` (e.g., `did:plc:abc123|sh.tangled.repo|repo-name`). This ensures idempotent upserts regardless of CID changes.

## AT-URI Format

Records are addressed as `at://did/collection/rkey` (e.g., `at://did:plc:abc123/sh.tangled.repo/repo-name`).
