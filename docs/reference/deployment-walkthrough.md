# Deployment Walkthrough

Twisted deploys to Coolify as one Compose application with three services:

- `api`: public HTTP service
- `indexer`: private Tap consumer
- `tap`: private Indigo Tap service

PostgreSQL is a separate Coolify-managed resource.

## Files

- production compose: `docker-compose.prod.yaml`
- local dev compose: `docker-compose.dev.yaml`
- app image build: `packages/api/Dockerfile`
- Tap image: `ghcr.io/bluesky-social/indigo/tap:sha-4f47add43060c27e8a37d9d76482ecddf001fcd8`

## Prerequisites

- Coolify access
- one Coolify PostgreSQL resource
- this repo connected to Coolify
- explicit `INDEXED_COLLECTIONS` and `READ_THROUGH_COLLECTIONS`
- one shared Tap admin password

## Provision PostgreSQL

Create the PostgreSQL resource first.

- keep the generated connection string in Coolify secrets as `DATABASE_URL`
- use PostgreSQL backups from the database resource
- point both `api` and `indexer` at the same database

## Create The Coolify App

In Coolify:

1. create a new Application
2. choose the Docker Compose build pack
3. point it at this repo
4. set base directory to `/`
5. set compose file location to `/docker-compose.prod.yaml`

Do not add your own Traefik container. Coolify already provides the proxy.

## Set Environment Variables

Shared:

- `DATABASE_URL`
- `INDEXED_COLLECTIONS`
- `LOG_LEVEL=info`
- `LOG_FORMAT=json`
- `TAP_AUTH_PASSWORD=<required>`

`api`:

- `HTTP_BIND_ADDR=:8080`
- `SEARCH_DEFAULT_LIMIT=20`
- `SEARCH_MAX_LIMIT=100`
- `READ_THROUGH_MODE=missing`
- `READ_THROUGH_COLLECTIONS=<explicit CSV>`
- `READ_THROUGH_MAX_ATTEMPTS=5`
- `ENABLE_ADMIN_ENDPOINTS=false`
- `ADMIN_AUTH_TOKEN=<optional>`
- `OAUTH_CLIENT_ID=<optional>`
- `OAUTH_REDIRECT_URIS=<optional CSV>`

`indexer`:

- `INDEXER_HEALTH_ADDR=:9090`
- `TAP_URL=ws://tap:2480/channel`
- `ENABLE_INGEST_ENRICHMENT=true`

`tap`:

- `TAP_COLLECTION_FILTERS=<optional explicit CSV>`
- optional persistent volume override if you do not want the default `/data`

Use explicit search collections. Do not use `sh.tangled.*` in production.

## Domains And Health Checks

Expose only `api` publicly.

- assign the domain in Coolify to the `api` service
- if `api` stays on `:8080`, include that internal port in the Coolify mapping
- configure readiness checks against `GET /readyz`
- keep `indexer` and `tap` private
- monitor `indexer` with `GET /health`

## First Bootstrap

1. deploy `tap`
2. deploy `api`
3. deploy `indexer`
4. confirm `api` returns `200` from `/readyz`
5. confirm `indexer` returns `200` from `/health`
6. confirm `indexer` can reach `ws://tap:2480/channel`
7. open a Coolify terminal in the `indexer` service and run:

```sh
twister backfill
twister enrich
twister reindex
```

This rebuilds the serving dataset from authoritative sources. Do not import the
old Turso data as the default migration path.

## Point The App At Coolify

For local app builds:

```sh
VITE_TWISTER_API_BASE_URL=https://<your-api-domain>
```

Then run the app normally with `pnpm --dir apps/twisted dev` or `build`.

## Rollback Notes

- keep the SQLite `--local` path only as a temporary development fallback
- rollback production by restoring PostgreSQL and redeploying the prior app
- treat PostgreSQL restore as the database rollback primitive
