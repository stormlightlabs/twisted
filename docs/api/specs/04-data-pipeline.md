---
title: "Spec 04 — Data Pipeline"
updated: 2026-03-22
---

Covers the full data path: Tap event ingestion, record normalization, and failure handling.

## 1. Tap Event Format

### Record Events

```json
{
    "id": 12345,
    "type": "record",
    "record": {
        "live": true,
        "rev": "3kb3fge5lm32x",
        "did": "did:plc:abc123",
        "collection": "sh.tangled.repo",
        "rkey": "3kb3fge5lm32x",
        "action": "create",
        "cid": "bafyreig...",
        "record": {
            "$type": "sh.tangled.repo",
            "name": "my-project",
            "knot": "knot.tangled.org",
            "description": "A cool project",
            "topics": ["go", "search"],
            "createdAt": "2026-03-22T12:00:00.000Z"
        }
    }
}
```

Key fields:

- `id` — monotonic event ID, used as cursor
- `type` — `"record"` or `"identity"`
- `record.live` — `true` for real-time events, `false` for backfill
- `record.action` — `"create"`, `"update"`, or `"delete"`
- `record.did` — author DID
- `record.collection` — ATProto collection NSID
- `record.rkey` — record key
- `record.cid` — content identifier
- `record.record` — the full ATProto record payload (absent on delete)

### Identity Events

```json
{
    "id": 12346,
    "type": "identity",
    "identity": {
        "did": "did:plc:abc123",
        "handle": "alice.tangled.org",
        "isActive": true,
        "status": "active"
    }
}
```

Identity events are always delivered for tracked repos, regardless of collection filters.

## 2. WebSocket Protocol

### Connection

Connect to `wss://<tap-host>/channel` (or `ws://` for local dev).

If `TAP_ADMIN_PASSWORD` is set, authenticate with HTTP Basic auth (`admin:<password>`).

### Acknowledgment Protocol

Default mode requires the client to ack each event by sending the event `id` back over the WebSocket. Events are retried after `TAP_RETRY_TIMEOUT` (default 60s) if unacked.

For simpler development, set `TAP_DISABLE_ACKS=true` on Tap for fire-and-forget delivery.

### Ordering Guarantees

Events are ordered **per-repo** (per-DID), not globally:

- **Historical events** (`live: false`) may be sent concurrently within a repo
- **Live events** (`live: true`) are synchronization barriers — all prior events for that repo must complete before a live event is sent
- No ordering guarantee across different repos

Example sequence for one repo: `H1, H2, L1, H3, H4, L2`

- H1 and H2 sent concurrently
- Wait for completion, send L1 alone
- Wait for L1, send H3 and H4 concurrently
- Wait for completion, send L2 alone

### Delivery Guarantee

Events are delivered **at least once**. Duplicates may occur on crashes or ack timeouts. The indexer must handle idempotent upserts.

## 3. Ingestion Contract

For each event, the indexer:

1. Validates `type` is `"record"` (identity events are handled separately)
2. Checks `record.collection` against the allowlist
3. Maps `record.action` to an operation:
    - `create` → upsert document
    - `update` → upsert document
    - `delete` → tombstone document (`deleted_at = now`)
4. Decodes `record.record` into the collection-specific struct
5. Normalizes to internal `Document`
6. Upserts into the documents table
7. Schedules embedding job if eligible
8. Persists cursor (`event.id`) **only after successful DB commit**

### Cursor Persistence Rules

- If DB commit fails → cursor does not advance → event will be retried
- If normalization fails → log error, optionally dead-letter, skip → cursor advances
- If embedding scheduling fails → document remains keyword-searchable → cursor advances

## 4. Backfill Behavior

When a repo is added to Tap (via `/repos/add`, signal collection, or full network mode):

