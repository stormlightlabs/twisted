// Package backfill provides Tap bootstrap tooling for Twister.
//
// # Backfill runbook
//
// The default command is:
//
//	twister backfill
//
// `--source lightrail` is the default and discovers DIDs from
// com.atproto.sync.listReposByCollection. `--source graph` remains available for
// targeted fallback runs.
//
// # Graph seeds input
//
// The `--seeds` flag applies only to `--source graph` and accepts either:
//
//  1. a file path
//  2. a comma-separated list of DIDs or handles
//
// Prerequisites
//
//   - DATABASE_URL
//   - TAP_URL
//   - TAP_AUTH_PASSWORD
//
// Typical bootstrap
//
//  1. twister backfill --dry-run
//  2. twister backfill
//  3. twister enrich
//  4. twister reindex
//
// In local development, docker-compose.dev.yaml runs Tap on
// ws://localhost:2480/channel.
//
// Re-run backfill whenever you need to reseed the authoritative Tap corpus.
package backfill
