---
title: "QA Checklist"
updated: 2026-03-23
---

# QA Checklist

## Ingestion (end-to-end)

Walk a record through the full pipeline: Tap event → indexer → store → searchable.

- [ ] Indexer connects to Tap via WebSocket and begins processing events
- [ ] Creating a tracked record on Tangled produces a row in `documents`
- [ ] Updating that record changes the existing row (new CID)
- [ ] Deleting that record tombstones the row (`deleted_at` set)
- [ ] Tombstoned documents do not appear in search results
- [ ] Identity events update the handle cache; new documents show resolved handles
- [ ] Unsupported collections are silently skipped (no errors logged)
- [ ] Connection drop triggers automatic reconnect and resumes from last cursor

## Cursor durability

- [ ] Kill the indexer mid-stream, restart — processing resumes without duplicating documents
- [ ] Redeploy the indexer — cursor is persisted before shutdown, no gap or replay

## Backfill

Run `twister backfill` against a small seed file and verify the discovery graph.

- [ ] Seed file with known Tangled users produces a non-empty discovery graph
- [ ] `--max-hops 1` limits discovery to direct follows/collaborators only
- [ ] `--dry-run` logs the plan but does not call Tap mutation endpoints
- [ ] Already-tracked DIDs are reported and not re-submitted
- [ ] Re-running the same seeds is idempotent
- [ ] After backfill + Tap sync, search returns historical content that wasn't there before

## Search API

- [ ] `GET /search?q=<repo-name>` returns the expected repo as top result
- [ ] Searching by title keyword returns expected documents
- [ ] Searching by author handle returns their content
- [ ] `collection`, `type`, `author`, `repo` filters restrict results correctly
- [ ] Pagination: `offset=0&limit=5` then `offset=5&limit=5` return disjoint result sets
- [ ] Missing `q` param returns 400 with error JSON
- [ ] Unknown query param returns 400
- [ ] `GET /documents/{id}` returns the full document; 404 for missing or tombstoned
- [ ] `GET /healthz` returns 200
- [ ] `GET /readyz` returns 503 when DB is unreachable

## Deployment (Railway)

- [ ] API service healthy and routable at public URL
- [ ] Indexer service healthy on `:9090/health`
- [ ] A new Tangled record ingested post-deploy becomes searchable within seconds
- [ ] Redeploying the API preserves availability (health-check-gated rollout)
- [ ] Restarting the indexer does not lose sync position
- [ ] Environment variables match the documented set in `docs/api/deploy.md`

## Mobile — Navigation & Shell

- [ ] All five tabs render and switch without layout shift
- [ ] Tab-to-tab navigation preserves scroll position and component state
- [ ] Pages show skeleton loaders before data appears
- [ ] iOS and Android builds compile and launch via Capacitor

## Mobile — Live Tangled Browsing

- [ ] Repo detail page loads metadata from PDS + git data from knot
- [ ] README renders via markdown renderer
- [ ] File tree navigates directories; file viewer shows syntax-highlighted content
- [ ] Commit log paginates with cursor
- [ ] Profile page shows avatar, bio, and repos from PDS
- [ ] Issue list filters by state (open/closed); detail shows body + threaded comments
- [ ] PR list filters by status; detail shows source/target branches + comments
- [ ] Stale-while-revalidate: cached data shows immediately, refreshes in background
- [ ] Error states render correctly: 404, network failure, empty repo
- [ ] Slow network: skeleton → content transition is smooth (test with throttled devtools)
