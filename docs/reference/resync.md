---
title: Backfill & Resync Playbook
updated: 2026-03-25
---

Twister's search index has three recovery paths. Choose based on what broke.

| Situation                                             | Recovery path                                |
| ----------------------------------------------------- | -------------------------------------------- |
| FTS index corrupted or drifted from stored documents  | `twister reindex`                            |
| Documents missing — never received via Tap            | `twister backfill` + let the indexer consume |
| Documents missing — received but fields empty/wrong   | `twister enrich`                             |
| Full index loss — DB dropped or migrated              | backfill then reindex then enrich            |
| Tap cursor too far ahead — events skipped after a gap | cursor reset via `sync_state` table          |

---

## Paths Overview

**Tap** is the authoritative ingest and backfill path. Documents reach the index
when the `indexer` consumes events from Tap. Completeness depends on which DIDs
Tap is tracking.

**Read-through indexing** closes gaps on demand: when the API fetches a record
not yet in the index, it enqueues a background job. This supplements Tap but is
not a substitute for it.

**JetStream** feeds only the activity cache (`/activity`). It does not contribute
to the search index.

---

## Commands

### `twister indexer`

Runs the Tap consumer. Must be running continuously for real-time indexing.
Persists cursor to `sync_state` table under consumer name `indexer-tap-v1`.

### `twister backfill`

Discovers users via follow graph from seed DIDs/handles, checks Tap status for
each, and registers untracked repos with Tap `/repos/add`.

```sh
# dry-run first
twister backfill --seeds seeds.txt --max-hops 2 --dry-run

# real run
twister backfill --seeds seeds.txt --max-hops 2 \
  --concurrency 5 --batch-size 10 --batch-delay 1s
```

Safe to re-run. Discovery deduplicates and `repos/add` is idempotent.

### `twister reindex`

Re-upserts stored documents into the FTS table and runs `optimize`. Does not
re-fetch from upstream — only re-processes what is already in the DB.

```sh
twister reindex                            # all documents
twister reindex --collection sh.tangled.repo
twister reindex --did did:plc:abc123
twister reindex --dry-run                  # preview without writing
```

Run this when: FTS results are stale after a schema migration, after a bulk
document import, or whenever search quality seems inconsistent with stored data.

### `twister enrich`

Resolves missing `author_handle`, `repo_name`, and `web_url` via XRPC for
documents already in the DB.

```sh
twister enrich                             # all documents
twister enrich --collection sh.tangled.repo.issue
twister enrich --did did:plc:abc123
twister enrich --dry-run
```

Run this when: search results show documents with empty author handles, or
after deploying enrichment logic changes.

---

## Scenario Playbooks

### FTS index out of sync

Documents exist in the DB but search returns wrong/stale results.

```sh
twister reindex --dry-run   # confirm scope
twister reindex             # re-upsert + FTS optimize
```

Verify with `GET /search?q=<known-term>`.

### Documents missing from search

Fetch a known record directly. If it returns from `/actors/{handle}/repos/{repo}`
but does not appear in `/search`, the document was never indexed.

1. Check if the DID is tracked by Tap. If not, run `backfill`:

   ```sh
   twister backfill --seeds <handle-or-did> --max-hops 0
   ```

2. Once Tap is tracking the DID, the `indexer` will deliver historical events.
   Monitor progress via `GET /admin/status` (requires `ENABLE_ADMIN_ENDPOINTS=true`).

3. If you need the record indexed immediately, fetch it through the API — the
   read-through indexer will enqueue it automatically.

### Enrichment gaps

Documents appear in search but `author_handle` or `repo_name` is empty.

```sh
twister enrich --dry-run   # preview what would be resolved
twister enrich             # apply
twister reindex            # re-sync FTS after field updates
```

### Full index recovery

Use this sequence after a DB drop, migration to a new Turso database, or other
full-loss event.

1. Confirm migrations ran: `twister api --local` performs `store.Migrate` on startup.
2. Register repos with Tap:

   ```sh
   twister backfill --seeds seeds.txt --max-hops 2 --dry-run
   twister backfill --seeds seeds.txt --max-hops 2
   ```

3. Start the indexer and let it consume: `twister indexer`
4. Once backfill is complete, enrich fields and re-sync FTS:

   ```sh
   twister enrich
   twister reindex
   ```

5. Verify: `GET /admin/status` for cursor progress, `GET /readyz` for DB health.

### Tap cursor reset

If the indexer cursor is ahead of what Tap will deliver (e.g., after a Tap
instance reset), events will be skipped until the cursor catches up.

To reset the cursor and reprocess from the beginning of Tap's retention window:

```sql
DELETE FROM sync_state WHERE consumer_name = 'indexer-tap-v1';
```

Then restart the `indexer`. It will start from the head of the stream and
process all events Tap delivers.

> **Note:** This does not cause duplicate documents — `UpsertDocument` is
> idempotent. It may reprocess a large backlog depending on Tap retention.

---

## Checking Status

With `ENABLE_ADMIN_ENDPOINTS=true`:

```sh
curl -H "Authorization: Bearer $ADMIN_AUTH_TOKEN" \
  http://localhost:8080/admin/status
```

Response includes:

- `tap.cursor` — last Tap event ID processed by the indexer
- `tap.updated_at` — when the cursor was last advanced
- `jetstream.cursor` — JetStream timestamp cursor (activity cache only)
- `documents` — total searchable document count
- `pending_jobs` — read-through indexing jobs not yet processed
