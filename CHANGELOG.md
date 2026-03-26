# CHANGELOG

## v0.1.1

### Changed

- Issue's no longer link but now show the AT URI in the docs.

## v0.1.0 (API)

### Added

#### 2026-03-22

- Profile screen with a list of repositories, follower, and following counts
- Jump to profile or repository (Home screen)

#### 2026-03-23

- [Constellation](http://constellation.microcosm.blue) integration for star and follower counts in search results and profile summaries
- [Tap](https://github.com/bluesky-social/indigo/blob/main/cmd/tap/README.md) integration for indexing new records in real-time
- Search (full-text search) over indexed records with public API and documentation site.

#### 2026-03-24

- Full XRPC client for GET requests to upstream PDS and knot APIs, with proxy endpoints in the API server

#### 2026-03-25

- Readthrough indexing job queue for API-fetched records (e.g. enrichment, backfill)
