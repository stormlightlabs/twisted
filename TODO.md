# Twisted implementation tickets

These tickets implement the complete [product specification](ROADMAP.md) and
the [Bobbin API contract](docs/api.md). Work on one ticket per fresh agent
context. A ticket is complete only when its acceptance criteria and listed
checks pass.

## Milestone 1: Foundations

Gives the app has a typed, tested read boundary, stable shell, theme engine, and live
API contract checks.

### T01 - Replace starter tests with a reliable test baseline

Removed placeholder expectations and establish shared Vitest and Cypress fixtures for
route-level feature work.

### T02 - Add the typed Bobbin client boundary

Added atcute dependencies and one configurable XRPC boundary with runtime record
validation, abort support, pagination, and typed errors.

### T03 - Add live Bobbin smoke tests with Hurl

Created a read-only Hurl suite using the approved `desertthunder.dev` fixture and
documented how to run it.

### T04 - Build the Base16 theme engine

Maps validated Base16 schemes to semantic Ionic and app CSS tokens, with bundled
defaults, JSON import, selection, and persistence.

### T05 - Replace the starter screen with the application shell

Added responsive navigation, route layouts, settings, back behavior, safe areas, and
stable deep-link routing for every specified domain.

### T06 - Add coverage, caching, and shared request states

Added in-memory request deduplication, explicit stale times, cursor guards, coverage
notices, and shared loading/error/empty components.

### T07 - Render Markdown and record links safely

Added sanitized Markdown, safe link handling, common record headers, identifier copying,
and canonical Tangled links.

## Milestone 2: Complete read-only client

**Exit criterion:** Every public, user-relevant Bobbin record and query family
in the specification has a navigable read view.

### T08 - Build discovery and filtered search

Added identifier entry, mixed full-text results, every Bobbin
search filter, coverage state, and cursor pagination.

### T09 - Build complete profile pages

Resolves handle or DID and render profile metadata, pinned
repositories, owned repositories, links, and independently loading sections.

### T10 - Build actor activity dashboards

Exposes every actor-oriented `*By` query as typed, paginated
activity sections linked to their subject records.

### T11 - Build repository overview pages

Renders repository identity, topics, links, knot, spindle,
languages, README, labels, counts, collaborators, and recent ref activity.

### T12 - Browse repository trees and blobs

Add ref-aware directory navigation and safe text, binary, large-file, and missing-blob
views.

### T13 - Browse branches, tags, commits, and ref updates

Adds paginated refs and commit history, path-filtered logs, commit details, and
ref-update records.

### T14 - Render diffs, compares, and archive downloads

Add single-ref diffs, two-revision comparison, readable patch
output, and streamed archive downloads.

### T15 - Read issue lists and details

Added repo issue filters, pagination, detail pages, derived state, state history,
labels, mentions, and references.

### T16 - Read pull lists and details

Added repo pull filters, pagination, detail pages, derived
status, status history, target/source data, and patch links.

### T17 - Read comments and reactions

Added paginated discussion and reaction views for issues, pulls, strings, and other
valid subjects.

### T18 - Read stars, follows, vouches, and collaborators

**Status:** Complete

**What to build:** Add relationship views for repo stars, actor follows and
vouches, and repo collaborators, with links to both ends of each edge.

**Blocked by:** T09, T11

**Acceptance criteria:**

- [x] Inbound and actor-authored directions have distinct labels.
- [x] Counts, distinct-author counts, lists, and cursors render consistently.
- [x] Missing profiles or repos do not hide the relationship record.
- [x] Profile and repo summaries link to the full relationship views.

**Verification:** `bun run test:unit --run && bun run build`

### T19 - Read pipelines, statuses, and artifacts

**Status:** Complete

**What was built:** Added repo and spindle pipeline lists, pipeline details,
status history, artifact metadata, and streamed artifact downloads.

**Blocked by:** T11

**Acceptance criteria:**

- [x] Repo and spindle subject forms are validated and labeled.
- [x] Pipeline status history links actors and related records.
- [x] Artifact downloads preserve upstream content metadata and avoid buffering large bodies.
- [x] Empty, running, failed, unavailable, and incomplete-index states are covered.

**Verification:** `bun run test:unit --run && bun run build`

### T20 - Read labels and Tangled strings

**Status:** Complete

**What was built:** Added label definition and operation views plus string
listing, detail, comment, and reaction flows.

**Blocked by:** T07, T11

**Acceptance criteria:**

- [x] Label scope, definition, operation author, target, and history are inspectable.
- [x] Repo label links open their definition when available.
- [x] Strings render safely and expose their valid discussion subjects.
- [x] Arbitrary scope identifiers are encoded and validated at the API boundary.

**Verification:** `bun run test:unit --run && bun run build`

### T21 - Read knots, spindles, memberships, and public keys

**Status:** Complete

**What was built:** Added public infrastructure views for owned services,
members, owners, versions, knot keys, actor public keys, and freshness limits.

**Blocked by:** T09, T11

**Acceptance criteria:**

- [x] Knot and spindle lists and memberships support every documented direction.
- [x] Bobbin's extra knot proxy parameter uses a narrow typed overlay.
- [x] Owners, versions, service keys, and actor public keys have copyable identifiers.
- [x] Views disclose that Bobbin coverage does not prove knot-roster freshness.
- [x] No secret-list or management endpoint is called.

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
