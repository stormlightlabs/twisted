---
title: "Spec 06 — Operations"
updated: 2026-03-23
---

Covers configuration, observability, security, and deployment.

## 0. Quick Setup

Tap is already deployed. For a new environment, the minimum operator work is:

1. Create or choose a Turso database for that environment
2. Generate a Turso auth token for that database
3. Point `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` at that database
4. Create Railway services for `api` and `indexer`
5. Point `TAP_URL` at the existing Tap deployment
6. Run migrations/start the services
7. Run `twister backfill` before treating the environment as search-ready

No separate `*_DEV` or `*_PROD` variables are required. Each environment keeps using the same variable names and simply points them at the appropriate Turso database.

## 1. Configuration

All configuration is via environment variables.

### Required

| Variable              | Description                                                 |
| --------------------- | ----------------------------------------------------------- |
| `TAP_URL`             | Tap WebSocket URL (e.g., `wss://tap.example.com/channel`)   |
| `TAP_AUTH_PASSWORD`   | Tap admin password for Basic auth (if set on Tap)           |
| `TURSO_DATABASE_URL`  | Turso connection URL (e.g., `libsql://db-name.turso.io`)    |
| `TURSO_AUTH_TOKEN`    | Turso JWT auth token                                        |
| `INDEXED_COLLECTIONS` | Comma-separated list of `sh.tangled.*` collections to index |

### Search

| Variable               | Default   | Description              |
| ---------------------- | --------- | ------------------------ |
| `SEARCH_DEFAULT_LIMIT` | `20`      | Default results per page |
| `SEARCH_MAX_LIMIT`     | `100`     | Maximum results per page |
| `SEARCH_DEFAULT_MODE`  | `keyword` | Default search mode      |

### Embedding

| Variable               | Default | Description                                          |
| ---------------------- | ------- | ---------------------------------------------------- |
| `EMBEDDING_PROVIDER`   | —       | Provider name (e.g., `openai`, `ollama`, `voyageai`) |
| `EMBEDDING_MODEL`      | —       | Model name (e.g., `text-embedding-3-small`)          |
| `EMBEDDING_API_KEY`    | —       | Provider API key                                     |
| `EMBEDDING_API_URL`    | —       | Provider base URL (for self-hosted)                  |
| `EMBEDDING_DIM`        | `768`   | Vector dimensionality                                |
| `EMBEDDING_BATCH_SIZE` | `32`    | Batch size for embed-worker                          |

### Hybrid Search

| Variable                 | Default | Description                             |
| ------------------------ | ------- | --------------------------------------- |
| `HYBRID_KEYWORD_WEIGHT`  | `0.65`  | Keyword score weight in hybrid ranking  |
| `HYBRID_SEMANTIC_WEIGHT` | `0.35`  | Semantic score weight in hybrid ranking |

### Server

| Variable                 | Default | Description                                 |
| ------------------------ | ------- | ------------------------------------------- |
| `HTTP_BIND_ADDR`         | `:8080` | API server bind address                     |
| `LOG_LEVEL`              | `info`  | Log level: `debug`, `info`, `warn`, `error` |
| `LOG_FORMAT`             | `json`  | Log format: `json` or `text`                |
| `ENABLE_ADMIN_ENDPOINTS` | `false` | Enable `/admin/*` endpoints                 |
| `ADMIN_AUTH_TOKEN`       | —       | Bearer token for admin endpoints            |

### Example `.env`

```bash
# Tap (deployed on Railway)
TAP_URL=wss://tap-instance.up.railway.app/channel
TAP_AUTH_PASSWORD=your-tap-admin-password

# Turso
TURSO_DATABASE_URL=libsql://twister-db.turso.io
TURSO_AUTH_TOKEN=eyJhbGci...

# Collections
INDEXED_COLLECTIONS=sh.tangled.repo,sh.tangled.repo.issue,sh.tangled.repo.pull,sh.tangled.string,sh.tangled.actor.profile,sh.tangled.repo.issue.comment,sh.tangled.repo.pull.comment,sh.tangled.repo.issue.state,sh.tangled.repo.pull.status,sh.tangled.feed.star

# Search
SEARCH_DEFAULT_LIMIT=20
SEARCH_MAX_LIMIT=100

# Embedding (Phase 2)
# EMBEDDING_PROVIDER=openai
# EMBEDDING_MODEL=text-embedding-3-small
# EMBEDDING_API_KEY=sk-...
# EMBEDDING_DIM=768

# Server
HTTP_BIND_ADDR=:8080
LOG_LEVEL=info
ENABLE_ADMIN_ENDPOINTS=false
```

### Environment Selection

Use the same variable names in every environment:

- local development can point `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` at `twister-dev`
- production can point those same variables at `twister-prod`

The application should not care which database it is talking to; only the environment wiring changes.

## 1.5. Turso Setup

### Recommended Databases

Use one Turso database per environment, for example:

- `twister-dev`
- `twister-prod`

Keep the app config identical across environments and swap only these values:

- `TURSO_DATABASE_URL`
- `TURSO_AUTH_TOKEN`

