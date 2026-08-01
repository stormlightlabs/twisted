# Twisted implementation tickets

These tickets implement the complete [product specification](ROADMAP.md) and
the [Bobbin API contract](docs/api.md). Work on one ticket per fresh agent
context. A ticket is complete only when its acceptance criteria and listed
checks pass.

## Milestone 1: Foundations

**Exit criterion:** The app has a typed, tested read boundary, stable shell,
theme engine, and live API contract checks.

### T01 - Replace starter tests with a reliable test baseline

**Status:** Complete

**What to build:** Remove placeholder expectations and establish shared Vitest
and Cypress fixtures for route-level feature work.

**Blocked by:** None - can start immediately

**Acceptance criteria:**

- [x] Unit and component tests can mount Ionic route components without warnings.
- [x] Cypress starts against the Vite app and intercepts XRPC requests.
- [x] Starter copy and example fixtures are removed.

**Verification:** `bun run test:unit --run && bun run lint`

### T02 - Add the typed Bobbin client boundary

**Status:** Complete

**What to build:** Add atcute dependencies and one configurable XRPC boundary
with runtime record validation, abort support, pagination, and typed errors.

**Blocked by:** T01

**Acceptance criteria:**

- [x] Tangled and Microcosm ambient declarations type every published query.
- [x] Embedded records are validated with generated atcute schemas before use.
- [x] Coverage and knot-proxy differences use narrow local overlays; views use no raw `fetch`.
- [x] Unit tests cover validation, malformed records, aborts, and XRPC error mapping.

**Verification:** `bun run test:unit --run && bun run build`

### T03 - Add live Bobbin smoke tests with Hurl

**Status:** Complete

**What to build:** Create a read-only Hurl suite using the approved
`desertthunder.dev` fixture and document how to run it.

**Blocked by:** None - can start immediately

**Acceptance criteria:**

- [x] Tests cover coverage, identity, profile, repo lookup/listing, search,
      one aggregation, and one Git proxy query.
- [x] Assertions use stable identifiers and shapes, never CIDs, counts, branch names, or mutable prose.
- [x] Tests run sequentially with delay and bounded retry to respect the hosted rate limit.
- [x] `package.json` exposes a `test:smoke` script without installing Hurl as a JavaScript dependency.

**Verification:** `bun run test:smoke`

### T04 - Build the Base16 theme engine

**Status:** Complete

**What to build:** Map validated Base16 schemes to semantic Ionic and app CSS
tokens, with bundled defaults, JSON import, selection, and persistence.

**Blocked by:** T01

**Acceptance criteria:**

- [x] Invalid or incomplete schemes cannot replace the active theme.
- [x] A reviewed default recovers from absent or corrupt persisted data.
- [x] Bundled light and dark schemes meet WCAG AA for application-owned controls.
- [x] Unit tests cover parsing, token mapping, persistence, and recovery.

**Verification:** `bun run test:unit --run && bun run build`

### T05 - Replace the starter screen with the application shell

**Status:** Complete

**What to build:** Add responsive navigation, route layouts, settings, back
behavior, safe areas, and stable deep-link routing for every specified domain.

**Blocked by:** T01, T04

**Acceptance criteria:**

- [x] Desktop, narrow web, standalone PWA, and native-sized layouts remain usable.
- [x] Routes safely encode handles, DIDs, AT-URIs, refs, and paths.
- [x] Unknown routes and unsupported identifiers have useful recovery links.
- [x] Theme and API-service settings persist independently.

**Verification:** `bun run test:unit --run && bun run build`

### T06 - Add coverage, caching, and shared request states

**Status:** Complete

**What to build:** Add in-memory request deduplication, explicit stale times,
cursor guards, coverage notices, and shared loading/error/empty components.

**Blocked by:** T02, T05

**Acceptance criteria:**

- [x] Route changes abort obsolete work and concurrent identical calls share one request.
- [x] `400`, `404`, `429`, `502`, `503`, offline, and malformed-data states remain distinct.
- [x] Retryable errors preserve existing content and respect `Retry-After` when present.
- [x] `ready: false` keeps partial indexed results visible with an explanation.

**Verification:** `bun run test:unit --run && bun run build`

### T07 - Render Markdown and record links safely

