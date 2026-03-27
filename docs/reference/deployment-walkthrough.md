# Deployment Walkthrough

Twisted now deploys as one VPS Compose stack defined by
`docker-compose.prod.yaml`. Coolify can still host that stack, but the Compose
file is the source of truth.

## Services

- `postgres`: primary database on `pgvector/pgvector:pg17`
- `migrate`: one-shot schema bootstrap via `twister migrate`
- `api`: public HTTP service
- `indexer`: private Tap consumer
- `tap`: private Indigo Tap service
- `llama-embeddings`: private llama.cpp server for future embedding work

## Prerequisites

- one VPS or Coolify host with Docker Compose
- this repo available to the host
- explicit `INDEXED_COLLECTIONS` and `READ_THROUGH_COLLECTIONS`
- one shared `TAP_AUTH_PASSWORD`
- a production `POSTGRES_PASSWORD`

Use explicit search collections. Do not use `sh.tangled.*` in production.

## Environment

Required:

- `POSTGRES_PASSWORD`
- `TAP_AUTH_PASSWORD`
- `INDEXED_COLLECTIONS`

Common overrides:

- `POSTGRES_USER` default `twisted`
- `POSTGRES_DB` default `twisted`
- `LOG_LEVEL=info`
- `LOG_FORMAT=json`
- `READ_THROUGH_MODE=missing`
- `READ_THROUGH_COLLECTIONS=<explicit CSV>`
- `READ_THROUGH_MAX_ATTEMPTS=5`
- `HTTP_BIND_ADDR=:8080`
- `INDEXER_HEALTH_ADDR=:9090`
- `LLAMA_MODEL_REPO=nomic-ai/nomic-embed-text-v1.5-GGUF`
- `LLAMA_MODEL_FILE=nomic-embed-text-v1.5.Q8_0.gguf`

`llama-embeddings` is private and not part of search yet. It only keeps the
model warm and cached for later adapter work.

## Bootstrap

From the repo root:

```sh
just vps-up
```

That sequence:

1. starts PostgreSQL and Tap
2. runs `migrate`
3. starts `api`, `indexer`, and `llama-embeddings`

## Clean Reset

For a fresh VM or full reset:

```sh
just vps-reset
```

This removes named volumes, recreates PostgreSQL, reapplies migrations, and
starts the full stack from zero.

## Coolify Notes

If you run this through Coolify:

1. create one Docker Compose application
2. point it at `/docker-compose.prod.yaml`
3. set the env vars above in Coolify
4. expose only the `api` service through Traefik

Do not add a separate PostgreSQL resource for this stack.

## Checks

- `api`: `GET /readyz` returns `200`
- `indexer`: `GET /health` returns `200`
- `indexer` can reach `ws://tap:2480/channel`
- `llama-embeddings` serves embeddings on its internal port

Then rebuild the serving dataset:

```sh
docker compose -f docker-compose.prod.yaml exec indexer twister backfill
docker compose -f docker-compose.prod.yaml exec indexer twister enrich
docker compose -f docker-compose.prod.yaml exec indexer twister reindex
```

Do not import old Turso data as the default migration path.

## App Target

For local app builds:

```sh
VITE_TWISTER_API_BASE_URL=https://<your-api-domain>
```

## Rollback

- PostgreSQL restore is the rollback primitive
- keep `--local` only as a temporary development fallback
