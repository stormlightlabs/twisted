# Tangled API

Twisted reads public Tangled data from Bobbin, Tangled's read-only XRPC
AppView. The hosted service is:

```text
https://api.tangled.org
```

Every XRPC method lives at `/xrpc/{nsid}` and uses `GET`. Bobbin does not
require authentication. The hosted service allows cross-origin `GET`, `HEAD`,
and `OPTIONS` requests, so Twisted can call it from a browser or Capacitor
WebView.

This document reflects Bobbin and `@atcute/tangled` as checked on 2026-08-01.
Bobbin is new and its contracts may change. Keep API calls behind one project
module so an upstream change does not leak into views.

## Sources of truth

Use these sources in this order:

1. [`@atcute/tangled` lexicons](https://github.com/mary-ext/atcute/tree/trunk/packages/definitions/tangled/lexicons/sh/tangled)
   define request parameters and response types. The package was at version
   `2.0.13` and atcute commit
   [`5474d2d`](https://github.com/mary-ext/atcute/commit/5474d2d9d502c4f52c8c13162fac8c2cd8613ec6)
   during this review.
2. [Bobbin's router](https://tangled.org/tangled.org/core/blob/master/bobbin/crates/xrpc/src/lib.rs)
   determines which lexicons the service implements. Twisted's compatibility
   review used Tangled core commit
   [`25d3c23e`](https://tangled.org/tangled.org/core/commit/25d3c23eacc81ec27e50ace3eaf608aa13e5d89f).
3. [Tangled's Bobbin documentation](https://docs.tangled.org/bobbin) explains
   runtime behavior, warm-up, and upstream failures. The
   [announcement](https://blog.tangled.org/bobbin/) gives the architectural
   background.
4. Twisted's pre-Bobbin client on `main`, reviewed at commit `7e205794`, is a
   migration reference for older record shapes. It is not an API contract:
   its `/actors/*`, `/issues/*`, and `/pulls/*` paths belonged to the retired
   Twister service.

The definition package contains Tangled queries and procedures that Bobbin does
not serve. A generated atcute type proves that a lexicon exists; it does not
prove that `api.tangled.org` implements it. In particular, Twisted must not call
the `sh.tangled.ci.*`, `sh.tangled.sync.*`, or `sh.tangled.git.temp.*` methods
through Bobbin.

## Typed client

Use `@atcute/client` for XRPC requests and register `@atcute/tangled` for its
ambient query declarations:

```ts
import { Client, simpleFetchHandler } from '@atcute/client'
import type {} from '@atcute/microcosm'
import type {} from '@atcute/tangled'

export const tangled = new Client({ handler: simpleFetchHandler({ service: 'https://api.tangled.org' }) })

const response = await tangled.get('sh.tangled.search.query', { params: { q: 'tangled', limit: 20 } })

if (!response.ok) {
	throw new Error(response.data.message ?? response.data.error)
}

const { hits, cursor } = response.data
```

The equivalent project-wide registration is
`/// <reference types="@atcute/tangled" />` in a declaration file. Do not copy
generated interfaces into Twisted. Import a named record type from
`@atcute/tangled` when a view or mapper needs one.

Bobbin's record views embed `value` as `unknown`. Narrow it with the generated
record schema before a view uses it:

```ts
import { is } from '@atcute/lexicons'
import { ShTangledRepo } from '@atcute/tangled'

if (!is(ShTangledRepo.mainSchema, response.data.value)) {
	throw new Error('Bobbin returned an invalid repository record')
}

const repo: ShTangledRepo.Main = response.data.value
```

Twisted uses `Client.call` so atcute also validates query parameters and the
published response envelope. Search is the one compatibility exception:
Bobbin returns a floating-point `score`, while the generated AT Protocol
`unknown` validator accepts object values. Twisted validates that envelope in
its API boundary and still requires a generated record schema for every search
hit before returning it to a feature.

`@atcute/tangled` does not yet define `sh.tangled.bobbin.getCoverage`. Keep the
following local exception beside the API client until upstream publishes that
lexicon:

```ts
export type BobbinCoverage = { ready: boolean; eventsProcessed: number; lastCursor: number }
```

Bobbin also exposes `com.bad-example.identity.resolveMiniDoc` for resolving a
handle or DID before constructing a Tangled profile AT-URI. Register
`@atcute/microcosm` to type this method; do not create another local identity
type.

## Identifiers

Bobbin uses three identifiers that should remain distinct in application code:

- An actor DID, such as `did:plc:boltless`, identifies an account.
- A repo DID identifies a git repository as minted by its knot. It is not the
  repository record's author DID.
- A record AT-URI includes the author DID, collection, and record key, such as
  `at://did:plc:boltless/sh.tangled.repo/squid`.

Single-record queries require a complete AT-URI. A handle or bare DID will not
work in `actor.getProfile`, `repo.getRepo`, `repo.getIssue`, or `repo.getPull`.
Git proxy calls also receive the repository record AT-URI from Twisted. Bobbin
resolves the record and forwards the matching repository to its knot.

Bobbin does not publish single-record lookups for strings or artifacts. For a
deep link to either record type, Twisted resolves the record author through
Bobbin, reads the record from that author's public PDS with
`com.atproto.repo.getRecord`, and validates the embedded value with the matching
generated Tangled schema. This read is limited to the expected collection from
the route; callers cannot use it as a generic record proxy.

## Common response shapes

Single-record methods return a record view:

```ts
interface RecordView<T> {
	uri: string
	cid?: string
	value: T
}
```

Batch lookups return `{ items: RecordView<T>[] }` and accept at most 50 AT-URIs.
List methods return `{ items: RecordView<T>[]; cursor?: string }`. Pass the
returned opaque cursor unchanged to fetch the next page. Most lists accept:

| Parameter | Meaning                                                     |
| --------- | ----------------------------------------------------------- |
| `subject` | Required DID, AT-URI, or service identifier described below |
| `limit`   | `1..1000`; defaults to `50`                                 |
| `order`   | `asc` or `desc` by `createdAt`; defaults to `desc`          |
| `cursor`  | Opaque cursor from the previous response                    |

Count methods return `{ count: number; distinctAuthors: number }`. Counts and
lists can be lower bounds while Bobbin warms its in-memory index.

An endpoint ending in `By` reverses the lookup. For example,
`listComments?subject={issue-uri}` lists comments on an issue, while
`listCommentsBy?subject={actor-did}` lists comments written by an actor.

## Record lookups

| NSID                               | Required parameter                      | Result           |
| ---------------------------------- | --------------------------------------- | ---------------- |
| `sh.tangled.actor.getProfile`      | `actor`: profile record AT-URI          | One profile      |
| `sh.tangled.actor.getProfiles`     | `actors`: up to 50 profile AT-URIs      | Profiles         |
| `sh.tangled.repo.getRepo`          | `repo`: repo record AT-URI              | One repository   |
| `sh.tangled.repo.getRepos`         | `repos`: up to 50 repo record AT-URIs   | Repositories     |
| `sh.tangled.repo.getRepoByRepoDid` | `repoDid`: repo DID                     | One repository   |
| `sh.tangled.repo.getIssue`         | `issue`: issue record AT-URI            | One issue        |
| `sh.tangled.repo.getIssues`        | `issues`: up to 50 issue record AT-URIs | Issues           |
| `sh.tangled.repo.getPull`          | `pull`: pull record AT-URI              | One pull request |
| `sh.tangled.repo.getPulls`         | `pulls`: up to 50 pull record AT-URIs   | Pull requests    |

`repo.listIssues` and `repo.listPulls` enrich each item with `commentCount`, the
derived state in `state`, and an optional `stateUpdatedAt`. Use those fields for
list badges. The single-record methods return the issue or pull record itself;
detail pages obtain current state or status from the corresponding history
list.

## Indexed lists and counts

Each row names a record family, the `subject` required by its non-`By` methods,
and its implemented methods. Add `By` to each listed `list*` or `count*` method
when an actor-DID reverse lookup is available.

| Family            | Non-`By` subject              | Methods                                             | Actor reverse lookup |
| ----------------- | ----------------------------- | --------------------------------------------------- | -------------------- |
| Repositories      | owner DID                     | `repo.listRepos`, `repo.countRepos`                 | No                   |
| Issues            | repo DID                      | `repo.listIssues`, `repo.countIssues`               | Yes                  |
| Pull requests     | repo DID                      | `repo.listPulls`, `repo.countPulls`                 | Yes                  |
| Comments          | issue, pull, or string AT-URI | `feed.listComments`, `feed.countComments`           | Yes                  |
| Reactions         | target record AT-URI          | `feed.listReactions`, `feed.countReactions`         | Yes                  |
| Stars             | repo DID                      | `feed.listStars`, `feed.countStars`                 | Yes                  |
| Ref updates       | repo DID                      | `git.listRefUpdates`, `git.countRefUpdates`         | Yes                  |
| Followers         | followed actor DID            | `graph.listFollows`, `graph.countFollows`           | Yes                  |
| Vouches           | vouched-for actor DID         | `graph.listVouches`, `graph.countVouches`           | Yes                  |
| Collaborators     | repo DID                      | `repo.listCollaborators`, `repo.countCollaborators` | Yes                  |
| Issue states      | issue AT-URI                  | `repo.issue.listStates`, `repo.issue.countStates`   | Yes                  |
| Pull statuses     | pull AT-URI                   | `repo.pull.listStatuses`, `repo.pull.countStatuses` | Yes                  |
| Artifacts         | repo or release identifier    | `repo.listArtifacts`, `repo.countArtifacts`         | Yes                  |
| Pipelines         | repo or spindle identifier    | `pipeline.listPipelines`, `pipeline.countPipelines` | Yes                  |
| Pipeline statuses | pipeline AT-URI               | `pipeline.listStatuses`, `pipeline.countStatuses`   | Yes                  |
| Knots             | owner DID                     | `knot.listKnots`, `knot.countKnots`                 | No                   |
| Knot members      | knot identifier               | `knot.listMembers`, `knot.countMembers`             | Yes                  |
| Spindles          | owner DID                     | `spindle.listSpindles`, `spindle.countSpindles`     | No                   |
| Spindle members   | spindle identifier            | `spindle.listMembers`, `spindle.countMembers`       | Yes                  |
| Public keys       | owner DID                     | `publicKey.listKeys`, `publicKey.countKeys`         | No                   |
| Label definitions | scope identifier              | `label.listDefinitions`, `label.countDefinitions`   | No                   |
| Label operations  | scope identifier              | `label.listOps`, `label.countOps`                   | Yes                  |
| Strings           | scope identifier              | `string.listStrings`, `string.countStrings`         | No                   |

`repo.listIssues` accepts optional `author` and `state` filters.
`repo.listPulls` accepts optional `author` and `status` filters. Their `By`
counterparts accept the state or status filter but already use the subject as
the author.

## Comment compatibility

New comments use `sh.tangled.feed.comment`. Its `body` is a Tangled Markdown
object and its `subject` is a strong reference to any commentable record.
Older repositories can still contain `sh.tangled.repo.issue.comment` and
`sh.tangled.repo.pull.comment`, whose bodies are plain strings and whose
subjects live in `issue` or `pull`.

Bobbin's current resolver recognizes both legacy collections and upgrades them
to canonical feed comments during resolution. The router also keeps both
legacy collection names in its supported-record set. Twisted accepts all three
validated shapes at its API boundary because an index built across an upgrade
can still return an older value. Every body goes through the same sanitized
Markdown renderer; legacy mentions and references remain visible as local
links.

The old Twisted client expected only the two repository-specific comment
records. That history explains why compatibility matters, but new code should
always treat `sh.tangled.feed.comment` as canonical.

## Search

`sh.tangled.search.query` searches Bobbin's in-memory full-text index.

| Parameter        | Requirement                                                   |
| ---------------- | ------------------------------------------------------------- |
| `q`              | Required non-empty search text                                |
| `limit`          | Optional `1..1000`, default `50`                              |
| `cursor`         | Optional opaque pagination cursor                             |
| `nsid`           | Optional record-collection filter                             |
| `author`         | Optional author DID                                           |
| `repo`           | Optional repo DID                                             |
| `since`, `until` | Optional RFC 3339 timestamps; `since` must not exceed `until` |

The response is `{ hits, cursor? }`. Each hit contains `uri`, optional `cid`,
`nsid`, numeric relevance `score`, and the embedded `value`. Results are ordered
by descending relevance.

## Git data proxied to knots

Bobbin resolves the repository record, finds its knot, and streams these calls
from that knot. It does not cache the response. For Twisted, `repo` is the
repository record AT-URI.

| NSID                               | Required parameters    | Optional parameters                       |
| ---------------------------------- | ---------------------- | ----------------------------------------- |
| `sh.tangled.repo.getDefaultBranch` | `repo`                 | None                                      |
| `sh.tangled.repo.branch`           | `repo`, `name`         | None                                      |
| `sh.tangled.repo.branches`         | `repo`                 | `cursor`, `limit` (`1..100`)              |
| `sh.tangled.repo.tag`              | `repo`, `tag`          | None                                      |
| `sh.tangled.repo.tags`             | `repo`                 | `cursor`, `limit` (`1..100`)              |
| `sh.tangled.repo.tree`             | `repo`, `ref`          | `path`                                    |
| `sh.tangled.repo.blob`             | `repo`, `ref`, `path`  | `raw`                                     |
| `sh.tangled.repo.log`              | `repo`, `ref`          | `path`, `cursor`, `limit` (`1..100`)      |
| `sh.tangled.repo.diff`             | `repo`, `ref`          | None                                      |
| `sh.tangled.repo.compare`          | `repo`, `rev1`, `rev2` | None                                      |
| `sh.tangled.repo.languages`        | `repo`                 | `ref` (defaults to `HEAD`)                |
| `sh.tangled.repo.archive`          | `repo`, `ref`          | `format` (defaults to `tar.gz`), `prefix` |

Several Git endpoints declare `*/*` output, so their bodies need an explicit
response mode. Diff and compare currently return structured JSON even though
their generated types describe a blob. Twisted accepts both response shapes,
normalizes the structured form to a unified patch, and stops reading at the
display limit before handing the patch to the renderer.

Archive responses stay as streams. The API boundary passes through range
requests and preserves `Content-Type`, `Content-Length`, `Content-Range`,
`Cache-Control`, `ETag`, `Last-Modified`, and the filename from
`Content-Disposition`. Views link directly to archive URLs so the browser can
download them without storing the archive in application state.

Artifact files use the same streaming rule. Twisted resolves the validated blob
reference to `com.atproto.sync.getBlob`, passes through range requests and
response metadata, and gives the browser the upstream URL for downloads. The
application does not convert artifact bodies to blobs or object URLs.

The current knot responses use numeric offsets for branch and tag pages and a
numeric page cursor for commit history. Twisted keeps those details inside its
API boundary and exposes the next cursor as an opaque string to the views.

Bobbin also proxies `sh.tangled.repo.listSecrets`, but Twisted has no user-facing
need for secret configuration and must not call it.

Bobbin has a compatibility route for `sh.tangled.repo.describeRepo`, but its
Bobbin parameter differs from the current atcute lexicon. Twisted must use the
typed record lookup methods instead.

The service-level `sh.tangled.owner`, `sh.tangled.knot.version`, and
`sh.tangled.knot.listKeys` methods require an extra `knot={host}` parameter when
called through Bobbin. They are useful for diagnostics rather than the first
client release.

## Coverage and stale data

Call `sh.tangled.bobbin.getCoverage` without parameters:

```json
{ "ready": true, "eventsProcessed": 137863, "lastCursor": 162959 }
```

`ready: false` means Bobbin is still rebuilding its index. Single-record
lookups can remain accurate because Bobbin asks Slingshot for them, but indexed
lists, counts, and search may be incomplete. Twisted should show a non-blocking
"data is still loading" notice and retain any returned results.

Coverage only describes Hydrant ingestion. It does not report whether a knot is
reachable or whether Bobbin's cached knot membership is current.

## Running Bobbin locally

The reproducible Docker setup in [`infra/bobbin`](../infra/bobbin/README.md)
builds the audited Tangled core commit and puts a small CORS gateway in front of
Bobbin. Bobbin is not standalone: it replays events from Hydrant and resolves
records through Slingshot. Tangled does not publish general-purpose endpoints
for those services, so operators must provide both upstream URLs.

Twisted accepts plain HTTP only for `localhost`, `127.0.0.1`, and `[::1]`.
Remote Bobbin deployments must use HTTPS.

## Public smoke-test fixture

The project owner has approved their public Tangled data as a smoke-test and
development fixture:

| Field               | Value                                                                 |
| ------------------- | --------------------------------------------------------------------- |
| Handle              | `desertthunder.dev`                                                   |
| Actor DID           | `did:plc:xg2vq45muivyy3xwatcehspu`                                    |
| Profile AT-URI      | `at://did:plc:xg2vq45muivyy3xwatcehspu/sh.tangled.actor.profile/self` |
| Twisted repo AT-URI | `at://did:plc:xg2vq45muivyy3xwatcehspu/sh.tangled.repo/3mho6hukiei22` |
| Twisted repo DID    | `did:plc:4iw5fospv2asv3344au236ka`                                    |

Smoke tests may assert stable identity and record fields such as handle, DID,
AT-URI, collection, and `$type`. Do not pin CIDs, result counts, descriptions,
branch names, issue lists, or other mutable content. Run live tests in sequence
with a short delay because the hosted edge applies a pre-authentication rate
limit.

## Errors

XRPC errors use this JSON shape:

```ts
type XrpcErrorBody = { error: string; message?: string }
```

Handle these classes in the client boundary:

| Status      | Typical meaning                                                          | UI behavior                                            |
| ----------- | ------------------------------------------------------------------------ | ------------------------------------------------------ |
| `400`       | Missing, malformed, or wrong-shaped identifier; invalid filter or cursor | Show a specific invalid-link or invalid-search message |
| `404`       | Record or route was not found                                            | Show the resource not-found state                      |
| `429`       | Hosted edge rate limit                                                   | Honor `Retry-After` when present and offer retry       |
| `502`       | Slingshot or knot failed, disappeared, or returned invalid data          | Show an upstream-unavailable state with retry          |
| `503`       | Bobbin shed the request under memory pressure                            | Offer retry; keep cached UI data                       |
| Other `5xx` | Bobbin failure                                                           | Show a generic service error and preserve navigation   |

Treat aborts as canceled navigation, not user-visible failures. Twisted spaces
request starts by 250 ms so a page with several panels does not flood the
hosted edge. It retries `429`, `502`, and `503` once when the delay is at most
five seconds, honoring `Retry-After` when present. Longer delays remain visible
to the page's retry control. It never retries `400` or `404` automatically.

Bobbin currently returns `cursor: null` for some empty lists, while the
generated schemas model an absent cursor. The response boundary removes that
one known exception before generated validation; it does not loosen validation
for other fields.

## Response cache

Twisted caches successful public GET responses with the API service, operation,
and normalized parameters in each key. Entries keep the short stale times
defined by the API client, so changing the API service cannot reuse data from a
different server.

The browser stores up to 500 entries in IndexedDB through Dexie. Android and iOS
store the same bounded cache in SQLite. If persistent storage is blocked,
unavailable, or contains an invalid entry, requests continue with the in-memory
cache. Repository downloads, entries larger than 1 MB, and other values that
cannot be represented as JSON remain memory-only.

`@capacitor-community/sqlite` includes SQLCipher in its native packages even
when a database is unencrypted. Native releases must follow the plugin's
encryption export-compliance guidance.
