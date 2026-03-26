# Deployment Walkthrough

This repo maps cleanly to Railway, but only for the backend pieces.

- Deploy `packages/api` to Railway as two services: `api` and `indexer`.
- Keep the Ionic + Capacitor app on your machine or in CI for native builds.
- Point the mobile app at the Railway `api` service with
  `VITE_TWISTER_API_BASE_URL`.

## What Railway Should Host

Railway is a good home for the Go services in this repo:

- `api`: serves HTTP routes, docs, search, proxies, and readiness checks
- `indexer`: consumes Tap, writes into Turso, and exposes its own health endpoint
Railway is not the place that ships the native iOS or Android app. You still
build, sign, and distribute the Capacitor shells separately.

## Prerequisites

Before you start, have these ready:

- a Railway account and the Railway CLI
- a Turso database URL and auth token
- a Tap URL and Tap auth password
- a seed list for the first backfill run
From this machine:

```sh
cd /Users/owais/Projects/Twisted
railway login
```

## Create The Railway Project

In the Railway dashboard, create one empty project with two empty services:

- `api`
- `indexer`
Then link this repo to that project:

```sh
cd /Users/owais/Projects/Twisted
railway link
```

## Configure Service Shape

Both services should deploy from the same local path:

- path: `packages/api`
- build source: `packages/api/Dockerfile`
Set the service start commands in Railway:
- `api`: `twister api`
- `indexer`: `twister indexer`
The checked-in Dockerfile already builds the `twister` binary.

## Set Variables

Use shared variables for values both services need:

- `TURSO_DATABASE_URL`
- `TURSO_AUTH_TOKEN`
- `LOG_LEVEL=info`
- `LOG_FORMAT=json`
Set these on `api`:
- `HTTP_BIND_ADDR=0.0.0.0:${{ PORT }}`
- `SEARCH_DEFAULT_LIMIT=20`
- `SEARCH_MAX_LIMIT=100`
- `READ_THROUGH_MODE=missing`
- `READ_THROUGH_COLLECTIONS=sh.tangled.*`
- `READ_THROUGH_MAX_ATTEMPTS=5`
- `ENABLE_ADMIN_ENDPOINTS=false`
- `ADMIN_AUTH_TOKEN=<set this if admin routes are enabled>`
Set these on `indexer`:
- `INDEXER_HEALTH_ADDR=0.0.0.0:${{ PORT }}`
- `TAP_URL=<your Tap URL>`
- `TAP_AUTH_PASSWORD=<your Tap password>`
- `INDEXED_COLLECTIONS=sh.tangled.*`
- `ENABLE_INGEST_ENRICHMENT=true`
Optional OAuth variables for a Railway-hosted web client metadata endpoint:
- `OAUTH_CLIENT_ID`
- `OAUTH_REDIRECT_URIS`
The `${{ PORT }}` reference matters. Railway health checks run against the
service port it injects, so the process must listen on that port.

## Deploy From This Machine

From the repo root, deploy `packages/api` into each Railway service:

```sh
cd /Users/owais/Projects/Twisted
railway up packages/api --path-as-root --service api
railway up packages/api --path-as-root --service indexer
```

`--path-as-root` is important in this monorepo. It makes `packages/api` the
deployment root instead of archiving the whole repo.

## Configure Health Checks

Set the health check path in Railway for each service:

- `api`: `/readyz`
- `indexer`: `/health`
`/readyz` is the better API check because it verifies database reachability.

## First Bootstrap

A fresh environment is not search-ready just because the services booted.

1. Deploy `api`.
2. Deploy `indexer`.
3. Confirm the `api` domain returns `200` from `/readyz`.
4. Confirm the `indexer` returns `200` from `/health`.
5. Run the initial backfill against the same Turso and Tap environment.
One simple way to run backfill from this machine is to use the same env values
locally and execute:

```sh
cd /Users/owais/Projects/Twisted/packages/api
go run ./main.go backfill --seeds /path/to/seeds.txt
```

Do not call the environment ready until that first backfill has completed.

## Point The App At Railway

For local app builds, set the Railway API URL in `apps/twisted/.env`:

```sh
VITE_TWISTER_API_BASE_URL=https://<your-api-domain>
```

Then build or run the app as usual:

```sh
pnpm --dir apps/twisted dev
pnpm --dir apps/twisted build
pnpm --dir apps/twisted exec cap sync
```

## Operating Model

This is the practical split:

- Railway hosts the always-on backend
- Turso stores indexed data
- this machine, or CI, builds the mobile app and points it at Railway
If you later want a Railway-hosted web frontend, add that as a separate service.
