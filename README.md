# Twisted

Twisted is a monorepo for a Tangled mobile client and a Tap-backed indexing API.

## Projects

- `apps/twisted`: Ionic Vue client for browsing Tangled repos, profiles, issues, PRs, and search
- `packages/api`: Go service for ingest, search, read-through indexing, and activity cache
- `docs`: project docs, ADRs, and operational references

## Architecture

The app still reads canonical repo and profile data from Tangled and AT Protocol APIs.
The API adds:

1. network-wide search over indexed Tangled content
2. index-backed summaries that are hard to derive from public APIs alone

The backend now targets PostgreSQL for both local and remote deployments.

## Development

Install JS dependencies once:

```bash
pnpm install
```

Default local database URL:

```bash
postgresql://localhost/${USER}_dev?sslmode=disable
```

That matches the Postgres.app-style local workflow and also matches the repo's
`docker-compose.dev.yaml` if you want disposable local Postgres and Tap
containers instead.

Start the local database:

```bash
just db-up
```

Bootstrap the schema once:

```bash
just api-build
DATABASE_URL="postgresql://localhost/${USER}_dev?sslmode=disable" \
  ./packages/api/twister migrate
```

Run the mobile app:

```bash
pnpm dev
```

Run the API against local Postgres:

```bash
just api-dev
```

Run the indexer against local Postgres:

```bash
just api-run-indexer
```

Use `just api-dev sqlite` or `just api-run-indexer sqlite` only for the
temporary SQLite rollback path.

If you want the app to call the local API, put this in `apps/twisted/.env.local`:

```bash
VITE_TWISTER_API_BASE_URL=http://localhost:8080
```

Run the API smoke checks from the repo root:

```bash
uv run --project packages/scripts/api twister-api-smoke
```

If `ADMIN_AUTH_TOKEN` is present, the smoke script also checks admin status.

## Deployment

`docker-compose.prod.yaml` is now the source-of-truth VPS stack. It runs
`postgres`, `migrate`, `api`, `indexer`, `tap`, and `llama-embeddings`.

The llama.cpp service is only deployment groundwork for a later embedding
adapter. Search remains keyword-only for now.

See [`docs/reference/deployment-walkthrough.md`](docs/reference/deployment-walkthrough.md)
for the full setup, bootstrap, backup, and cutover flow.

## Attributions

This project relies heavily on the work of the
[Tangled team](https://tangled.org/tangled.org) and the infrastructure made
available by [microcosm](https://microcosm.blue), especially Lightrail and
Constellation.
