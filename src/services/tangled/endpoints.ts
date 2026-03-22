/**
 * Typed wrappers around XRPC queries to Tangled knots and the AT Protocol PDS.
 *
 * All functions accept a Client instance so callers can route to the correct
 * knot host (via getKnotClient) or to the PDS (via pdsClient).
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
 *  - Repo metadata & profile → PDS com.atproto.repo.getRecord
 */

import type { Client } from "@atcute/client";
import type {
  ShTangledRepoTree,
  ShTangledRepoBlob,
  ShTangledRepoGetDefaultBranch,
  ShTangledRepoLanguages,
  ShTangledRepoTags,
  ShTangledRepoDiff,
  ShTangledRepoCompare,
  ShTangledRepo,
  ShTangledActorProfile,
} from "@atcute/tangled";
import { throwOnXrpcError } from "@/services/atproto/client.js";

export async function fetchRepoTree(
  client: Client,
  params: ShTangledRepoTree.$params,
): Promise<ShTangledRepoTree.$output> {
  const res = await client.get("sh.tangled.repo.tree", { params });
  if (!res.ok) throwOnXrpcError(res.status, res.data.error, res.data.message);
  return res.data;
}

export async function fetchRepoBlob(
  client: Client,
  params: ShTangledRepoBlob.$params,
): Promise<ShTangledRepoBlob.$output> {
  const res = await client.get("sh.tangled.repo.blob", { params });
  if (!res.ok) throwOnXrpcError(res.status, res.data.error, res.data.message);
  return res.data;
}

export async function fetchDefaultBranch(
  client: Client,
  params: ShTangledRepoGetDefaultBranch.$params,
): Promise<ShTangledRepoGetDefaultBranch.$output> {
  const res = await client.get("sh.tangled.repo.getDefaultBranch", { params });
  if (!res.ok) throwOnXrpcError(res.status, res.data.error, res.data.message);
  return res.data;
}

export async function fetchLanguages(
  client: Client,
  params: ShTangledRepoLanguages.$params,
): Promise<ShTangledRepoLanguages.$output> {
  const res = await client.get("sh.tangled.repo.languages", { params });
  if (!res.ok) throwOnXrpcError(res.status, res.data.error, res.data.message);
  return res.data;
}

/**
 * Fetch commit log. The wire format is a raw blob; the decoded text is returned
 * as-is so the normalizer can handle it once the format is confirmed against
 * the live API. Expected: newline-delimited JSON or git log text.
 */
export async function fetchRepoLog(
  client: Client,
  params: { repo: string; ref: string; path?: string; limit?: number; cursor?: string },
): Promise<string> {
  const res = await client.get("sh.tangled.repo.log", { params, as: "bytes" });
  if (!res.ok) throwOnXrpcError(res.status, (res.data as { error: string }).error);
  return new TextDecoder().decode(res.data as Uint8Array);
}

/**
 * Fetch branch list. The wire format is a raw blob; decoded text is returned
 * for the normalizer to parse once the live format is confirmed.
 */
export async function fetchRepoBranches(
  client: Client,
  params: { repo: string; limit?: number; cursor?: string },
): Promise<string> {
  const res = await client.get("sh.tangled.repo.branches", { params, as: "bytes" });
  if (!res.ok) throwOnXrpcError(res.status, (res.data as { error: string }).error);
  return new TextDecoder().decode(res.data as Uint8Array);
}

/** Tag list. Wire format is a raw blob — decoded text returned for normalizer. */
export async function fetchRepoTags(
  client: Client,
  params: ShTangledRepoTags.$params,
): Promise<string> {
  const res = await client.get("sh.tangled.repo.tags", { params, as: "bytes" });
  if (!res.ok) throwOnXrpcError(res.status, (res.data as { error: string }).error);
  return new TextDecoder().decode(res.data as Uint8Array);
}

/** Diff for a ref. Wire format is a raw blob — patch text. */
export async function fetchRepoDiff(
  client: Client,
  params: ShTangledRepoDiff.$params,
): Promise<string> {
  const res = await client.get("sh.tangled.repo.diff", { params, as: "bytes" });
  if (!res.ok) throwOnXrpcError(res.status, (res.data as { error: string }).error);
  return new TextDecoder().decode(res.data as Uint8Array);
}

/** Comparison between two revisions. Wire format is a raw blob — patch text. */
export async function fetchRepoCompare(
  client: Client,
  params: ShTangledRepoCompare.$params,
): Promise<string> {
  const res = await client.get("sh.tangled.repo.compare", { params, as: "bytes" });
  if (!res.ok) throwOnXrpcError(res.status, (res.data as { error: string }).error);
  return new TextDecoder().decode(res.data as Uint8Array);
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

export async function fetchRepoRecord(
  pds: string,
  did: string,
  repoName: string,
): Promise<GetRecordResponse<ShTangledRepo.Main>> {
  return getRecord<ShTangledRepo.Main>(pds, did, "sh.tangled.repo", repoName);
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