**Status:** Complete

**What to build:** Add sanitized Markdown, safe link handling, common record
headers, identifier copying, and canonical Tangled links.

**Blocked by:** T01

**Acceptance criteria:**

- [x] Markdown uses Satteri and DOMPurify with restricted URL schemes.
- [x] Scriptable HTML, SVG, styles, and unsafe links are removed in security tests.
- [x] Mentions, references, AT-URIs, DIDs, and known Tangled URLs link to local views.
- [x] Unknown record types remain inspectable without unsafe generic HTML.

**Verification:** `bun run test:unit --run && bun run build`

## Milestone 2: Complete read-only client

**Exit criterion:** Every public, user-relevant Bobbin record and query family
in the specification has a navigable read view.

### T08 - Build discovery and filtered search

**Status:** Complete

**What to build:** Add identifier entry, mixed full-text results, every Bobbin
search filter, coverage state, and cursor pagination.

**Blocked by:** T06, T07

**Acceptance criteria:**

- [x] Handle, DID, repo DID, AT-URI, and Tangled URL input routes correctly.
- [x] Search preserves relevance order and supports NSID, author, repo, and date filters.
- [x] Empty, invalid-filter, incomplete-index, and next-page states are tested.
- [x] Search result records are schema-validated before rendering.

**Verification:** `bun run test:unit --run && bun run build`

### T09 - Build complete profile pages

**Status:** Complete

**What to build:** Resolve handle or DID and render profile metadata, pinned
repositories, owned repositories, links, and independently loading sections.

**Blocked by:** T06, T07

**Acceptance criteria:**

- [x] Bidirectionally resolved handle, DID, profile fields, avatar, and links render safely.
- [x] Pinned repo DIDs resolve without losing their configured order.
- [x] Repository pagination and per-section failures do not blank the profile.
- [x] The `desertthunder.dev` fixture works in a live development check.

**Verification:** `bun run test:unit --run && bun run build`

### T10 - Build actor activity dashboards

**What to build:** Expose every actor-oriented `*By` query as typed, paginated
activity sections linked to their subject records.

**Blocked by:** T09

**Acceptance criteria:**

- [ ] Comments, reactions, stars, issues, pulls, states, statuses, and ref updates are covered.
- [ ] Collaborator, label, pipeline, artifact, knot, and spindle authorings are covered.
- [ ] Filters supported by issue and pull `*By` endpoints are available.
- [ ] One section's failure does not block other activity sections.

**Verification:** `bun run test:unit --run && bun run build`

### T11 - Build repository overview pages

**What to build:** Render repository identity, topics, links, knot, spindle,
languages, README, labels, counts, collaborators, and recent ref activity.

**Blocked by:** T06, T07

**Acceptance criteria:**

- [ ] Repo record AT-URI and repo DID remain visibly distinct and copyable.
- [ ] README Markdown is sanitized and absent README data has a compact empty state.
- [ ] Overview sections load independently and link to their full views.
- [ ] Canonical Tangled and clone/download actions are unambiguous and read-only.

**Verification:** `bun run test:unit --run && bun run build`

### T12 - Browse repository trees and blobs

**What to build:** Add ref-aware directory navigation and safe text, binary,
large-file, and missing-blob views.

**Blocked by:** T11

**Acceptance criteria:**

- [ ] Directory navigation preserves ref and path in a shareable URL.
- [ ] Text has line numbers, anchors, wrap controls, and a tested size limit.
- [ ] Binary and oversized files offer download or canonical links without unsafe rendering.
- [ ] Tree and blob upstream failures retain repository navigation.

**Verification:** `bun run test:unit --run && bun run build`

### T13 - Browse branches, tags, commits, and ref updates

**What to build:** Add paginated refs and commit history, path-filtered logs,
commit details, and ref-update records.

**Blocked by:** T11

**Acceptance criteria:**

- [ ] Branch and tag selection updates source and history routes.
- [ ] Commit cursors append once and preserve order.
- [ ] Author, time, hash, message, and changed-ref links remain readable on narrow screens.
- [ ] Empty repositories and missing refs have explicit states.

**Verification:** `bun run test:unit --run && bun run build`

### T14 - Render diffs, compares, and archive downloads

