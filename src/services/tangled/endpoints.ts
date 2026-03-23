/**
 * Typed wrappers around XRPC queries to Tangled knots and the AT Protocol PDS.
 *
 * Knot endpoints use raw fetch so we can control query serialization for the
 * `repo=did:.../repoName` parameter. PDS endpoints also use raw fetch because
 * some `com.atproto.repo.*` calls are not typed in the installed packages.
 *
 * --- API Validation Notes (to verify against live endpoints) ---
 * Knot XRPC base: https://<knot>/xrpc/<nsid>  (e.g. us-west.tangled.sh)
 * PDS XRPC base:  https://bsky.social/xrpc/<nsid>  (or user's own PDS)
 *
 * CORS: knot endpoints need to be confirmed CORS-safe from a browser context.
 * Appview (tangled.org) serves HTML/HTMX — not a JSON API. Profile & repo
 * metadata must come from PDS records via com.atproto.repo.getRecord.
 *
 * Data routing:
 *  - Git data (tree, blob, log, branches, languages) → knot XRPC
 *  - Repo metadata & profile → PDS com.atproto.repo.getRecord/listRecords
 */

import {
  ShTangledRepoTree,
  ShTangledRepoBlob,
  ShTangledRepoGetDefaultBranch,
  ShTangledRepoLanguages,
  ShTangledRepoTags,
  ShTangledRepoDiff,
  ShTangledRepoCompare,
  ShTangledRepo,
  ShTangledActorProfile,
  ShTangledRepoIssue,
  ShTangledRepoIssueComment,
  ShTangledRepoIssueState,
  ShTangledRepoPull,
  ShTangledRepoPullComment,
  ShTangledRepoPullStatus,
  ShTangledGraphFollow,
  ShTangledString,
} from "@atcute/tangled";
import { throwOnXrpcError } from "@/services/atproto/client.js";
import { MalformedResponseError, NotFoundError } from "@/core/errors/tangled.js";

type KnotParams = Record<string, string | number | boolean | undefined | Array<string | number | boolean>>;

function encodeKnotQueryParam(key: string, value: string | number | boolean): string {
  const encodedValue = encodeURIComponent(String(value));
  return `${encodeURIComponent(key)}=${key === "repo" ? encodedValue.replaceAll("%2F", "/") : encodedValue}`;
}

function buildKnotQuery(params: KnotParams): string {
  const pairs: string[] = [];

  for (const [key, rawValue] of Object.entries(params)) {
    if (rawValue === undefined) continue;

    if (Array.isArray(rawValue)) {
      for (const value of rawValue) {
        pairs.push(encodeKnotQueryParam(key, value));
      }
      continue;
    }

    pairs.push(encodeKnotQueryParam(key, rawValue));
  }

  return pairs.length > 0 ? `?${pairs.join("&")}` : "";
}

export function buildKnotUrl(knotHost: string, nsid: string, params: KnotParams): string {
  return `https://${knotHost}/xrpc/${nsid}${buildKnotQuery(params)}`;
}

async function readKnotError(res: Response): Promise<never> {
  const contentType = res.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const body = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
    throwOnXrpcError(res.status, body.error ?? "Unknown", body.message);
  }

  const text = await res.text().catch(() => "");
  throwOnXrpcError(res.status, "Unknown", text || undefined);
}

async function fetchKnotJson<T>(knotHost: string, nsid: string, params: KnotParams): Promise<T> {
  const res = await fetch(buildKnotUrl(knotHost, nsid, params));
  if (!res.ok) return readKnotError(res);
  return res.json() as Promise<T>;
}

async function fetchKnotBytes(knotHost: string, nsid: string, params: KnotParams): Promise<Uint8Array> {
  const res = await fetch(buildKnotUrl(knotHost, nsid, params));
  if (!res.ok) return readKnotError(res);
  return new Uint8Array(await res.arrayBuffer());
}

export async function fetchRepoTree(
  knotHost: string,
  params: ShTangledRepoTree.$params,
): Promise<ShTangledRepoTree.$output> {
  return fetchKnotJson<ShTangledRepoTree.$output>(knotHost, "sh.tangled.repo.tree", params);
}