1. Tap fetches full repo history from PDS via `com.atproto.sync.getRepo`
2. Firehose events for that repo are buffered during backfill
3. Historical events (`live: false`) are delivered first
4. After backfill completes, buffered live events drain
5. New firehose events stream normally (`live: true`)

### Application-Level Backfill Support

The indexer also supports:

- Full reindex from existing corpus (re-normalize all stored documents)
- Targeted reindex by collection
- Targeted reindex by DID

These do not involve Tap — they re-process documents already in the database.

## 5. Normalization

Normalization converts heterogeneous `sh.tangled.*` records into the common `Document` shape defined in [03-data-model.md](03-data-model.md).

### Adapter Interface

Each indexed collection provides an adapter:

```go
type RecordAdapter interface {
    Collection() string
    RecordType() string
    Normalize(event TapRecordEvent) (*Document, error)
    Searchable(record map[string]any) bool
}
```

### Per-Collection Normalization

#### sh.tangled.repo → `repo`

| Document Field | Source                           |
| -------------- | -------------------------------- |
| `title`        | `record.name`                    |
| `body`         | `record.description`             |
| `summary`      | `record.description` (truncated) |
| `repo_name`    | `record.name`                    |
| `repo_did`     | `event.did`                      |
| `tags_json`    | `json(record.topics)`            |
| `created_at`   | `record.createdAt`               |

**Searchable:** Always (unless empty name).

#### sh.tangled.repo.issue → `issue`

| Document Field | Source                                      |
| -------------- | ------------------------------------------- |
| `title`        | `record.title`                              |
| `body`         | `record.body`                               |
| `summary`      | First ~200 chars of `record.body`           |
| `repo_did`     | Extracted from `record.repo` AT-URI         |
| `repo_name`    | Resolved from repo AT-URI                   |
| `tags_json`    | `[]` (labels resolved separately if needed) |
| `created_at`   | `record.createdAt`                          |

**Searchable:** Always.

#### sh.tangled.repo.pull → `pull`

| Document Field | Source                                     |
| -------------- | ------------------------------------------ |
| `title`        | `record.title`                             |
| `body`         | `record.body`                              |
| `summary`      | First ~200 chars of `record.body`          |
| `repo_did`     | Extracted from `record.target.repo` AT-URI |
| `repo_name`    | Resolved from target repo AT-URI           |
| `tags_json`    | `[]`                                       |
| `created_at`   | `record.createdAt`                         |

**Searchable:** Always.

#### sh.tangled.string → `string`

| Document Field | Source               |
| -------------- | -------------------- |
| `title`        | `record.filename`    |
| `body`         | `record.contents`    |
| `summary`      | `record.description` |
| `repo_name`    | —                    |
| `repo_did`     | —                    |
| `tags_json`    | `[]`                 |
| `created_at`   | `record.createdAt`   |

**Searchable:** Always (content is required).

#### sh.tangled.actor.profile → `profile`