**What to build:** Add single-ref diffs, two-revision comparison, readable patch
output, and streamed archive downloads.

**Blocked by:** T11

**Acceptance criteria:**

- [ ] Refs are encoded safely and comparison direction is clear.
- [ ] Large diffs degrade to download or canonical links without locking the UI.
- [ ] Archive bodies stream to download and are never buffered as app state.
- [ ] Range, cache, filename, and content-type metadata survive the API boundary.

**Verification:** `bun run test:unit --run && bun run build`

### T15 - Read issue lists and details

**What to build:** Add repo issue filters, pagination, detail pages, derived
state, state history, labels, mentions, and references.

**Blocked by:** T11

**Acceptance criteria:**

- [ ] State and author filters round-trip through the URL.
- [ ] Lists use Bobbin's derived state and comment count.
- [ ] Details use rkeys as identifiers and never invent sequential numbers.
- [ ] State history names its author and timestamp when available.

**Verification:** `bun run test:unit --run && bun run build`

### T16 - Read pull lists and details

**What to build:** Add repo pull filters, pagination, detail pages, derived
status, status history, target/source data, and patch links.

**Blocked by:** T11

**Acceptance criteria:**

- [ ] Open, closed, and merged filters round-trip through the URL.
- [ ] Lists use Bobbin's derived status and comment count.
- [ ] Pull rkeys remain the displayed identifiers.
- [ ] Source, target, comparison, and status-author links resolve correctly.

**Verification:** `bun run test:unit --run && bun run build`

### T17 - Read comments and reactions

**What to build:** Add paginated discussion and reaction views for issues,
pulls, strings, and other valid subjects.

**Blocked by:** T15, T16

**Acceptance criteria:**

- [ ] Canonical feed records and documented legacy issue/pull comment aliases render.
- [ ] Comments use sanitized markup and link authors, mentions, and references.
- [ ] Reaction summaries and full actor lists agree with count/list endpoints.
- [ ] Independent pagination and failure handling work on each thread.

**Verification:** `bun run test:unit --run && bun run build`

### T18 - Read stars, follows, vouches, and collaborators

**What to build:** Add relationship views for repo stars, actor follows and
vouches, and repo collaborators, with links to both ends of each edge.

**Blocked by:** T09, T11

**Acceptance criteria:**

- [ ] Inbound and actor-authored directions have distinct labels.
- [ ] Counts, distinct-author counts, lists, and cursors render consistently.
- [ ] Missing profiles or repos do not hide the relationship record.
- [ ] Profile and repo summaries link to the full relationship views.

**Verification:** `bun run test:unit --run && bun run build`

### T19 - Read pipelines, statuses, and artifacts

**What to build:** Add repo/spindle pipeline lists, pipeline details, status
history, artifact metadata, and safe artifact downloads.

**Blocked by:** T11

**Acceptance criteria:**

- [ ] Repo and spindle subject forms are validated and labeled.
- [ ] Pipeline status history links actors and related records.
- [ ] Artifact downloads preserve upstream content metadata and avoid buffering large bodies.
- [ ] Empty, running, failed, unavailable, and incomplete-index states are covered.

**Verification:** `bun run test:unit --run && bun run build`

### T20 - Read labels and Tangled strings

**What to build:** Add label definition/operation views and string detail,
listing, comment, and reaction flows.

**Blocked by:** T07, T11

**Acceptance criteria:**

- [ ] Label scope, definition, operation author, target, and history are inspectable.
- [ ] Repo label links open their definition when available.
- [ ] Strings render safely and expose their valid discussion subjects.
- [ ] Arbitrary scope identifiers are encoded and validated at the API boundary.

**Verification:** `bun run test:unit --run && bun run build`

### T21 - Read knots, spindles, memberships, and public keys

**What to build:** Add public infrastructure views for owned services, members,
owners, versions, knot keys, actor public keys, and freshness limitations.

**Blocked by:** T09, T11

**Acceptance criteria:**

- [ ] Knot and spindle lists and memberships support every documented direction.
- [ ] Bobbin's extra knot proxy parameter uses a narrow typed overlay.
- [ ] Owners, versions, service keys, and actor public keys have copyable identifiers.
- [ ] Views disclose that Bobbin coverage does not prove knot-roster freshness.
- [ ] No secret-list or management endpoint is called.