export async function fetchRepoBlob(
  knotHost: string,
  params: ShTangledRepoBlob.$params,
): Promise<ShTangledRepoBlob.$output> {
  return fetchKnotJson<ShTangledRepoBlob.$output>(knotHost, "sh.tangled.repo.blob", params);
}

export async function fetchDefaultBranch(
  knotHost: string,
  params: ShTangledRepoGetDefaultBranch.$params,
): Promise<ShTangledRepoGetDefaultBranch.$output> {
  return fetchKnotJson<ShTangledRepoGetDefaultBranch.$output>(knotHost, "sh.tangled.repo.getDefaultBranch", params);
}

export async function fetchLanguages(
  knotHost: string,
  params: ShTangledRepoLanguages.$params,
): Promise<ShTangledRepoLanguages.$output> {
  return fetchKnotJson<ShTangledRepoLanguages.$output>(knotHost, "sh.tangled.repo.languages", params);
}

/**
 * Fetch commit log. The wire format is a raw blob; the decoded text is returned
 * as-is so the normalizer can handle it once the format is confirmed against
 * the live API. Expected: newline-delimited JSON or git log text.
 */
export async function fetchRepoLog(
  knotHost: string,
  params: { repo: string; ref: string; path?: string; limit?: number; cursor?: string },
): Promise<string> {
  return new TextDecoder().decode(await fetchKnotBytes(knotHost, "sh.tangled.repo.log", params));
}

/**
 * Fetch branch list. The wire format is a raw blob; decoded text is returned
 * for the normalizer to parse once the live format is confirmed.
 */
export async function fetchRepoBranches(
  knotHost: string,
  params: { repo: string; limit?: number; cursor?: string },
): Promise<string> {
  return new TextDecoder().decode(await fetchKnotBytes(knotHost, "sh.tangled.repo.branches", params));
}

/** Tag list. Wire format is a raw blob — decoded text returned for normalizer. */
export async function fetchRepoTags(knotHost: string, params: ShTangledRepoTags.$params): Promise<string> {
  return new TextDecoder().decode(await fetchKnotBytes(knotHost, "sh.tangled.repo.tags", params));
}

/** Diff for a ref. Wire format is a raw blob — patch text. */
export async function fetchRepoDiff(knotHost: string, params: ShTangledRepoDiff.$params): Promise<string> {
  return new TextDecoder().decode(await fetchKnotBytes(knotHost, "sh.tangled.repo.diff", params));
}

/** Comparison between two revisions. Wire format is a raw blob — patch text. */
export async function fetchRepoCompare(knotHost: string, params: ShTangledRepoCompare.$params): Promise<string> {
  return new TextDecoder().decode(await fetchKnotBytes(knotHost, "sh.tangled.repo.compare", params));
}

type GetRecordResponse<T> = { uri: string; cid: string; value: T };

/**
 * Fetch a single record from the AT Protocol PDS.
 * Uses raw fetch against /xrpc/com.atproto.repo.getRecord since this NSID
 * is not currently typed in the installed @atcute packages.
 */
async function getRecord<T>(
  pds: string,
  repo: string,
  collection: string,
  rkey: string,
): Promise<GetRecordResponse<T>> {
  const url = new URL(`https://${pds}/xrpc/com.atproto.repo.getRecord`);
  url.searchParams.set("repo", repo);
  url.searchParams.set("collection", collection);
  url.searchParams.set("rkey", rkey);

  const res = await fetch(url.toString());
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
    throwOnXrpcError(res.status, body.error ?? "Unknown", body.message);
  }
  return res.json() as Promise<GetRecordResponse<T>>;
}

export async function fetchActorProfile(
  pds: string,
  did: string,
): Promise<GetRecordResponse<ShTangledActorProfile.Main>> {
  return getRecord<ShTangledActorProfile.Main>(pds, did, "sh.tangled.actor.profile", "self");
}

/**
 * Fetch a repo record by its PDS record key.
 * This is distinct from the repo's `name`, which is the identifier used by
 * knot endpoints in the `did:.../repoName` format.
 */
export async function fetchRepoRecord(
  pds: string,
  did: string,
  rkey: string,
): Promise<GetRecordResponse<ShTangledRepo.Main>> {
  return getRecord<ShTangledRepo.Main>(pds, did, "sh.tangled.repo", rkey);
}

