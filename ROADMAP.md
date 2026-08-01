---
title: Twisted product and implementation specification
status: ready
---

# Twisted roadmap

## Objective

Twisted is a read-only Tangled client with its own responsive interface. It
runs as a website, installable PWA, and Capacitor app for Android and iOS. Users
can browse the full public Tangled dataset exposed by Bobbin without signing in
or sending writes to a PDS or knot.

The first release must make Tangled useful as a reading and discovery tool. It
includes repository hosting data, social records, collaboration records,
pipelines, labels, strings, and infrastructure views. Mobile packaging follows
the complete web/PWA experience; it does not reduce the product scope.

## Success criteria

- A user can resolve a handle or DID, open a profile, and navigate all public
  records associated with that actor.
- Search supports text, collection, author, repo, and date filters with cursor
  pagination.
- Repository pages expose metadata, source, refs, commits, diffs, downloads,
  issues, pulls, discussions, activity, labels, collaborators, CI, and
  artifacts.
- Dedicated views cover follows, vouches, stars, actor-authored activity,
  strings, knots, spindles, members, public keys, and other public
  infrastructure data exposed by Bobbin.
- Every API response uses atcute's generated types and schemas. Local types are
  limited to Bobbin-specific contracts that atcute does not publish.
- Loading, empty, incomplete-index, rate-limit, not-found, offline, and upstream
  failure states keep navigation usable and offer the right recovery action.
- The UI works with keyboard navigation and screen readers, honors reduced
  motion and safe areas, and meets WCAG 2.2 AA for application-owned colors and
  controls.
- Users can choose and persist a Base16 theme. The same theme works in light and
  dark system chrome, PWA mode, Android, and iOS.
- The PWA is installable and its application shell opens offline. Public
  Tangled data is presented as online data unless a later cache has a clear
  freshness policy.
- Unit, component, Cypress, and Hurl checks pass. Hurl verifies the live Bobbin
  contract against the approved `desertthunder.dev` fixture.
- Android and iOS builds launch, navigate, and render the same read-only flows
  as the PWA.

## Current state

The repository is an Ionic Vue starter using Vue 3, TypeScript, Vite 5,
Vue Router, Ionic 8, Capacitor 8, Vitest, Cypress, and ESLint. It contains one
placeholder page, no API client, no product navigation, and no meaningful test
coverage. Capacitor has a starter app identifier and no checked-in Android or
iOS project.

The API contract is documented in [docs/api.md](docs/api.md). Bobbin is a new,
read-only XRPC AppView whose hosted instance is `https://api.tangled.org`.

## Users and core flows

Twisted is for people who want to inspect Tangled on desktop or mobile without
logging in. A user can:

1. Search public Tangled records or enter a handle, DID, repo DID, or AT-URI.
2. Open a profile and browse its repositories, social graph, activity, public
   keys, knot memberships, and spindle memberships.
3. Open a repository and move among its overview, source, history, issues,
   pulls, CI, labels, collaborators, and activity.
4. Follow links among authors, subjects, state records, comments, reactions,
   pipelines, artifacts, knots, spindles, and strings without losing context.
5. Copy identifiers, open the canonical Tangled page, or download a repository
   archive. Actions that change data remain on Tangled.

## Product scope

### Discovery and identity

- Resolve handles and DIDs through Bobbin's typed Microcosm identity query.
- Accept complete Tangled and AT-URI links and route them to the matching view.
- Provide full-text search with every Bobbin filter and cursor pagination.
- Group mixed search hits by recognizable record type while preserving Bobbin's
  relevance order.
- Show Bobbin coverage when indexed results may be incomplete.

### Profiles and actor activity

- Render profile metadata, links, avatar, location, pronouns, pinned repos, and
  validated handle/DID information.
- List owned repositories, stars, follows, followers, vouches, and inbound
  vouches.
- Show actor-authored comments, reactions, issues, pulls, state changes, ref
  updates, collaborator records, label operations, pipelines, statuses,
  artifacts, and knot or spindle memberships through the `*By` endpoints.
- Use separate paginated sections so one failed endpoint does not blank the
  whole profile.

### Repositories and Git data

- Render repository metadata, topics, links, knot, spindle, labels, star count,
  collaborators, languages, and latest ref activity.
- Render sanitized Markdown README content when the tree response provides it.
- Browse branches, tags, trees, files, and commit history. Preserve the selected
  ref while moving through directories.
- Render text blobs with line numbers, anchors, wrapping controls, and a safe
  size limit. Offer download or canonical Tangled links for binary and oversized
  blobs.
