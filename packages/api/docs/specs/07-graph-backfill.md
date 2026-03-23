---
title: "Spec 07 — Graph Backfill"
updated: 2026-03-22
---

## 1. Purpose

Bootstrap the search index with existing Tangled content by discovering users from a seed set and triggering Tap backfill for their repositories. Without this, the index only captures new events after deployment.

## 2. Seed Set

A manually curated list of known Tangled users (DIDs or handles), stored in a plain text file:

```text
# Known active Tangled users
did:plc:abc123
did:plc:def456
alice.tangled.sh
bob.tangled.sh
# Add more as discovered
```

Format:
- One entry per line
- Lines starting with `#` are comments
- Blank lines are ignored
- Entries can be DIDs (`did:plc:...`) or handles (`alice.tangled.sh`)
- Handles are resolved to DIDs before processing

## 3. Fan-Out Strategy

From each seed user, discover connected users to expand the crawl set:

### Discovery Sources

1. **Follows**: Fetch `sh.tangled.graph.follow` records for the user → extract `subject` DIDs
2. **Collaborators**: For repos owned by the user, identify other users who have created issues, PRs, or comments → extract their DIDs

### Depth Limit

Fan-out is configurable with a max hops parameter (default: 2):

- **Hop 0**: Seed users themselves
- **Hop 1**: Direct follows and collaborators of seed users
- **Hop 2**: Follows and collaborators of hop-1 users

Higher hop counts discover more users but increase time and may pull in loosely related accounts. Start with 2 hops and adjust based on the size of the Tangled network.

### Crawl Queue

Discovered DIDs are added to a queue, deduplicated by DID. Each entry tracks:
- DID
- Discovery hop (distance from seed)
- Source (which seed/user led to discovery)

## 4. Backfill Mechanism

For each discovered user:

1. **Check if already tracked**: Query Tap's `/info/:did` endpoint — if the repo is already tracked and backfilled, skip
2. **Register with Tap**: POST to `/repos/add` with the DID — Tap handles the actual repo export and event delivery
3. **Tap backfill flow**: Tap fetches full repo history from PDS via `com.atproto.sync.getRepo`, then delivers historical events (`live: false`) through the normal WebSocket channel
4. **Indexer processes normally**: The indexer's existing ingestion loop handles backfill events the same as live events — no special backfill code path needed

### Rate Limiting

- Batch `/repos/add` calls (e.g., 10 DIDs per request)
- Add configurable delay between batches to avoid overwhelming Tap
- Respect Tap's processing capacity — monitor `/stats/repo-count` to track progress

## 5. Deduplication

- **User-level**: Maintain a visited set of DIDs during fan-out; skip already-seen DIDs
- **Tap-level**: Tap's `/repos/add` is idempotent — adding an already-tracked DID is a no-op
- **Record-level**: The indexer's upsert logic (keyed on `did|collection|rkey`) handles duplicate events naturally

## 6. CLI Interface

```bash
# Basic backfill from seed file
twister backfill --seeds seeds.txt

# Limit fan-out depth
twister backfill --seeds seeds.txt --max-hops 1

# Preview discovered users without triggering backfill
twister backfill --seeds seeds.txt --dry-run

# Control parallelism
twister backfill --seeds seeds.txt --concurrency 5
```

### Flags

| Flag | Default | Description |
|------|---------|-------------|
| `--seeds` | required | Path to seed file |
| `--max-hops` | `2` | Max fan-out depth from seed users |
| `--dry-run` | `false` | List discovered users without submitting to Tap |
| `--concurrency` | `5` | Parallel discovery workers |
| `--batch-size` | `10` | DIDs per `/repos/add` call |
| `--batch-delay` | `1s` | Delay between batches |

### Output

Progress is logged to stdout:

```text
[hop 0] Processing 5 seed users...
[hop 0] did:plc:abc123 → 12 follows, 3 collaborators
[hop 0] did:plc:def456 → 8 follows, 1 collaborator
[hop 1] Processing 24 discovered users (18 new)...
...
[done] Discovered 142 unique users across 2 hops
[done] Submitted 98 new DIDs to Tap (44 already tracked)
```

## 7. Idempotency

The entire backfill process is safe to re-run:

- Seed file parsing is stateless
- Fan-out discovery is deterministic for a given network state
- Tap's `/repos/add` is idempotent
- The indexer's upsert logic handles re-delivered events
- No local state is persisted between runs (the crawl queue is in-memory)

## 8. Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `TAP_URL` | (existing) | Tap base URL for API calls |
| `TAP_AUTH_PASSWORD` | (existing) | Tap admin auth |
| `TURSO_DATABASE_URL` | (existing) | For checking existing records |
| `TURSO_AUTH_TOKEN` | (existing) | DB auth |

No new environment variables are needed — backfill reuses existing Tap and DB configuration.