/**
 * Fetch a repo record by matching on the record's `name` field.
 * Use this when the UI route or knot API identifies a repo by repo name rather
 * than by the underlying AT Protocol record key.
 */
export async function fetchRepoRecordByName(
  pds: string,
  did: string,
  repoName: string,
): Promise<GetRecordResponse<ShTangledRepo.Main>> {
  let cursor: string | undefined;

  for (;;) {
    const response = await listRepoRecords(pds, did, 100, cursor);
    const record = response.records.find((entry) => entry.value.name === repoName);
    if (record) return record;
    if (!response.cursor) break;
    cursor = response.cursor;
  }

  throw new NotFoundError(`Repository ${repoName}`);
}

export async function fetchIssueRecord(
  pds: string,
  did: string,
  rkey: string,
): Promise<GetRecordResponse<ShTangledRepoIssue.Main>> {
  return getRecord<ShTangledRepoIssue.Main>(pds, did, "sh.tangled.repo.issue", rkey);
}

export async function fetchPullRecord(
  pds: string,
  did: string,
  rkey: string,
): Promise<GetRecordResponse<ShTangledRepoPull.Main>> {
  return getRecord<ShTangledRepoPull.Main>(pds, did, "sh.tangled.repo.pull", rkey);
}

/**
 * Resolve an AT Protocol handle to a DID via bsky.social.
 * Returns the DID string (e.g. "did:plc:xxx").
 */
export async function resolveHandle(handle: string): Promise<string> {
  const url = new URL("https://bsky.social/xrpc/com.atproto.identity.resolveHandle");
  url.searchParams.set("handle", handle);
  const res = await fetch(url.toString());
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
    throwOnXrpcError(res.status, body.error ?? "Unknown", body.message);
  }
  const data = (await res.json()) as { did: string };
  return data.did;
}

type DidDocument = { alsoKnownAs?: string[]; service?: Array<{ id: string; type: string; serviceEndpoint: string }> };

async function fetchDidDocument(did: string): Promise<DidDocument> {
  let docUrl: string;
  if (did.startsWith("did:plc:")) {
    docUrl = `https://plc.directory/${did}`;
  } else if (did.startsWith("did:web:")) {
    const host = did.slice("did:web:".length);
    docUrl = `https://${host}/.well-known/did.json`;
  } else {
    throw new MalformedResponseError("resolveHandle", `Unsupported DID method: ${did}`);
  }

  const res = await fetch(docUrl);
  if (!res.ok) throwOnXrpcError(res.status, "ResolveFailed", `Could not fetch DID document: ${did}`);
  return (await res.json()) as DidDocument;
}

/**
 * Fetch the DID document for a DID and extract the PDS service endpoint hostname.
 * Supports did:plc (via plc.directory) and did:web.
 */
export async function resolvePds(did: string): Promise<string> {
  const doc = await fetchDidDocument(did);
  const svc = doc.service?.find((s) => s.id === "#atproto_pds");
  if (!svc?.serviceEndpoint) {
    throw new MalformedResponseError("resolvePds", `No PDS endpoint in DID document: ${did}`);
  }
  return new URL(svc.serviceEndpoint).hostname;
}

export async function resolveHandleFromDid(did: string): Promise<string> {
  if (did.startsWith("did:web:")) return did.slice("did:web:".length);

  const doc = await fetchDidDocument(did);
  const alias = doc.alsoKnownAs?.find((entry) => entry.startsWith("at://"));
  if (!alias) {
    throw new MalformedResponseError("resolveHandleFromDid", `No handle alias in DID document: ${did}`);
  }

  return alias.slice("at://".length);
}

export async function resolveDidIdentity(did: string): Promise<{ did: string; handle: string; pds: string }> {
  const [handle, pds] = await Promise.all([resolveHandleFromDid(did), resolvePds(did)]);
  return { did, handle, pds };
}

type ListRecordsResponse<T> = { records: Array<{ uri: string; cid: string; value: T }>; cursor?: string };

async function listRecords<T>(
  pds: string,
  did: string,
  collection: string,
  limit = 50,
  cursor?: string,
): Promise<ListRecordsResponse<T>> {
  const url = new URL(`https://${pds}/xrpc/com.atproto.repo.listRecords`);
  url.searchParams.set("repo", did);
  url.searchParams.set("collection", collection);
  url.searchParams.set("limit", String(limit));
  if (cursor) url.searchParams.set("cursor", cursor);
  const res = await fetch(url.toString());
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
    throwOnXrpcError(res.status, body.error ?? "Unknown", body.message);
  }
  return res.json() as Promise<ListRecordsResponse<T>>;
}

