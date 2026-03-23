# Phase 3 — Deferred Search and Activity

## Goal

Preserve honest product boundaries before search is implemented as a separate project. Public browsing continues through known AT Protocol handles on Home, while Explore and Activity stay visible as clearly labeled in-progress placeholders.

## Current Product Shape

### Home

Home is the temporary public entry point for unauthenticated browsing:

- Enter a known AT Protocol handle
- Open that user's profile directly
- Resolve the handle to DID + PDS via AT Protocol identity
- List that user's public Tangled repos inline and open one directly

This keeps public browsing fully real without implying that global discovery already exists.

### Explore

Explore remains a tab-level placeholder:

- No global repo search
- No global user search
- No curated fallback discovery pretending to be search
- Empty state should explicitly say search is in progress

### Activity

Activity also remains a tab-level placeholder:

- No public timeline yet
- No curated public feed fallback
- Empty state should explicitly say activity is in progress

## Identity and Routing

The Home handle flow continues to use the existing AT Protocol resolution path:

1. Resolve `handle -> DID` via `com.atproto.identity.resolveHandle`
2. Fetch the DID document and extract the PDS endpoint
3. Query the user's PDS for `sh.tangled.repo` records via `com.atproto.repo.listRecords`
4. Route to existing profile and repo detail screens

No backend search index, feed service, or additional dependency is introduced in this phase.

## UI Expectations

- Home shows one handle input plus explicit actions for profile jump and repo browsing
- Home shows loading, invalid-handle, no-repos, and resolved-repo-list states
- Explore shows a static in-progress empty state
- Activity shows a static in-progress empty state
- Profile remains unchanged

## Deferred Work

The following work is intentionally deferred out of this phase:

- Search indexing and ranking
- Search result UI and recent searches
- Trending or suggested discovery sections
- Public activity feed ingestion, pagination, and caching
- Jetstream or appview timeline investigation

These capabilities will be revisited when search and feed work are scheduled independently.