| Document Field | Source                                               |
| -------------- | ---------------------------------------------------- |
| `title`        | Author handle (resolved from DID)                    |
| `body`         | `record.description`                                 |
| `summary`      | `record.description` (truncated) + `record.location` |
| `repo_name`    | —                                                    |
| `repo_did`     | —                                                    |
| `tags_json`    | `[]`                                                 |
| `created_at`   | — (profiles don't have createdAt)                    |

**Searchable:** If `description` is non-empty.

#### sh.tangled.repo.issue.comment → `issue_comment`

| Document Field | Source                                    |
| -------------- | ----------------------------------------- |
| `title`        | — (derived: "Comment on {issue title}")   |
| `body`         | `record.body`                             |
| `summary`      | First ~200 chars of `record.body`         |
| `repo_did`     | Resolved from `record.issue` AT-URI chain |
| `repo_name`    | Resolved                                  |
| `created_at`   | `record.createdAt`                        |

**Searchable:** If body is non-empty.

#### sh.tangled.repo.pull.comment → `pull_comment`

Same pattern as issue comments, using `record.pull` instead of `record.issue`.

### State Event Handling

State and status records (`sh.tangled.repo.issue.state`, `sh.tangled.repo.pull.status`) do **not** produce new search documents. Instead, they update the `record_state` cache table (see [03-data-model.md](03-data-model.md)).

### Interaction Event Handling

Stars (`sh.tangled.feed.star`) and reactions (`sh.tangled.feed.reaction`) do not produce search documents. They may be aggregated for ranking signals in later phases.

### Embedding Input Text

For documents eligible for embedding, compose the input as:

```sh
{title}\n{repo_name}\n{author_handle}\n{tags}\n{summary}\n{body}
```

Fields are joined with newlines. Empty fields are omitted.

### Repo Name Resolution

Issues, PRs, and comments reference their parent repo via AT-URI (e.g., `at://did:plc:abc/sh.tangled.repo/tid`). Resolving the repo name requires either:

1. Looking up the repo document in the local `documents` table
2. Caching repo metadata in a lightweight lookup table

Option 1 is preferred for v1. If the repo document hasn't been indexed yet, `repo_name` is left empty and backfilled on the next reindex pass.

## 6. Identity Event Handling

Identity events should be used to maintain an author handle cache:

```sh
did → handle mapping
```

When an identity event arrives with a new handle, update `author_handle` on all documents with that DID. This ensures search by handle returns current results.

## 7. Repo Management

To add repos for tracking, POST to Tap's `/repos/add` endpoint:

```bash
curl -u admin:PASSWORD -X POST https://tap-host/repos/add \
  -H "Content-Type: application/json" \
  -d '{"dids": ["did:plc:abc123", "did:plc:def456"]}'
```

Alternatively, use `TAP_SIGNAL_COLLECTION=sh.tangled.repo` to auto-track any repo that has Tangled repo records.

## 8. Failure Handling

### Ingestion Failures

If Tap event processing fails before DB commit:

- Log the failure with event ID, DID, collection, rkey, and error class
- Retry with exponential backoff (for transient errors like DB timeouts)
- Do **not** advance cursor — the event will be re-delivered by Tap
- After max retries for a persistent error, log and skip (cursor advances)

### Normalization Failures

If a record cannot be normalized:

- Log collection, DID, rkey, CID, and error class
- Do not crash the process
- Skip the event and advance cursor
- Optionally insert into a `dead_letter` table for manual inspection

### Embedding Failures

If embedding generation fails:

- The document remains keyword-searchable
- The embedding job is marked `failed` with `last_error` and incremented `attempts`
- Jobs are retried with exponential backoff up to a max attempt count
- After max attempts, the job enters `dead` state
- The embed-worker exposes failed job count as a metric

### DB Failures

If Turso/libSQL is unreachable:

- **API** returns `503` for search endpoints; `/healthz` still returns 200 (liveness), `/readyz` returns 503
- **Indexer** pauses event processing and retries DB connection with backoff; cursor does not advance
- **Embed-worker** pauses job processing and retries

### Tap Connection Failures

If the WebSocket connection to Tap drops:

- Reconnect with exponential backoff
- Resume from the last persisted cursor
- Log reconnection attempts and success

Tap itself handles firehose reconnection independently — a Tap restart does not require indexer intervention beyond reconnecting the WebSocket.

### Duplicate Event Handling

Tap delivers events **at least once**. Duplicates are handled by:

- Using `id = did|collection|rkey` as the primary key
- All writes are upserts (`INSERT OR REPLACE` / `ON CONFLICT ... DO UPDATE`)
- CID comparison can detect true no-ops (same content) vs. actual updates

### Startup Recovery

On indexer startup:

1. Read `cursor` from `sync_state` table
2. Connect to Tap WebSocket
3. Tap replays events from the stored cursor position
4. Processing resumes normally

If no cursor exists (first run), Tap delivers all historical events from backfill.
