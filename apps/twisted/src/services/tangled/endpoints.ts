/**
 * Typed wrappers around Twister API endpoints.
 *
 * The app calls Twister for everything — no direct XRPC calls to PDSes or
 * knots. Twister resolves handles, routes to the right knot/PDS, and returns
 * the raw Lexicon records so the existing normalizers can still apply.
 */

import {
  ShTangledRepoTree,
  ShTangledRepoBlob,
  ShTangledRepoGetDefaultBranch,
  ShTangledRepoLanguages,
  ShTangledRepoDiff,
  ShTangledRepoCompare,
  ShTangledRepo,
  ShTangledActorProfile,
  ShTangledRepoIssue,
  ShTangledRepoIssueComment,
  ShTangledRepoPull,
  ShTangledRepoPullComment,
  ShTangledGraphFollow,
  ShTangledString,
} from "@atcute/tangled";
import { throwOnXrpcError } from "@/services/atproto/client.js";
import { getTwisterApiUrl } from "@/core/config/project.js";

export type RecordEntry<T> = { uri: string; cid: string; value: T };
export type IssueEntry = RecordEntry<ShTangledRepoIssue.Main> & { state: "open" | "closed" };
export type PullEntry = RecordEntry<ShTangledRepoPull.Main> & { status: "open" | "merged" | "closed" };

export type ActorResponse = {
  did: string;
  handle: string;
  pds: string;
  profile: RecordEntry<ShTangledActorProfile.Main>;
  bsky?: { displayName?: string; avatar?: string } | null;
};

export type ActorReposResponse = { did: string; handle: string; records: RecordEntry<ShTangledRepo.Main>[] };

export type ActorRepoResponse = {
  did: string;
  handle: string;
  knot_host: string;
  record: RecordEntry<ShTangledRepo.Main>;
};

export type ActorIssuesResponse = { did: string; handle: string; records: IssueEntry[] };

export type ActorPullsResponse = { did: string; handle: string; records: PullEntry[] };

export type ActorFollowingResponse = { did: string; handle: string; records: RecordEntry<ShTangledGraphFollow.Main>[] };

export type ActorStringsResponse = { did: string; handle: string; records: RecordEntry<ShTangledString.Main>[] };

export type IssueDetailResponse = IssueEntry;

export type IssueCommentsResponse = {
  did: string;
  handle: string;
  issueUri: string;
  records: RecordEntry<ShTangledRepoIssueComment.Main>[];
};

export type PullDetailResponse = PullEntry;

export type PullCommentsResponse = {
  did: string;
  handle: string;
  pullUri: string;
  records: RecordEntry<ShTangledRepoPullComment.Main>[];
};

async function get<T>(path: string, params?: Record<string, string | undefined>): Promise<T> {
  const url = new URL(getTwisterApiUrl(path));
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) url.searchParams.set(key, value);
    }
  }
  const res = await fetch(url.toString());
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
    throwOnXrpcError(res.status, body.error ?? "Unknown", body.message);
  }
  return res.json() as Promise<T>;
}

async function getProxy<T>(path: string, params?: Record<string, string | number | undefined>): Promise<T> {
  const normalized: Record<string, string | undefined> = {};
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      normalized[key] = value === undefined ? undefined : String(value);
    }
  }
  return get<T>(path, normalized);
}

async function getBytes(path: string, params?: Record<string, string | undefined>): Promise<Uint8Array> {
  const url = new URL(getTwisterApiUrl(path));
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) url.searchParams.set(key, value);
    }
  }
  const res = await fetch(url.toString());
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
    throwOnXrpcError(res.status, body.error ?? "Unknown", body.message);
  }
  return new Uint8Array(await res.arrayBuffer());
}

export async function fetchActor(handle: string): Promise<ActorResponse> {
  return get<ActorResponse>(`/actors/${encodeURIComponent(handle)}`);
}

export async function fetchActorRepos(handle: string): Promise<ActorReposResponse> {
  return get<ActorReposResponse>(`/actors/${encodeURIComponent(handle)}/repos`);
}

