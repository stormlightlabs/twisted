# Twisted

Twisted is a monorepo for a Tangled mobile client and the supporting Tap-backed indexing API.

## Projects

- `apps/twisted`: Ionic Vue client for browsing Tangled repos, profiles, issues, PRs, and indexed search results
- `packages/api`: Go service that consumes Tangled records through Tap, fills gaps in the public Tangled API, and serves search
- `docs`: top-level specs and plans, split by project under `docs/app` and `docs/api`

## Architecture

The app still uses Tangled's public knot and PDS APIs for canonical repo and profile data. The API project adds two complementary capabilities:

1. Global search over indexed Tangled content
2. Index-backed summaries for data that is hard to derive from the public API alone, such as followers

That keeps direct browsing honest while giving the client one place to ask for cross-network discovery and graph augmentation.

## Development

Use the top-level [`justfile`](justfile) for common workflows:

```bash
just dev
just build
just test
just api-run-api
```

To enable indexed search in the client, set `VITE_TWISTER_API_BASE_URL` in `apps/twisted/.env`.

## Run Locally

Install dependencies once from the repo root:

```bash
pnpm install
```

Start the Ionic/Vite app:

```bash
pnpm dev
# or: just dev
```

That serves the client from `apps/twisted` with Vite.

To run the Go API locally, make sure `packages/api/.env` has at least:

- `TURSO_DATABASE_URL`
- `TURSO_AUTH_TOKEN`

Then start the API:

```bash
pnpm api:run:api
# or: just api-dev
```

This serves the API and search site on `http://localhost:8080`.

To run the indexer as well, `packages/api/.env` also needs:

- `TAP_URL`
- `TAP_AUTH_PASSWORD`
- `INDEXED_COLLECTIONS`

Then start the indexer in a separate terminal:

```bash
pnpm api:run:indexer
# or: just api-run-indexer
```

Typical local setup is three terminals:

1. `pnpm dev`
2. `pnpm api:run:api`
3. `pnpm api:run:indexer`

If you want the app to call the local API, set this in `apps/twisted/.env`:

```bash
VITE_TWISTER_API_BASE_URL=http://localhost:8080
```

## Infrastructure Setup

### Turso

Use one Turso database per environment, for example:

- `twister-dev`
- `twister-prod`

Do not introduce separate app variable names for dev and prod. Always use the same variables:

- `TURSO_DATABASE_URL`
- `TURSO_AUTH_TOKEN`

Only the values change per environment.

Example:

```bash
# Development
TURSO_DATABASE_URL=libsql://twister-dev-your-org.turso.io
TURSO_AUTH_TOKEN=...

# Production
TURSO_DATABASE_URL=libsql://twister-prod-your-org.turso.io
TURSO_AUTH_TOKEN=...
```

### Railway

Create or reuse one Railway project containing:

- existing `tap`
- `api` running `twister api`
- `indexer` running `twister indexer`

Set these shared variables on the Railway services:

- `TURSO_DATABASE_URL`
- `TURSO_AUTH_TOKEN`
- `LOG_LEVEL`
- `LOG_FORMAT`

Set these API-specific variables:

- `HTTP_BIND_ADDR`
- `SEARCH_DEFAULT_LIMIT`
- `SEARCH_MAX_LIMIT`

Set these indexer-specific variables:

- `TAP_URL`
- `TAP_AUTH_PASSWORD`
- `INDEXED_COLLECTIONS`

If you use separate Railway environments for dev and prod, keep the same variable names in both and only swap the Turso values.

### First Bootstrap

For a brand-new environment:

1. Point `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` at the target database.
2. Deploy `api` and `indexer` on Railway.
3. Verify API readiness and indexer health.
4. Run `twister backfill` with your seed file.
5. Treat the environment as search-ready only after historical backfill completes.

## Docs

- Index: [`docs/README.md`](docs/README.md)
