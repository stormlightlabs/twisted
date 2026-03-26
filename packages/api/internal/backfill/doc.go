// Package backfill provides Tap bootstrap tooling for Twister.
//
// # Backfill Runbook
//
// This runbook covers initial bootstrap and repeat runs using:
//
//	twister backfill
//
// `--source lightrail` is the default and discovers DIDs from
// com.atproto.sync.listReposByCollection. `--source graph` keeps the older
// handle/DID seed crawl for targeted fallback runs.
//
// # Graph Seeds Input
//
// The `--seeds` flag applies only to `--source graph` and supports either of
// these forms:
//
//  1. File path:
//
//     twister backfill --seeds /etc/twister/seeds.txt
//
//  2. Comma-separated inline list:
//
//     twister backfill --seeds anirudh.fi,atprotocol.dev,oppi.li
//
// Supported seed entries are DIDs and handles.
//
// Repository-managed example seed file:
//
//	docs/api/seeds.txt
//
// Runtime seed file is typically mounted outside the repo, for example:
//
//	/etc/twister/seeds.txt
//
// # Prerequisites
//
// Required environment variables:
//
//   - TURSO_DATABASE_URL
//   - TURSO_AUTH_TOKEN (for non-file Turso URLs)
//   - TAP_URL
//   - TAP_AUTH_PASSWORD
//
// # First Bootstrap
//
//  1. Run full-network dry-run:
//
//     twister backfill --dry-run
//
//  2. Run real bootstrap:
//
//     twister backfill
//
//  3. Use graph mode only for targeted fallback:
//
//     twister backfill --source graph --seeds /tmp/twister-seeds.txt --max-hops 2
//
// Watch logs for discovery totals and Tap submission progress.
//
// # Repeat Run
//
// Re-run `twister backfill` whenever you need to reseed the authoritative Tap
// corpus. Append graph seeds only when using `--source graph`.
//
// # Dry-Run Safety
//
// Before production mutation:
//   - include --dry-run
//   - confirm only discovery output appears
//   - confirm no Tap mutation side effects
package backfill