**Verification:** `bun run test:unit --run && bun run build`

## Milestone 3: Web and PWA release quality

**Exit criterion:** The complete web client is installable, accessible,
responsive, deterministic under test, and honest about offline or stale data.

### T22 - Make Twisted an installable PWA

**What to build:** Add manifest, install/update handling, icons, theme colors,
and an offline application shell with explicit online-data states.

**Blocked by:** T05

**Acceptance criteria:**

- [ ] Browser install checks pass with the final app identity and assets.
- [ ] A previously loaded shell opens offline and identifies unavailable live data.
- [ ] Service-worker updates never strand the app on mixed asset versions.
- [ ] API payloads are not persisted by the service worker.

**Verification:** `bun run build` and a browser PWA audit

### T23 - Cover complete user journeys in Cypress

**What to build:** Add intercepted end-to-end journeys for discovery, profiles,
repos, source, collaboration, activity, infrastructure, settings, and failures.

**Blocked by:** T08-T21

**Acceptance criteria:**

- [ ] Tests never depend on the live Bobbin service.
- [ ] Fixtures cover success, partial, empty, invalid-record, offline, rate-limit, and upstream errors.
- [ ] Theme persistence, deep links, pagination guards, and back navigation are covered.
- [ ] At least one narrow viewport exercises every primary route family.

**Verification:** Start `bun run dev`, then run `bun run test:e2e`

### T24 - Complete accessibility and responsive review

**What to build:** Audit every route family for keyboard, screen-reader,
contrast, zoom, reduced motion, touch targets, safe areas, and long content.

**Blocked by:** T08-T23

**Acceptance criteria:**

- [ ] All interactive elements have an accessible name, focus state, and logical order.
- [ ] Status changes and appended pages are announced without stealing focus.
- [ ] Reviewed themes meet WCAG 2.2 AA and imported low-contrast themes warn the user.
- [ ] Layout works at 320 CSS pixels, 200% zoom, and common tablet/desktop widths.

**Verification:** `bun run test:unit --run && bun run test:e2e` plus manual assistive-technology review

## Milestone 4: Native apps

**Exit criterion:** Android and iOS packages launch the complete client and pass
platform smoke checks without product-specific forks.

### T25 - Package and verify Android

**What to build:** Add the Capacitor Android project, final identity/assets,
safe-area/status-bar behavior, external links, downloads, and back navigation.

**Blocked by:** T22, T24

**Acceptance criteria:**

- [ ] Debug build installs and launches on a supported emulator or device.
- [ ] Search, profile, repo, source, issue/pull, theme, and offline-shell smoke checks pass.
- [ ] External URLs and streamed downloads use an explicit safe platform flow.
- [ ] Native code contains no API secrets or feature fork.

**Verification:** `bun run build && bunx cap sync android` plus the documented Android debug build

### T26 - Package and verify iOS

**What to build:** Add the Capacitor iOS project with the same product behavior,
final assets, safe areas, status bar, external links, and downloads.

**Blocked by:** T25

**Acceptance criteria:**

- [ ] Simulator build launches on a supported iOS runtime.
- [ ] The Android smoke flows pass on iOS without platform-specific feature gaps.
- [ ] Rotation, dynamic type, safe areas, external links, and downloads behave correctly.
- [ ] Signing and provisioning requirements are documented without committing credentials.

**Verification:** `bun run build && bunx cap sync ios` plus the documented iOS simulator build

### T27 - Run the release verification matrix

**What to build:** Verify the complete contract and user experience across web,
PWA, Android, and iOS and resolve release-blocking regressions.

**Blocked by:** T03, T23, T24, T25, T26

**Acceptance criteria:**

- [ ] Lint, unit/component, build, Cypress, and Hurl checks pass.
- [ ] A maintainer reviews live-test failures for fixture drift or upstream outage before classifying them.
- [ ] Manual checks cover installation, update, offline shell, theme recovery, downloads, and canonical links.
- [ ] Documentation matches the shipped routes, commands, API exceptions, and platform support.

**Verification:** Run every command in `ROADMAP.md` and the documented native build commands
