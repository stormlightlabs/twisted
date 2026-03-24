---
title: "Deployment Guide"
updated: 2026-03-23
---

# Railway Deployment Guide

Deploy the Twister API and indexer as Railway services alongside the existing Tap instance.

## Prerequisites

- Railway project with Tap already deployed
- Turso database created with auth token
- GitHub repository connected to Railway

## Service Layout

| Service | Start Command     | Health Check   | Public | Port |
| ------- | ----------------- | -------------- | ------ | ---- |
| tap     | (pre-existing)    | `GET /health`  | no     | —    |
| api     | `twister api`     | `GET /healthz` | yes    | 8080 |
| indexer | `twister indexer` | `GET /health`  | no     | 9090 |

All services use the same Docker image. Railway overrides `CMD` with the per-service start command.

## Step 1 — Create Services

In the Railway dashboard, create two new services from the same GitHub repo:

1. **api** — set start command to `twister api`
2. **indexer** — set start command to `twister indexer`

Both services build from `packages/api/Dockerfile`.

## Step 2 — Set Environment Variables

### Shared (set on both services)

```sh
TURSO_DATABASE_URL=libsql://twister-prod-<org>.turso.io
TURSO_AUTH_TOKEN=<turso-jwt>
LOG_LEVEL=info
LOG_FORMAT=json
```

### API only

```sh
HTTP_BIND_ADDR=:8080
SEARCH_DEFAULT_LIMIT=20
SEARCH_MAX_LIMIT=100
```

### Indexer only

```sh
TAP_URL=wss://${{tap.RAILWAY_PRIVATE_DOMAIN}}/channel
TAP_AUTH_PASSWORD=<tap-admin-password>
INDEXED_COLLECTIONS=sh.tangled.repo,sh.tangled.repo.issue,sh.tangled.repo.pull,sh.tangled.string,sh.tangled.actor.profile,sh.tangled.repo.issue.comment,sh.tangled.repo.pull.comment,sh.tangled.repo.issue.state,sh.tangled.repo.pull.status,sh.tangled.feed.star
INDEXER_HEALTH_ADDR=:9090
```

Use `${{tap.RAILWAY_PRIVATE_DOMAIN}}` to reference Tap's internal hostname. This keeps traffic on Railway's private network.

## Step 3 — Configure Health Checks

In the Railway dashboard, configure per-service:

- **api**: HTTP health check on path `/healthz`, port `8080`
- **indexer**: HTTP health check on path `/health`, port `9090`

Railway uses these to gate deployment rollouts and restart unhealthy containers.

## Step 4 — Configure Autodeploy

Connect the GitHub repository in the Railway dashboard. Railway will build and deploy on every push to the configured branch.

The Dockerfile uses multi-stage builds with `CGO_ENABLED=0` for a static binary on Alpine.

## Step 5 — Deploy and Verify

After the first deploy:

1. Confirm API is healthy: `curl https://<api-domain>/healthz`
2. Confirm API readiness: `curl https://<api-domain>/readyz`
3. Check indexer health in Railway logs (health check on `:9090/health`)

## Step 6 — Bootstrap Content

Run graph backfill to populate initial content from seed users:

```bash
twister backfill --seeds=docs/api/seeds.txt --max-hops=2
```

Wait for Tap to finish historical sync, then verify search returns results:

```bash
curl "https://<api-domain>/search?q=tangled"
```
