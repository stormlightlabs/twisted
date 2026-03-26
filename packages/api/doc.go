// Twister is the Tap-backed indexing and search API for Tangled.
//
// It proxies upstream AT Protocol services such as knots, PDS endpoints,
// Bluesky, Constellation, and Jetstream so the app can use a single origin.
//
// Requirements
//
//   - Go 1.25+
//   - A Turso database, or local SQLite for development
//
// Running locally
//
//	cd packages/api
//	go run . api --local
//
// The local API listens on :8080 by default and uses packages/api/twister-dev.db.
// Logs are printed as text when --local is set.
//
// # API smoke tests
//
// Smoke checks live in packages/scripts/api/. From the repo root:
//
//	uv run --project packages/scripts/api twister-api-smoke
//
// Optional base URL override:
//
//	TWISTER_API_BASE_URL=http://localhost:8080 \
//	  uv run --project packages/scripts/api twister-api-smoke
//
// # Experimental local DB operations
//
// The experimental local database lives at packages/api/twister-dev.db when
// you run Twister with --local. Treat it as disposable unless you explicitly
// back it up.
//
// Backup:
//
//  1. Stop the Twister process using the local DB.
//  2. Copy the database file and any SQLite sidecar files if they exist.
//
// Example:
//
//	cd packages/api
//	mkdir -p backups
//	timestamp="$(date +%Y%m%d-%H%M%S)"
//	cp twister-dev.db "backups/twister-dev-${timestamp}.db"
//	test -f twister-dev.db-wal && cp twister-dev.db-wal "backups/twister-dev-${timestamp}.db-wal"
//	test -f twister-dev.db-shm && cp twister-dev.db-shm "backups/twister-dev-${timestamp}.db-shm"
//
// Restore:
//
//  1. Stop the Twister process.
//  2. Move the current local DB aside if you want to keep it.
//  3. Copy the backup file back to twister-dev.db.
//  4. Restore matching -wal and -shm files only if they came from the same set.
//
// Example:
//
//	cd packages/api
//	mv twister-dev.db "twister-dev.db.broken.$(date +%Y%m%d-%H%M%S)" 2>/dev/null || true
//	cp backups/twister-dev-YYYYMMDD-HHMMSS.db twister-dev.db
//
// Disk growth:
//
// The local DB grows because of indexed documents, FTS tables, activity cache
// rows, and repeated backfill or reindex runs.
//
// Recommended operating procedure:
//
//  1. Check file growth periodically.
//  2. Delete and rebuild the DB freely when the dataset is no longer useful.
//  3. Run VACUUM only when you intentionally want to compact a long-lived DB.
//  4. Keep old backups out of the repo and rotate them manually.
//
// Inspection commands:
//
//	cd packages/api
//	du -h twister-dev.db*
//	ls -lh twister-dev.db*
//
// Failure recovery: prefer restore-or-rebuild over manual repair if the
// experimental DB becomes
// suspicious or inconsistent. It is a developer convenience database, not the
// source of truth.
//
// # Environment variables
//
// Copy .env.example to .env in the repo root or packages/api/. The server loads
// .env, ../.env, and ../../.env automatically.
//
//   - TURSO_DATABASE_URL: Turso/libSQL connection URL, required unless --local
//   - TURSO_AUTH_TOKEN: auth token, required for non-file URLs
//   - HTTP_BIND_ADDR: default :8080
//   - LOG_LEVEL: debug, info, warn, or error; default info
//   - LOG_FORMAT: json or text; default json
//   - SEARCH_DEFAULT_LIMIT: default 20
//   - SEARCH_MAX_LIMIT: default 100
//   - ENABLE_ADMIN_ENDPOINTS: default false
//   - ADMIN_AUTH_TOKEN: bearer token for admin endpoints
//   - CONSTELLATION_URL: default https://constellation.microcosm.blue
//   - CONSTELLATION_USER_AGENT: user-agent sent to Constellation
//   - TAP_URL: Tap firehose URL, indexer only
//   - TAP_AUTH_PASSWORD: Tap auth password, indexer only
//   - INDEXED_COLLECTIONS: comma-separated AT collections to index
//   - READ_THROUGH_MODE: off, missing, or broad; default missing
//   - READ_THROUGH_COLLECTIONS: read-through allowlist, default INDEXED_COLLECTIONS
//   - READ_THROUGH_MAX_ATTEMPTS: max retries before dead_letter, default 5
//
// CLI commands
//
//	twister api
//	twister indexer
//	twister backfill
//	twister reindex
//	twister enrich
//
// Enrich:
//
// Resolves missing author_handle, repo_name, and web_url fields on documents
// already in the database.
//
//	twister enrich --local
//	twister enrich --local --collection sh.tangled.repo
//	twister enrich --local --did did:plc:abc123
//	twister enrich --local --dry-run
//
// Flags: --collection, --did, --document, --dry-run, --concurrency (default 5).
//
// Proxy endpoints
//
//   - GET /proxy/knot/{host}/{nsid} -> https://{host}/xrpc/{nsid}
//   - GET /proxy/pds/{host}/{nsid} -> https://{host}/xrpc/{nsid}
//   - GET /proxy/bsky/{nsid} -> https://public.api.bsky.app/xrpc/{nsid}
//   - GET /identity/resolve -> https://bsky.social/xrpc/com.atproto.identity.resolveHandle
//   - GET /identity/did/{did} -> https://plc.directory/{did} or /.well-known/did.json
//   - GET /backlinks/count -> Constellation getBacklinksCount, cached
//   - WS /activity/stream -> wss://jetstream2.us-east.bsky.network/subscribe
//
// # Admin endpoints
//
// Admin routes require ENABLE_ADMIN_ENDPOINTS=true. If ADMIN_AUTH_TOKEN is set,
// requests must send Authorization: Bearer <ADMIN_AUTH_TOKEN>.
//
//   - GET /admin/status: cursor state, queue counts, oldest ages, last activity
//   - GET /admin/indexing/jobs: inspect queue rows by status, source, or document
//   - GET /admin/indexing/audit: inspect append-only indexing audit rows
//   - POST /admin/indexing/enqueue: queue one explicit record for indexing
//   - POST /admin/reindex: re-sync all or filtered documents into the FTS index
package main
