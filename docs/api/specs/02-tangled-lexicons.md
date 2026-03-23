---
title: "Spec 02 — Tangled Lexicons"
updated: 2026-03-22
source: https://github.com/mary-ext/atcute/tree/trunk/packages/definitions/tangled/lexicons/sh/tangled
---

All Tangled records use the `sh.tangled.*` namespace. Records use TID keys unless noted otherwise.

## 1. Searchable Record Types

These are the primary records Twister indexes for search.

### sh.tangled.repo

Repository metadata. Key: `tid`.

| Field         | Type     | Required | Description                                    |
| ------------- | -------- | -------- | ---------------------------------------------- |
| `name`        | string   | yes      | Repository name                                |
| `knot`        | string   | yes      | Knot (hosting node) where the repo was created |
| `spindle`     | string   | no       | CI runner for jobs                             |
| `description` | string   | no       | 1–140 graphemes                                |
| `website`     | uri      | no       | Related URI                                    |
| `topics`      | string[] | no       | Up to 50 topic tags, each 1–50 chars           |
| `source`      | uri      | no       | Upstream source                                |
| `labels`      | at-uri[] | no       | Label definitions this repo subscribes to      |
| `createdAt`   | datetime | yes      |                                                |

### sh.tangled.repo.issue

Issue on a repository. Key: `tid`.

| Field        | Type     | Required | Description                      |
| ------------ | -------- | -------- | -------------------------------- |
| `repo`       | at-uri   | yes      | AT-URI of the parent repo record |
| `title`      | string   | yes      | Issue title                      |
| `body`       | string   | no       | Issue body (markdown)            |
| `createdAt`  | datetime | yes      |                                  |
| `mentions`   | did[]    | no       | Mentioned users                  |
| `references` | at-uri[] | no       | Referenced records               |

### sh.tangled.repo.pull

Pull request. Key: `tid`.

| Field        | Type     | Required | Description                                        |
| ------------ | -------- | -------- | -------------------------------------------------- |
| `target`     | object   | yes      | `{repo: at-uri, branch: string}`                   |
| `title`      | string   | yes      | PR title                                           |
| `body`       | string   | no       | PR description (markdown)                          |
| `patchBlob`  | blob     | yes      | Patch content (`text/x-patch`)                     |
| `source`     | object   | no       | `{branch: string, sha: string(40), repo?: at-uri}` |
| `createdAt`  | datetime | yes      |                                                    |
| `mentions`   | did[]    | no       | Mentioned users                                    |
| `references` | at-uri[] | no       | Referenced records                                 |

### sh.tangled.string

Code snippet / gist. Key: `tid`.

| Field         | Type     | Required | Description         |
| ------------- | -------- | -------- | ------------------- |
| `filename`    | string   | yes      | 1–140 graphemes     |
| `description` | string   | yes      | Up to 280 graphemes |
| `createdAt`   | datetime | yes      |                     |
| `contents`    | string   | yes      | Snippet content     |

### sh.tangled.actor.profile

User profile. Key: `literal:self` (singleton per account).

| Field                | Type     | Required | Description                  |
| -------------------- | -------- | -------- | ---------------------------- |
| `avatar`             | blob     | no       | PNG/JPEG, max 1MB            |
| `description`        | string   | no       | Bio, up to 256 graphemes     |
| `links`              | uri[]    | no       | Up to 5 social/website links |
| `stats`              | string[] | no       | Up to 2 vanity stat types    |
| `bluesky`            | boolean  | yes      | Show Bluesky link            |
| `location`           | string   | no       | Up to 40 graphemes           |
| `pinnedRepositories` | at-uri[] | no       | Up to 6 pinned repos         |
| `pronouns`           | string   | no       | Up to 40 chars               |

## 2. Interaction Record Types

These records represent social interactions. They may be indexed for counts/signals but are lower priority for text search.

### sh.tangled.feed.star

Star/favorite on a record. Key: `tid`.

| Field       | Type     | Required |
| ----------- | -------- | -------- |
| `subject`   | at-uri   | yes      |
| `createdAt` | datetime | yes      |

### sh.tangled.feed.reaction

Emoji reaction on a record. Key: `tid`.