- Show commits, path-filtered logs, single-ref diffs, and two-revision compares.
- Download streamed repository archives without loading the full archive into
  application memory.

### Collaboration and social records

- List and filter issues by current state and author; render issue details,
  state history, comments, reactions, labels, references, and mentions.
- List and filter pulls by current status and author; render pull details,
  status history, comments, reactions, patch information, and comparison data.
- Render comments and reactions on issues, pulls, and strings using canonical
  `sh.tangled.feed.*` records while accepting documented legacy aliases.
- Display stars, follows, vouches, collaborators, and ref updates with links to
  both ends of each relationship.
- Display rkeys as canonical issue and pull identifiers. Do not invent
  sequential numbers Bobbin does not supply.

### Pipelines, labels, strings, and infrastructure

- List pipelines for repos and spindles, their status histories, and artifacts.
- Display artifact metadata and stream downloads where the upstream response
  permits it.
- Display label definitions and label operation history for their scopes.
- Render Tangled strings and their comments or reactions.
- Browse public knots and spindles, their owners, versions, keys, and membership
  records. Clearly label data whose freshness Bobbin cannot report.
- Display public keys and service diagnostics without exposing management
  controls.

### Theme and platform behavior

- Represent each Base16 scheme as the sixteen canonical `base00` through
  `base0F` colors plus a stable id and display name.
- Map Base16 colors to semantic application and Ionic CSS custom properties.
  Components consume semantic tokens rather than palette slots.
- Ship a small set of reviewed light and dark schemes, support user-imported
  Base16 JSON, validate imports, and persist the selected scheme locally.
- Fall back to a reviewed default when persisted data is absent or invalid.
- Use responsive Ionic layouts, native safe-area insets, platform back behavior,
  and touch targets of at least 44 by 44 CSS pixels.
- Install as a PWA with manifest metadata and an offline application shell.
- Package the completed PWA for Android first and iOS second with a final app id,
  name, icons, splash assets, status-bar treatment, and external-link policy.

## Information architecture

The router must use stable, shareable URLs and encode opaque identifiers safely.
Routes should cover:

- discovery and search;
- profiles by handle or DID;
- repository overview by repo record AT-URI;
- source tree, blob, commits, branches, tags, diff, and compare;
- issue and pull lists and details;
- pipelines and artifacts;
- actor activity and relationship views;
- strings, knots, spindles, labels, and public-key diagnostics;
- settings for theme, API service, and application information.

Keep query filters and cursors in route query parameters when doing so produces
a useful shareable URL. Do not expose opaque cursors as human identifiers.

## Technical plan

### API and types

- Add `@atcute/client` `5.1.1`, `@atcute/tangled` `2.0.13`,
  `@atcute/microcosm` `2.0.2`, and an explicit compatible
  `@atcute/lexicons` dependency.
- Register Tangled and Microcosm ambient XRPC declarations once.
- Put the atcute client, endpoint wrappers, runtime validation, error mapping,
  abort handling, and configuration in one API boundary. Views must not issue
  raw `fetch` calls.
- Validate every embedded `value: unknown` with its generated atcute schema
  before mapping it for display.
- Keep a local type for `sh.tangled.bobbin.getCoverage` until atcute publishes
  the lexicon. Use small typed parameter overlays for Bobbin's documented knot
  proxy differences instead of copying generated response models.
- Default to `https://api.tangled.org`; allow an advanced user to set another
  HTTPS Bobbin instance and restore the default.

### Application structure and state

- Organize code by domain: API boundary, shared record views, features, router,
  theme, and platform integration.
- Use Vue composables and component-local state. Add a global state library only
  if implementation proves that shared state cannot stay simple.
- Cache successful GET responses in memory by NSID plus normalized parameters.
  Deduplicate concurrent requests and use short, explicit stale times. Never
  persist API payloads until the product defines cache invalidation and privacy
  behavior.
- Each request accepts an `AbortSignal`. Route changes cancel obsolete work.
- Cursor lists append pages without changing earlier item order and prevent
  duplicate requests for the same cursor.

### Content safety

- Render Markdown through `marked` `18.0.7`, sanitize the result with DOMPurify
  `3.4.12`, and restrict URL schemes before inserting HTML.
- Treat repository blobs as untrusted text or bytes. Never execute HTML,
  JavaScript, SVG scripts, or repository-provided styles.
- Open external links with an explicit external-browser policy and safe opener
  settings. Encode identifiers when constructing routes and query strings.

### PWA and native apps

