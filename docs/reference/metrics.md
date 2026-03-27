# Metrics To Watch

Use this after rolling out the Coolify + PostgreSQL deployment.

## Goals

Confirm that:

- `api` stays stable under browse-heavy traffic
- `indexer` keeps search current through Tap
- PostgreSQL handles ingest, queue churn, and activity writes without backlog

## Coolify Application

Watch both services for 24 to 48 hours after deploy.

### API

Expected direction:

- lower latency spikes
- stable memory
- flat restart count

Useful checks:

- request latency
- CPU and memory
- `/readyz` failures
- restart count

### Indexer

Expected direction:

- steady-state load during Tap ingest
- bounded spikes during `backfill`, `enrich`, and `reindex`
- `/health` stays green outside deploy windows

Useful checks:

- CPU and memory
- restart count
- Tap reconnect frequency
- queue drain time after backfill

## PostgreSQL

Expected direction:

- predictable connection count
- stable write latency during ingest
- no long-lived lock buildup in `indexing_jobs`
- bounded table growth in `jetstream_events` and `indexing_audit`

Useful checks:

- connections
- disk growth
- slow queries
- write latency
- backup duration and restore confidence

## Admin Signals

If admin routes are enabled, compare:

- `read_through.pending`
- `read_through.processing`
- `read_through.failed`
- `read_through.dead_letter`
- `tap.cursor`
- `jetstream.cursor`

Healthy behavior:

- pending stays near zero most of the time
- processing drains after bursts
- failed and dead-letter stay small and explainable

## Success Signals

- `/readyz` and `/health` remain consistently green
- search freshness tracks Tap ingest
- backfill and enrich jobs complete without manual cleanup
- PostgreSQL latency stays stable during bootstrap and normal use

## Failure Signals

- queue counts rise and do not drain
- `/readyz` flips during normal browse traffic
- search misses rise after cutover
- PostgreSQL write latency climbs during normal ingest
- restores or backups are failing or taking too long