### Basic Flow

Using the Turso dashboard or CLI:

1. Create the database for the target environment
2. Capture its libSQL URL
3. Create an auth token for the service
4. Set `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` in that environment

Example values:

```bash
# Development environment
TURSO_DATABASE_URL=libsql://twister-dev-your-org.turso.io
TURSO_AUTH_TOKEN=...

# Production environment
TURSO_DATABASE_URL=libsql://twister-prod-your-org.turso.io
TURSO_AUTH_TOKEN=...
```

### Practical Rule

Do not introduce `TURSO_DATABASE_URL_DEV`, `TURSO_DATABASE_URL_PROD`, or similar split variables. Railway environments, local shells, and CI should all set the same names with environment-specific values.

## 1.6. Railway Setup

### Project Layout

Create or reuse one Railway project containing:

- existing `tap` service
- `api` service running `twister api`
- `indexer` service running `twister indexer`

### Basic Steps

1. Connect the monorepo to Railway
2. Create the `api` and `indexer` services from the same source repo/Docker image
3. Set shared variables on both services:
   - `TURSO_DATABASE_URL`
   - `TURSO_AUTH_TOKEN`
   - `LOG_LEVEL`
   - `LOG_FORMAT`
4. Set API-specific variables:
   - `HTTP_BIND_ADDR`
   - `SEARCH_DEFAULT_LIMIT`
   - `SEARCH_MAX_LIMIT`
5. Set indexer-specific variables:
   - `TAP_URL`
   - `TAP_AUTH_PASSWORD`
   - `INDEXED_COLLECTIONS`
6. Configure health checks
7. Deploy
8. Run backfill against the environment before public validation

### Dev vs Production on Railway

If you use multiple Railway environments, keep the same service definitions and variable names in each one. Only the values change:

- dev Railway environment -> `TURSO_DATABASE_URL=...twister-dev...`
- prod Railway environment -> `TURSO_DATABASE_URL=...twister-prod...`

This keeps deployment logic simple and avoids conditional application config.

## 2. Observability

### Structured Logging

Use Go's `slog` with JSON output. Every log entry includes:

| Field     | Description                         |
| --------- | ----------------------------------- |
| `ts`      | Timestamp (RFC 3339)                |
| `level`   | Log level                           |
| `service` | `api`, `indexer`, or `embed-worker` |
| `msg`     | Human-readable message              |

#### Context Fields (where applicable)

| Field         | When                     |
| ------------- | ------------------------ |
| `event_name`  | Tap event processing     |
| `event_id`    | Tap event ID             |
| `document_id` | Document operations      |
| `did`         | Any DID-scoped operation |
| `collection`  | Record processing        |
| `rkey`        | Record processing        |
| `cursor`      | Cursor persistence       |
| `error_class` | Error handling           |
| `duration_ms` | Timed operations         |

### Metrics

Recommended counters and gauges (via logs, Prometheus, or platform metrics):

#### Ingestion

| Metric                         | Type      | Description                        |
| ------------------------------ | --------- | ---------------------------------- |
| `events_processed_total`       | counter   | Total Tap events processed         |
| `events_failed_total`          | counter   | Events that failed processing      |
| `normalization_failures_total` | counter   | Normalization errors by collection |
| `upsert_duration_ms`           | histogram | DB upsert latency                  |
| `cursor_position`              | gauge     | Current Tap cursor position        |

#### Embedding

| Metric                     | Type      | Description                    |
| -------------------------- | --------- | ------------------------------ |
| `embedding_queue_depth`    | gauge     | Pending embedding jobs         |
| `embedding_failures_total` | counter   | Failed embedding attempts      |
| `embedding_duration_ms`    | histogram | Per-document embedding latency |

#### Search

| Metric                  | Type      | Description                |
| ----------------------- | --------- | -------------------------- |
| `search_requests_total` | counter   | Requests by mode           |
| `search_duration_ms`    | histogram | Query latency by mode      |
| `search_results_count`  | histogram | Results returned per query |

### Health Checks

#### API Process

| Endpoint       | Check                 | Healthy             |
| -------------- | --------------------- | ------------------- |
| `GET /healthz` | Process is responsive | Always (liveness)   |
| `GET /readyz`  | DB connection works   | `SELECT 1` succeeds |

#### Indexer Process

The indexer exposes a top-level health probe (not HTTP-routed):

- Tap WebSocket connected or reconnecting
- Cursor advancing or intentionally idle
- DB reachable

On Railway, this is a health check endpoint on a separate port (9090).

#### Embed Worker

- DB reachable
- Embedding provider reachable (periodic test call)
- Job queue not stalled (jobs processing within expected timeframe)

## 3. Security

### Secrets Management

Secrets are injected through platform secret management:

- **Railway:** Environment variables in the dashboard or `railway variables`

Secrets are never stored in code, config files, or Docker images.

Required secrets:

| Secret              | Purpose                           |
| ------------------- | --------------------------------- |
| `TURSO_AUTH_TOKEN`  | Turso database authentication     |
| `TAP_AUTH_PASSWORD` | Tap admin API authentication      |
| `EMBEDDING_API_KEY` | Embedding provider authentication |
| `ADMIN_AUTH_TOKEN`  | Admin endpoint authentication     |

### Admin Endpoints

Admin endpoints (`/admin/reindex`, `/admin/reembed`) are:

- Disabled by default (`ENABLE_ADMIN_ENDPOINTS=false`)
- When enabled, protected by bearer token (`ADMIN_AUTH_TOKEN`)
- Alternatively, exposed only on internal networking (Railway private networking)

### Input Validation

The search API shall:

- Validate `limit` is between 1 and `SEARCH_MAX_LIMIT`
- Validate `offset` is non-negative
- Reject unknown or malformed filter parameters with 400
- Sanitize query strings before passing to FTS (Tantivy query parser handles this, but validate basic structure)
- Bound hybrid requests (limit concurrent vector searches)

### Tap Authentication

The indexer authenticates to Tap using HTTP Basic auth (`admin:<TAP_AUTH_PASSWORD>`). The WebSocket upgrade request includes the auth header.

### Data Privacy

- All indexed content is public ATProto data
- No private or authenticated content is ingested
- Deleted records are tombstoned (`deleted_at` set) and excluded from search results
- Tombstoned documents are periodically purged (configurable retention)

## 4. Deployment

### Railway (Primary)

All Twister services deploy as separate Railway services within the same project. Tap is already deployed here.

#### Service Layout

| Service      | Start Command          | Health Check       | Public |
| ------------ | ---------------------- | ------------------ | ------ |
| tap          | (already deployed)     | `GET /health`      | no     |
| api          | `twister api`          | `GET /healthz`     | yes    |
| indexer      | `twister indexer`      | `GET :9090/health` | no     |
| embed-worker | `twister embed-worker` | `GET :9091/health` | no     |

All services share the same Docker image. Railway uses the start command to select the subcommand.

#### Environment Variables

Set per-service in the Railway dashboard or via `railway variables`:

```bash
# Shared across services
TURSO_DATABASE_URL=libsql://twister-db.turso.io
TURSO_AUTH_TOKEN=eyJ...
LOG_LEVEL=info
LOG_FORMAT=json

# API service
HTTP_BIND_ADDR=:8080
SEARCH_DEFAULT_LIMIT=20
SEARCH_MAX_LIMIT=100
ENABLE_ADMIN_ENDPOINTS=false

# Indexer service
TAP_URL=wss://${{tap.RAILWAY_PUBLIC_DOMAIN}}/channel  # Railway service reference
TAP_AUTH_PASSWORD=...
INDEXED_COLLECTIONS=sh.tangled.repo,sh.tangled.repo.issue,sh.tangled.repo.pull,sh.tangled.string,sh.tangled.actor.profile

# Embed-worker (Phase 2)
# EMBEDDING_PROVIDER=openai
# EMBEDDING_MODEL=text-embedding-3-small
# EMBEDDING_API_KEY=sk-...
```

Railway supports referencing other services' variables with `${{service.VAR}}` syntax, which is useful for linking the indexer to Tap's domain.

#### First-Time Bootstrap Checklist

After the first successful deploy of a new environment:

1. Confirm API readiness on `/readyz`
2. Confirm indexer health and Tap connectivity
3. Run graph backfill with the environment's seed file
4. Wait for Tap historical sync to settle
5. Verify that search returns known historical repos/profiles

#### Health Checks

Railway activates deployments based on health check responses. Configure per-service:

- **api:** HTTP health check on `/healthz` port 8080
- **indexer:** HTTP health check on `/health` port 9090
- **embed-worker:** HTTP health check on `/health` port 9091

#### Autodeploy

Connect the GitHub repository for automatic deployments on push. Railway builds from the Dockerfile and uses the start command configured per service.

#### Internal Networking

Railway services within the same project can communicate over private networking using `service.railway.internal` hostnames. The indexer connects to Tap via this internal network when both are in the same project.

### Dockerfile

```dockerfile
FROM golang:1.24-alpine AS builder

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN CGO_ENABLED=0 GOOS=linux go build \
    -ldflags="-s -w" \
    -o /app/twister \
    ./main.go

FROM alpine:3.21

RUN apk add --no-cache ca-certificates tzdata

COPY --from=builder /app/twister /usr/local/bin/twister

EXPOSE 8080 9090 9091

CMD ["twister", "api"]
```

Notes:

- `CGO_ENABLED=0` for static binary (required if using `libsql-client-go`; not compatible with `go-libsql` which needs CGo)
- Railway overrides `CMD` with the start command configured per service
- Multiple ports exposed: 8080 (API), 9090 (indexer health), 9091 (embed-worker health)

### Graceful Shutdown

All processes handle `SIGTERM` and `SIGINT`:

1. Stop accepting new requests/events
2. Drain in-flight work (with timeout)
3. Persist current cursor (indexer)
4. Close DB connections
5. Exit 0

Railway sends `SIGTERM` during deployments and restarts.