export async function fetchActorRepo(handle: string, repo: string): Promise<ActorRepoResponse> {
  return get<ActorRepoResponse>(`/actors/${encodeURIComponent(handle)}/repos/${encodeURIComponent(repo)}`);
}

export async function fetchActorFollowing(handle: string): Promise<ActorFollowingResponse> {
  return get<ActorFollowingResponse>(`/actors/${encodeURIComponent(handle)}/following`);
}

export async function fetchActorStrings(handle: string): Promise<ActorStringsResponse> {
  return get<ActorStringsResponse>(`/actors/${encodeURIComponent(handle)}/strings`);
}

export async function fetchActorIssues(handle: string): Promise<ActorIssuesResponse> {
  return get<ActorIssuesResponse>(`/actors/${encodeURIComponent(handle)}/issues`);
}

export async function fetchActorPulls(handle: string): Promise<ActorPullsResponse> {
  return get<ActorPullsResponse>(`/actors/${encodeURIComponent(handle)}/pulls`);
}

type ResolveHandleResponse = { did: string };

type DidDocument = {
  service?: Array<{ id?: string; type?: string; serviceEndpoint?: string }>;
  alsoKnownAs?: string[];
};

export async function resolveHandle(handle: string): Promise<string> {
  const data = await getProxy<ResolveHandleResponse>("/identity/resolve", { handle });
  return data.did;
}

export async function fetchDidDocument(did: string): Promise<DidDocument> {
  return get<DidDocument>(`/identity/did/${encodeURIComponent(did)}`);
}

export async function resolvePds(did: string): Promise<string> {
  const doc = await fetchDidDocument(did);
  const endpoint = doc.service?.find((entry) => entry.id === "#atproto_pds")?.serviceEndpoint;
  if (!endpoint) {
    throw new Error(`No PDS endpoint found in DID document for ${did}`);
  }
  return new URL(endpoint).hostname;
}

export async function resolveDidIdentity(did: string): Promise<{ did: string; handle: string; pds: string }> {
  const actor = await fetchActor(did);
  return { did: actor.did, handle: actor.handle, pds: new URL(actor.pds).hostname };
}

export async function fetchBskyXrpc<T>(nsid: string, params?: Record<string, string | number | undefined>): Promise<T> {
  return getProxy<T>(`/xrpc/bsky/${encodeURIComponent(nsid)}`, params);
}

export async function fetchPdsXrpc<T>(
  pdsHost: string,
  nsid: string,
  params?: Record<string, string | number | undefined>,
): Promise<T> {
  return getProxy<T>(`/xrpc/pds/${encodeURIComponent(pdsHost)}/${encodeURIComponent(nsid)}`, params);
}

export async function fetchKnotXrpc<T>(
  knotHost: string,
  nsid: string,
  params?: Record<string, string | number | undefined>,
): Promise<T> {
  return getProxy<T>(`/xrpc/knot/${encodeURIComponent(knotHost)}/${encodeURIComponent(nsid)}`, params);
}

export async function fetchRepoTree(
  handle: string,
  repo: string,
  params: ShTangledRepoTree.$params,
): Promise<ShTangledRepoTree.$output> {
  return get<ShTangledRepoTree.$output>(
    `/actors/${encodeURIComponent(handle)}/repos/${encodeURIComponent(repo)}/tree`,
    { ref: params.ref, path: params.path },
  );
}

export async function fetchRepoBlob(
  handle: string,
  repo: string,
  params: ShTangledRepoBlob.$params,
): Promise<ShTangledRepoBlob.$output> {
  return get<ShTangledRepoBlob.$output>(
    `/actors/${encodeURIComponent(handle)}/repos/${encodeURIComponent(repo)}/blob`,
    { ref: params.ref, path: params.path },
  );
}

export async function fetchDefaultBranch(handle: string, repo: string): Promise<ShTangledRepoGetDefaultBranch.$output> {
  return get<ShTangledRepoGetDefaultBranch.$output>(
    `/actors/${encodeURIComponent(handle)}/repos/${encodeURIComponent(repo)}/default-branch`,
  );
}

