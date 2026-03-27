// Twister is the Tap-backed indexing and search API for Tangled.
//
// Requirements
//
//   - Go 1.25+
//   - PostgreSQL for the normal local and production workflow
//
// Running locally
//
//	cd /Users/owais/Projects/Twisted
//	just db-up
//	just api-dev
//	just api-run-indexer
//
// The default local database URL is:
//
//	postgresql://localhost/${USER}_dev?sslmode=disable
//
// That matches a Postgres.app-style setup and the repo's dev compose file.
//
// # Legacy fallback
//
// `--local` is deprecated and switches the service to the temporary SQLite
// fallback at packages/api/twister-dev.db.
//
//	go run . api --local
//
// Smoke checks
//
//	uv run --project packages/scripts/api twister-api-smoke
//
// Optional base URL override:
//
//	TWISTER_API_BASE_URL=http://localhost:8080 \
//	  uv run --project packages/scripts/api twister-api-smoke
//
// Environment variables
//
//   - DATABASE_URL: primary database connection URL
//   - HTTP_BIND_ADDR: API bind address, default :8080
//   - INDEXER_HEALTH_ADDR: indexer health bind address, default :9090
//   - LOG_LEVEL: debug, info, warn, or error
//   - LOG_FORMAT: json or text
//   - TAP_URL: Tap WebSocket URL, default ws://localhost:2480/channel in local indexer runs
//   - TAP_AUTH_PASSWORD: Tap admin password, default twisted-dev in local indexer runs
//   - INDEXED_COLLECTIONS: comma-separated AT collections to index
//   - READ_THROUGH_MODE: off or missing; default missing
//   - READ_THROUGH_COLLECTIONS: read-through allowlist
//   - READ_THROUGH_MAX_ATTEMPTS: retries before dead_letter
//   - ENABLE_ADMIN_ENDPOINTS: default false
//   - ADMIN_AUTH_TOKEN: bearer token for admin routes
//
// CLI commands
//
//	twister api
//	twister indexer
//	twister backfill
//	twister reindex
//	twister enrich
//	twister healthcheck
//
// # Deployment
//
// Production uses Coolify for the `api`, `indexer`, and `tap` services plus a
// separate Coolify-managed PostgreSQL resource. See docs/reference/deployment-walkthrough.md.
package main
