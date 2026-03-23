# Phase 3 — Indexed Search and Honest Discovery

## Goal

Introduce global discovery through the Twister project index while preserving honest product boundaries. Home continues to support direct known-handle browsing, Explore becomes index-backed search, and Activity remains a clearly labeled in-progress surface.

## Current Product Shape

### Home

Home is the temporary public entry point for unauthenticated browsing:

- Enter a known AT Protocol handle
- Open that user's profile directly
- Resolve the handle to DID + PDS via AT Protocol identity
- List that user's public Tangled repos inline and open one directly

This keeps public browsing fully real while still giving the app a lightweight direct-entry path.

### Explore

Explore becomes the network-level discovery surface:

- Global repo search via the Twister index
- Global profile search via the Twister index
- Empty state should clearly distinguish "index unavailable" from "no results"
- Search results route into the existing profile and repo detail screens

### Activity

Activity also remains a tab-level placeholder:

- No public timeline yet
- No curated public feed fallback
- Empty state should explicitly say activity is in progress

## Identity and Routing

The app now uses two read paths:

1. **Direct handle browsing**
   Resolve `handle -> DID` via `com.atproto.identity.resolveHandle`
   Fetch the DID document and extract the PDS endpoint
   Query the user's PDS for `sh.tangled.repo` records via `com.atproto.repo.listRecords`
2. **Indexed discovery**
   Query the Twister API for global search results
   Open the selected profile or repo in the existing screens
   Continue detail fetching from Tangled's public APIs

The Twister API is additive, not authoritative for repo detail. It fills discovery and graph gaps; knots and PDSes remain the source of truth for detail screens.

## UI Expectations

- Home shows one handle input plus explicit actions for profile jump and repo browsing
- Home shows loading, invalid-handle, no-repos, and resolved-repo-list states
- Explore shows a working search form, loading state, index-unavailable state, and no-results state
- Activity shows a static in-progress empty state
- Profile may show index-backed follower/following summaries when available

## Deferred Work

The following work is intentionally deferred out of this phase:

- Trending or suggested discovery sections
- Public activity feed ingestion, pagination, and caching
- Jetstream or appview timeline investigation

These capabilities will be revisited after the baseline search and graph-summary integration is stable.
