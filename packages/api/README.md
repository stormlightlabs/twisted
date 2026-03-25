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
