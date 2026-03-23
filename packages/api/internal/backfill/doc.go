// Package backfill provides graph bootstrap tooling for Twister.
//
// # Backfill Runbook
//
// This runbook covers initial graph bootstrap and repeat runs using:
//
//	twister backfill
//
// # Seeds Input
//
// The `--seeds` flag supports either of these forms:
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
//  1. Copy and customize seeds:
//
//     cp docs/api/seeds.txt /tmp/twister-seeds.txt
//
//  2. Run dry-run first:
//
//     twister backfill --seeds /tmp/twister-seeds.txt --max-hops 2 --dry-run
//
//  3. Run real backfill:
//
//     twister backfill --seeds /tmp/twister-seeds.txt --max-hops 2 --concurrency 5 --batch-size 10 --batch-delay 1s
//
// Watch logs for seed count, hop-level discoveries, already-tracked vs submitted
// users, and batch progress totals.
//
// # Repeat Run
//
// Append new candidate users to the seed source, run dry-run, then run the real
// command again. Reruns are safe because discovery deduplicates in-memory and
// Tap /repos/add is treated as idempotent.
//
// # Dry-Run Safety
//
// Before production mutation:
//   - include --dry-run
//   - confirm only discovery output appears
//   - confirm no Tap mutation side effects
package backfill