export async function fetchLanguages(
  handle: string,
  repo: string,
  ref?: string,
): Promise<ShTangledRepoLanguages.$output> {
  return get<ShTangledRepoLanguages.$output>(
    `/actors/${encodeURIComponent(handle)}/repos/${encodeURIComponent(repo)}/languages`,
    ref ? { ref } : undefined,
  );
}

export async function fetchRepoLog(
  handle: string,
  repo: string,
  params: { ref: string; path?: string; limit?: number; cursor?: string },
): Promise<string> {
  const p: Record<string, string | undefined> = { ref: params.ref, path: params.path };
  if (params.limit !== undefined) p.limit = String(params.limit);
  if (params.cursor !== undefined) p.cursor = params.cursor;
  return new TextDecoder().decode(
    await getBytes(`/actors/${encodeURIComponent(handle)}/repos/${encodeURIComponent(repo)}/log`, p),
  );
}

export async function fetchRepoBranches(
  handle: string,
  repo: string,
  params?: { limit?: number; cursor?: string },
): Promise<string> {
  const p: Record<string, string | undefined> = {};
  if (params?.limit !== undefined) p.limit = String(params.limit);
  if (params?.cursor !== undefined) p.cursor = params.cursor;
  return new TextDecoder().decode(
    await getBytes(`/actors/${encodeURIComponent(handle)}/repos/${encodeURIComponent(repo)}/branches`, p),
  );
}

export async function fetchRepoTags(handle: string, repo: string): Promise<string> {
  return new TextDecoder().decode(
    await getBytes(`/actors/${encodeURIComponent(handle)}/repos/${encodeURIComponent(repo)}/tags`),
  );
}

export async function fetchRepoDiff(handle: string, repo: string, params: ShTangledRepoDiff.$params): Promise<string> {
  return new TextDecoder().decode(
    await getBytes(`/actors/${encodeURIComponent(handle)}/repos/${encodeURIComponent(repo)}/diff`, { ref: params.ref }),
  );
}

export async function fetchRepoCompare(
  handle: string,
  repo: string,
  params: ShTangledRepoCompare.$params,
): Promise<string> {
  return new TextDecoder().decode(
    await getBytes(`/actors/${encodeURIComponent(handle)}/repos/${encodeURIComponent(repo)}/compare`, {
      from: params.rev1,
      to: params.rev2,
    }),
  );
}

export async function fetchRepoIssues(handle: string, repo: string): Promise<ActorIssuesResponse> {
  return get<ActorIssuesResponse>(`/actors/${encodeURIComponent(handle)}/repos/${encodeURIComponent(repo)}/issues`);
}

export async function fetchRepoPulls(handle: string, repo: string): Promise<ActorPullsResponse> {
  return get<ActorPullsResponse>(`/actors/${encodeURIComponent(handle)}/repos/${encodeURIComponent(repo)}/pulls`);
}

export async function fetchIssueDetail(handle: string, rkey: string): Promise<IssueDetailResponse> {
  return get<IssueDetailResponse>(`/issues/${encodeURIComponent(handle)}/${encodeURIComponent(rkey)}`);
}

export async function fetchIssueComments(handle: string, rkey: string): Promise<IssueCommentsResponse> {
  return get<IssueCommentsResponse>(`/issues/${encodeURIComponent(handle)}/${encodeURIComponent(rkey)}/comments`);
}

export async function fetchPullDetail(handle: string, rkey: string): Promise<PullDetailResponse> {
  return get<PullDetailResponse>(`/pulls/${encodeURIComponent(handle)}/${encodeURIComponent(rkey)}`);
}

export async function fetchPullComments(handle: string, rkey: string): Promise<PullCommentsResponse> {
  return get<PullCommentsResponse>(`/pulls/${encodeURIComponent(handle)}/${encodeURIComponent(rkey)}/comments`);
}