- Add `vite-plugin-pwa` `1.3.0` for manifest generation, installation, update
  handling, and application-shell caching.
- Do not use a service worker to hide Bobbin freshness or failure states.
- Add `@capacitor/android` and `@capacitor/ios` versions compatible with the
  existing Capacitor 8 packages. Keep web behavior as the source of truth.
- Native builds need no authentication, secrets, background jobs, analytics,
  or push notifications.

## Testing plan

### Stable boundaries

- Unit tests cover identifier parsing, endpoint mapping, embedded-record
  validation, pagination, caching, error classification, Markdown safety, and
  Base16 validation or token mapping.
- Component tests mount each route-level state against a fake API boundary.
  They cover success, empty, partial, loading, malformed record, and retryable
  failure states without calling the network.
- Cypress covers user-visible journeys against deterministic intercepted XRPC
  fixtures: search to profile, profile to repo, source browsing, issue and pull
  reading, activity or infrastructure navigation, theme persistence, and PWA
  routing.
- [Hurl](https://github.com/Orange-OpenSource/hurl) `8.0.1` is the live contract
  boundary. It checks Bobbin coverage, identity
  resolution, profile lookup, repo listing and lookup, search, one aggregation,
  and one knot-proxied Git query.

### Hurl fixture policy

Use this approved public fixture:

```text
handle=desertthunder.dev
actor_did=did:plc:xg2vq45muivyy3xwatcehspu
profile_uri=at://did:plc:xg2vq45muivyy3xwatcehspu/sh.tangled.actor.profile/self
repo_uri=at://did:plc:xg2vq45muivyy3xwatcehspu/sh.tangled.repo/3mho6hukiei22
repo_did=did:plc:4iw5fospv2asv3344au236ka
```

Hurl asserts status, content type, stable identifiers, `$type`, and response
shape. It must not assert mutable CIDs, counts, descriptions, dates, branch
names, or list contents. Run files sequentially with a delay and bounded retry
to respect Bobbin's hosted rate limit. A live-data failure blocks release only
after a maintainer distinguishes an upstream outage or fixture change from a
Twisted contract regression.

### Commands

```sh
npm install
npm run lint
npm run test:unit -- --run
npm run build
npm run dev
npm run test:e2e
hurl --test --jobs 1 --delay 250ms --retry 2 --retry-interval 2s tests/smoke
npx cap sync
```

The Cypress command requires the dev server at `http://localhost:5173`. Native
release tickets must add the exact Android and iOS build commands once those
platform projects exist.

## Delivery milestones

1. Establish the typed Bobbin boundary, live contract checks, theme engine, and
   application shell.
2. Complete discovery, profiles, repository reading, collaboration, social,
   activity, pipelines, labels, strings, and infrastructure views.
3. Add PWA installation, offline shell behavior, responsive and accessibility
   review, and deterministic end-to-end coverage.
4. Package and verify Android, then iOS, without forking product behavior.

Every capability listed in this specification has a ticket in [TODO.md](TODO.md).

## Boundaries

### Always

- Keep the client read-only and unauthenticated.
- Use atcute types and generated validators for published lexicons.
- Preserve partial results and identify incomplete or stale data.
- Sanitize untrusted content and test keyboard, narrow-screen, and error states.
- Keep Git operations read-only when working in this repository.

### Ask first

- Add a backend, proxy, database, global state library, analytics, telemetry,
  authentication, or push notifications.
- Persist Bobbin payloads or change the public route scheme.
- Use undocumented Bobbin endpoints beyond the documented compatibility
  overlays.

### Never

- Call XRPC procedures or any endpoint that writes to a PDS or knot.
- Call `sh.tangled.repo.listSecrets`, store credentials, or expose secret
  metadata.
- Render unsanitized Markdown, repository HTML, or executable SVG.
- Convert rkeys into invented sequential issue or pull numbers.

## Risks and open questions

- Bobbin and its lexicons are changing quickly. Package updates require a route
  inventory review, generated-type compile check, and Hurl run.
- Coverage describes Hydrant ingestion but cannot prove that knot membership is
  fresh. Infrastructure views must disclose this limitation.
- The public fixture will evolve. Shape-based smoke assertions and documented
  fixture ownership reduce brittleness but do not remove it.
- Base16 palettes do not guarantee accessible semantic combinations. Reviewed
  bundled themes must pass contrast tests; imported themes need warnings and a
  recovery path.
- iOS distribution requires signing and Apple provisioning outside this
  repository. The build can be verified before store publication is available.
