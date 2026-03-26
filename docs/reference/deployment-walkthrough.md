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
- `READ_THROUGH_COLLECTIONS=<explicit search collection CSV>`
- `READ_THROUGH_MAX_ATTEMPTS=5`
- `ENABLE_ADMIN_ENDPOINTS=false`
- `ADMIN_AUTH_TOKEN=<set this if admin routes are enabled>`
Set these on `indexer`:
- `INDEXER_HEALTH_ADDR=0.0.0.0:${{ PORT }}`
- `TAP_URL=<your Tap URL>`
- `TAP_AUTH_PASSWORD=<your Tap password>`
- `INDEXED_COLLECTIONS=<matching explicit search collection CSV>`
- `ENABLE_INGEST_ENRICHMENT=true`
Do not use `sh.tangled.*` for those allowlists. Match the Lightrail-backed
search collection set and leave `sh.tangled.graph.follow` out.
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
Use Railway shell so the command runs inside the live `indexer` environment:

```sh
cd /Users/owais/Projects/Twisted
railway link # Select indexer service if prompted
railway shell
twister backfill --source lightrail
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
