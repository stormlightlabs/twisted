# Twister

Tap-based indexing and search API for Tangled. Acts as a proxy layer between the Twisted app and all upstream AT Protocol services (knots, PDS, Bluesky, Constellation, Jetstream).

## Requirements

- Go 1.25+
- A Turso database (or local SQLite for development)

## Running locally

```sh
cd packages/api

# Start the API server with a local SQLite database (twister-dev.db)
go run . api --local
```

The server listens on `:8080` by default. Logs are printed as text when `--local` is set.

## Experimental Local DB Operations

The experimental local database lives at `packages/api/twister-dev.db` when you run Twister from `packages/api` with `--local`.

This database is for local experimentation only. Treat it as disposable unless you explicitly back it up.

### Backup

Recommended procedure:

1. Stop the Twister process using the local DB.
2. Copy the database file and any SQLite sidecar files if they exist.

Example:

```sh
cd packages/api
mkdir -p backups
timestamp="$(date +%Y%m%d-%H%M%S)"
cp twister-dev.db "backups/twister-dev-${timestamp}.db"
test -f twister-dev.db-wal && cp twister-dev.db-wal "backups/twister-dev-${timestamp}.db-wal"
test -f twister-dev.db-shm && cp twister-dev.db-shm "backups/twister-dev-${timestamp}.db-shm"
```

For this experimental DB, stop-and-copy is preferred over hot backup complexity.

### Restore

Recommended procedure:

1. Stop the Twister process.
2. Move the current local DB aside if you want to keep it.
3. Copy the backup file back to `twister-dev.db`.
4. Restore matching `-wal` and `-shm` files only if they were captured with the same backup set.

Example:

```sh
cd packages/api
mv twister-dev.db "twister-dev.db.broken.$(date +%Y%m%d-%H%M%S)" 2>/dev/null || true
cp backups/twister-dev-YYYYMMDD-HHMMSS.db twister-dev.db
```

After restore, restart Twister and let the app run migrations normally.

### Disk Growth

The local DB will grow during experimentation because of:

- indexed documents
- FTS tables
- activity cache rows
- repeated backfill or reindex runs

Recommended operating procedure:

1. Check file growth periodically.
2. Delete and rebuild the experimental DB freely when the dataset is no longer useful.
3. Run `VACUUM` only when you intentionally want to compact a long-lived local DB.
4. Keep old backups out of the repo and rotate them manually.

Example inspection commands:

```sh
cd packages/api
du -h twister-dev.db*
ls -lh twister-dev.db*
```

For experimental use, the simplest policy is usually:

- back up anything worth keeping
- remove the DB when the experiment is over
- let Twister rebuild from migrations and backfill paths

### Failure Recovery Rule

If the experimental DB becomes suspicious or inconsistent, prefer restore-or-rebuild over manual repair. This is a developer convenience database, not the source of truth.

## Environment variables

Copy `.env.example` to `.env` in the repo root (or `packages/api/`). The server loads `.env`, `../.env`, and `../../.env` automatically.

| Variable                   | Default                                | Description                                             |
| -------------------------- | -------------------------------------- | ------------------------------------------------------- |
| `TURSO_DATABASE_URL`       | —                                      | Turso/libSQL connection URL (required unless `--local`) |
| `TURSO_AUTH_TOKEN`         | —                                      | Auth token (required for non-file URLs)                 |
| `HTTP_BIND_ADDR`           | `:8080`                                | Address the HTTP server listens on                      |
| `LOG_LEVEL`                | `info`                                 | Log level (`debug`, `info`, `warn`, `error`)            |
| `LOG_FORMAT`               | `json`                                 | Log format (`json` or `text`)                           |
| `SEARCH_DEFAULT_LIMIT`     | `20`                                   | Default result count for search                         |
| `SEARCH_MAX_LIMIT`         | `100`                                  | Maximum result count for search                         |
| `ENABLE_ADMIN_ENDPOINTS`   | `false`                                | Expose `/admin/*` endpoints                             |
| `ADMIN_AUTH_TOKEN`         | —                                      | Bearer token required for admin endpoints               |
| `CONSTELLATION_URL`        | `https://constellation.microcosm.blue` | Constellation API base URL                              |
| `CONSTELLATION_USER_AGENT` | `twister/1.0 …`                        | User-Agent sent to Constellation                        |
| `TAP_URL`                  | —                                      | Tap firehose URL (indexer only)                         |
| `TAP_AUTH_PASSWORD`        | —                                      | Tap auth password (indexer only)                        |
| `INDEXED_COLLECTIONS`      | —                                      | Comma-separated AT collections to index                 |

## CLI commands

```sh
twister api        # Start the HTTP API server
twister indexer    # Start the Tap firehose consumer
twister backfill   # Seed the index from upstream APIs
twister reindex    # Re-process existing documents
```

## Proxy endpoints

The API proxies all upstream AT Protocol and social-graph requests so the app has a single origin:

| Route                           | Upstream                                                      |
| ------------------------------- | ------------------------------------------------------------- |
| `GET /proxy/knot/{host}/{nsid}` | `https://{host}/xrpc/{nsid}`                                  |
| `GET /proxy/pds/{host}/{nsid}`  | `https://{host}/xrpc/{nsid}`                                  |
| `GET /proxy/bsky/{nsid}`        | `https://public.api.bsky.app/xrpc/{nsid}`                     |
| `GET /identity/resolve`         | `https://bsky.social/xrpc/com.atproto.identity.resolveHandle` |
| `GET /identity/did/{did}`       | `https://plc.directory/{did}` or `/.well-known/did.json`      |
| `GET /backlinks/count`          | Constellation `getBacklinksCount` (cached)                    |
| `WS  /activity/stream`          | `wss://jetstream2.us-east.bsky.network/subscribe`             |
