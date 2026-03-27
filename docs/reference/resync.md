---
title: Backfill & Resync Playbook
updated: 2026-03-26
---

Twisted has three recovery tools. Choose based on what broke.

| Situation | Recovery path |
| --- | --- |
| Search results wrong but documents exist | `twister reindex` |
| Documents missing because Tap never delivered them | `twister backfill` |
| Documents exist but derived metadata is empty or stale | `twister enrich` |
| Full database loss or migration to a fresh PostgreSQL instance | backfill, enrich, reindex |

## Commands

### `twister indexer`

Runs the Tap consumer continuously. Persists its cursor in `sync_state`.

### `twister backfill`

Default source is `lightrail`. Use graph mode only for targeted fallback.

```sh
twister backfill --dry-run
twister backfill
twister backfill --source graph --seeds seeds.txt --max-hops 2
```

Safe to rerun. Discovery is deduplicated and Tap registration is treated as
idempotent.

### `twister reindex`

Re-upserts stored documents so PostgreSQL recomputes search state from the
canonical `documents` rows.

```sh
twister reindex
twister reindex --collection sh.tangled.repo
twister reindex --did did:plc:abc123
twister reindex --dry-run
```

### `twister enrich`

Fills missing `author_handle`, `repo_name`, and `web_url`.

```sh
twister enrich
twister enrich --collection sh.tangled.repo.issue
twister enrich --did did:plc:abc123
twister enrich --dry-run
```

## Scenario Playbooks

### Search drift

If search results look stale but the document rows are present:

```sh
twister reindex --dry-run
twister reindex
```

### Missing documents

If a record is fetchable through the API but not searchable:

1. make sure Tap is tracking the DID
2. run targeted `backfill` if needed
3. let `indexer` drain
4. re-run `enrich` if metadata is still incomplete

### Metadata gaps

If `author_handle` or `repo_name` is empty:

```sh
twister enrich --dry-run
twister enrich
twister reindex
```

### Full PostgreSQL rebuild

Use this after restoring to a fresh database or moving to a new PostgreSQL
instance.

1. start `api` once so migrations run
2. start `indexer`
3. run `twister backfill`
4. run `twister enrich`
5. run `twister reindex`
6. verify `/readyz`, `/health`, and smoke checks

This is the default migration path from the old Turso-backed deployment too.

### Tap cursor reset

If the Tap cursor is ahead of the retained event window:

```sql
DELETE FROM sync_state WHERE consumer_name = 'indexer-tap-v1';
```

Then restart the `indexer`.

## Status Checks

With admin routes enabled:

```sh
curl -H "Authorization: Bearer $ADMIN_AUTH_TOKEN" \
  http://localhost:8080/admin/status
```

Watch:

- `tap.cursor`
- `jetstream.cursor`
- `documents`
- `read_through.pending`
- `read_through.processing`
- `read_through.failed`
- `read_through.dead_letter`