/** List sh.tangled.repo.issue records from a user's PDS. */
export async function listIssueRecords(
  pds: string,
  did: string,
  limit = 50,
  cursor?: string,
): Promise<ListRecordsResponse<ShTangledRepoIssue.Main>> {
  return listRecords<ShTangledRepoIssue.Main>(pds, did, "sh.tangled.repo.issue", limit, cursor);
}

/** List sh.tangled.repo.issue.state records from a user's PDS. */
export async function listIssueStateRecords(
  pds: string,
  did: string,
  limit = 100,
  cursor?: string,
): Promise<ListRecordsResponse<ShTangledRepoIssueState.Main>> {
  return listRecords<ShTangledRepoIssueState.Main>(pds, did, "sh.tangled.repo.issue.state", limit, cursor);
}

/** List sh.tangled.repo.issue.comment records from a user's PDS. */
export async function listIssueCommentRecords(
  pds: string,
  did: string,
  limit = 100,
  cursor?: string,
): Promise<ListRecordsResponse<ShTangledRepoIssueComment.Main>> {
  return listRecords<ShTangledRepoIssueComment.Main>(pds, did, "sh.tangled.repo.issue.comment", limit, cursor);
}

/** List sh.tangled.repo.pull records from a user's PDS. */
export async function listPullRecords(
  pds: string,
  did: string,
  limit = 50,
  cursor?: string,
): Promise<ListRecordsResponse<ShTangledRepoPull.Main>> {
  return listRecords<ShTangledRepoPull.Main>(pds, did, "sh.tangled.repo.pull", limit, cursor);
}

/** List sh.tangled.repo.pull.status records from a user's PDS. */
export async function listPullStatusRecords(
  pds: string,
  did: string,
  limit = 100,
  cursor?: string,
): Promise<ListRecordsResponse<ShTangledRepoPullStatus.Main>> {
  return listRecords<ShTangledRepoPullStatus.Main>(pds, did, "sh.tangled.repo.pull.status", limit, cursor);
}

/** List sh.tangled.repo.pull.comment records from a user's PDS. */
export async function listPullCommentRecords(
  pds: string,
  did: string,
  limit = 100,
  cursor?: string,
): Promise<ListRecordsResponse<ShTangledRepoPullComment.Main>> {
  return listRecords<ShTangledRepoPullComment.Main>(pds, did, "sh.tangled.repo.pull.comment", limit, cursor);
}

export async function listFollowRecords(
  pds: string,
  did: string,
  limit = 100,
  cursor?: string,
): Promise<ListRecordsResponse<ShTangledGraphFollow.Main>> {
  return listRecords<ShTangledGraphFollow.Main>(pds, did, "sh.tangled.graph.follow", limit, cursor);
}

export async function listStringRecords(
  pds: string,
  did: string,
  limit = 100,
  cursor?: string,
): Promise<ListRecordsResponse<ShTangledString.Main>> {
  return listRecords<ShTangledString.Main>(pds, did, "sh.tangled.string", limit, cursor);
}

/**
 * List all sh.tangled.repo records from a user's PDS.
 * Uses com.atproto.repo.listRecords since it's not in the installed lexicons.
 */
export async function listRepoRecords(
  pds: string,
  did: string,
  limit = 50,
  cursor?: string,
): Promise<{ records: Array<{ uri: string; cid: string; value: ShTangledRepo.Main }>; cursor?: string }> {
  const url = new URL(`https://${pds}/xrpc/com.atproto.repo.listRecords`);
  url.searchParams.set("repo", did);
  url.searchParams.set("collection", "sh.tangled.repo");
  url.searchParams.set("limit", String(limit));
  if (cursor) url.searchParams.set("cursor", cursor);

  const res = await fetch(url.toString());
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
    throwOnXrpcError(res.status, body.error ?? "Unknown", body.message);
  }
  return res.json() as Promise<{
    records: Array<{ uri: string; cid: string; value: ShTangledRepo.Main }>;
    cursor?: string;
  }>;
}
