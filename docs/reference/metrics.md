# Metrics To Watch

Use this after deploying the Lightrail-backed backfill flow and detail-only
read-through changes.

## Goal

Confirm that:

- the API stops creating broad read-through churn during browse traffic
- the indexer still keeps search current through Tap
- bootstrap backfills become cheaper and more predictable

## Railway

Watch both `api` and `indexer` for 24 to 48 hours after deploy.

### API service

Expected direction:

- lower average CPU
- fewer latency spikes on browse-heavy endpoints
- lower memory churn from fewer queued background jobs

Useful checks:

- CPU usage before and after deploy
- memory usage before and after deploy
- request latency for browse-heavy periods
- restart count

If this change is helping, the API should look flatter under normal browsing,
especially when clients hit repo lists, issue lists, pull lists, or follows.

### Indexer service

Expected direction:

- similar steady-state load during normal Tap ingest
- shorter, more deliberate spikes only when `twister backfill` is run

Useful checks:

- CPU during normal operation
- CPU during `twister backfill --source lightrail`
- memory during backfill
- restart count

The indexer may still spike during an initial bootstrap. That is expected. The
important change is that the API should stop causing constant incidental work.

## Turso

This is where the clearest savings should show up.

Expected direction:

- fewer write operations
- fewer row updates in indexing job tables
- lower write amplification from browse traffic

Useful checks:

- total row writes
- total queries
- write-heavy windows during normal app usage
- latency on write statements if you have it

The main reduction should come from no longer enqueueing whole list responses
into `indexing_jobs` during browse requests.

## Twister Admin Signals

If admin endpoints are enabled, compare these before and after deploy:

- `read_through.pending`
- `read_through.processing`
- `read_through.failed`
- `read_through.dead_letter`
- `read_through.last_processed_at`

Healthy post-change behavior:

- pending stays near zero most of the time
- processing only bumps when detail pages fetch missing records
- failed and dead-letter counts grow slowly, not continuously

Relevant endpoint:

```sh
curl -H "Authorization: Bearer $ADMIN_AUTH_TOKEN" http://<api-host>/admin/status
```

## What To Compare

Use the same day-of-week and similar traffic windows if possible.

Good comparisons:

- 24 hours before deploy vs 24 hours after deploy
- one browse-heavy period before vs after
- one bootstrap backfill run before vs after

## Success Signals

Treat the rollout as successful if most of these are true:

- API CPU is lower or less spiky under normal browsing
- Turso writes drop during browse-heavy traffic
- read-through queue counts stay close to zero most of the time
- backfill runs complete with fewer upstream calls and cleaner batching
- search freshness still tracks Tap ingest without visible regressions

## Failure Signals

Investigate if you see any of these:

- search misses rise after deploy
- detail pages repeatedly enqueue the same records
- `read_through.pending` grows and does not drain
- indexer CPU stays elevated long after a bootstrap run
- Turso writes do not drop despite the handler changes

If that happens, inspect Tap coverage first, then spot-check whether operators
ran `twister backfill --source lightrail` for the environment.