| Field       | Type     | Required | Description                     |
| ----------- | -------- | -------- | ------------------------------- |
| `subject`   | at-uri   | yes      |                                 |
| `reaction`  | string   | yes      | One of: 👍 👎 😆 🎉 🫤 ❤️ 🚀 👀 |
| `createdAt` | datetime | yes      |                                 |

### sh.tangled.graph.follow

Follow a user. Key: `tid`.

| Field       | Type     | Required |
| ----------- | -------- | -------- |
| `subject`   | did      | yes      |
| `createdAt` | datetime | yes      |

## 3. State Record Types

These records track mutable state of issues and PRs.

### sh.tangled.repo.issue.state

| Field   | Type   | Required | Description                                                                |
| ------- | ------ | -------- | -------------------------------------------------------------------------- |
| `issue` | at-uri | yes      |                                                                            |
| `state` | string | yes      | `sh.tangled.repo.issue.state.open` or `sh.tangled.repo.issue.state.closed` |

### sh.tangled.repo.pull.status

| Field    | Type   | Required | Description                                                 |
| -------- | ------ | -------- | ----------------------------------------------------------- |
| `pull`   | at-uri | yes      |                                                             |
| `status` | string | yes      | `sh.tangled.repo.pull.status.open`, `.closed`, or `.merged` |

## 4. Comment Record Types

### sh.tangled.repo.issue.comment

| Field        | Type     | Required | Description                    |
| ------------ | -------- | -------- | ------------------------------ |
| `issue`      | at-uri   | yes      | Parent issue                   |
| `body`       | string   | yes      | Comment body                   |
| `createdAt`  | datetime | yes      |                                |
| `replyTo`    | at-uri   | no       | Parent comment (for threading) |
| `mentions`   | did[]    | no       |                                |
| `references` | at-uri[] | no       |                                |

### sh.tangled.repo.pull.comment

| Field        | Type     | Required | Description  |
| ------------ | -------- | -------- | ------------ |
| `pull`       | at-uri   | yes      | Parent PR    |
| `body`       | string   | yes      | Comment body |
| `createdAt`  | datetime | yes      |              |
| `mentions`   | did[]    | no       |              |
| `references` | at-uri[] | no       |              |

## 5. Infrastructure Record Types

These are not indexed for search but may be consumed for operational context.

| Collection                    | Description                                          |
| ----------------------------- | ---------------------------------------------------- |
| `sh.tangled.label.definition` | Label definitions with name, valueType, scope, color |
| `sh.tangled.label.op`         | Label application operations                         |
| `sh.tangled.git.refUpdate`    | Git reference update events                          |
| `sh.tangled.knot.member`      | Knot membership                                      |
| `sh.tangled.spindle.member`   | Spindle (CI runner) membership                       |
| `sh.tangled.pipeline.status`  | CI pipeline status                                   |

## 6. Collection Priority for v1 Indexing

| Priority | Collection                      | Rationale                            |
| -------- | ------------------------------- | ------------------------------------ |
| P0       | `sh.tangled.repo`               | Core searchable content              |
| P0       | `sh.tangled.repo.issue`         | High-signal text content             |
| P0       | `sh.tangled.repo.pull`          | High-signal text content             |
| P1       | `sh.tangled.string`             | Searchable code snippets             |
| P1       | `sh.tangled.actor.profile`      | User/org discovery                   |
| P2       | `sh.tangled.repo.issue.comment` | Body text, high volume               |
| P2       | `sh.tangled.repo.pull.comment`  | Body text, high volume               |
| P2       | `sh.tangled.repo.issue.state`   | State for filtering, not text search |
| P2       | `sh.tangled.repo.pull.status`   | State for filtering, not text search |
| P3       | `sh.tangled.feed.star`          | Ranking signal (star count)          |
| P3       | `sh.tangled.feed.reaction`      | Ranking signal                       |
| P3       | `sh.tangled.graph.follow`       | Ranking signal                       |

### Tap Collection Filter for v1

```sh
TAP_COLLECTION_FILTERS=sh.tangled.repo,sh.tangled.repo.issue,sh.tangled.repo.issue.comment,sh.tangled.repo.issue.state,sh.tangled.repo.pull,sh.tangled.repo.pull.comment,sh.tangled.repo.pull.status,sh.tangled.string,sh.tangled.actor.profile,sh.tangled.feed.star

# or sh.tangled.*
```
