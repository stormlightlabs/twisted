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

Use the top-level [`justfile`](justfile) for common workflows (`just --list` to view)

Use `apps/twisted/.env.local` for machine-local overrides such as a localhost API or OAuth callback.

## Run Locally

Install dependencies once from the repo root:

```bash
pnpm install
```

Start the Ionic/Vite app:

```bash
pnpm dev # or: just dev
```

That serves the client from `apps/twisted` with Vite.

To run the Go API locally for routine experimentation, no Turso credentials are required.

Start the API in local file mode:

```bash
pnpm api:run:api # or: just api-dev
```

This serves the API and search site on `http://localhost:8080` using
`packages/api/twister-dev.db`.

To run the API against remote Turso instead:

```bash
just api-dev remote
```

Run the API smoke checks from the repo root:

```bash
uv run --project packages/scripts/api twister-api-smoke
```

To verify admin endpoints as well, ensure `ADMIN_AUTH_TOKEN` is present in the
environment before running the smoke script.

To run the indexer in local file mode as well:

```bash
pnpm api:run:indexer # or: just api-run-indexer
```

To run the indexer against remote Turso, `packages/api/.env` needs:

- `TAP_URL`
- `TAP_AUTH_PASSWORD`
- `INDEXED_COLLECTIONS`

```bash
just api-run-indexer remote
```

Typical local setup is three terminals:

1. `pnpm dev`
2. `pnpm api:run:api`
3. `pnpm api:run:indexer`

If you want the app to call the local API, put this in `apps/twisted/.env.local`:

```bash
VITE_TWISTER_API_BASE_URL=http://localhost:8080
```

Dev builds keep the current OAuth flow available. Production builds are read-only
and hide auth entry points for now.

## Attributions

This project relies heavily on the work of the [Tangled team](https://tangled.org/tangled.org) (duh)
and the infrastructure made available by [microcosm](https://microcosm.blue), specifically
Lightrail and Constellation.
