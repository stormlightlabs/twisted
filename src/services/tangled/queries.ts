/**
 * TanStack Query hooks for Tangled data.
 * These are the only entry points Vue components should use — no direct
 * imports of @atcute/* or service/endpoint functions in components.
 *
 * Cache strategy:
 *  Repo metadata  stale: 5m  gc: 30m
 *  File tree      stale: 2m  gc: 10m
 *  File content   stale: 5m  gc: 30m
 *  Commit log     stale: 2m  gc: 10m
 *  Branches       stale: 2m  gc: 10m
 *  Profile        stale: 10m gc: 60m
 *  README         stale: 5m  gc: 30m
 */

import { useQuery } from "@tanstack/vue-query";
import { computed, toValue } from "vue";
import type { MaybeRef } from "vue";
import { getKnotClient } from "@/services/atproto/client.js";
import {
  fetchRepoTree,
  fetchRepoBlob,
  fetchDefaultBranch,
  fetchLanguages,
  fetchRepoLog,
  fetchRepoBranches,
  fetchRepoTags,
  fetchRepoDiff,
  fetchRepoCompare,
  fetchActorProfile,
  fetchRepoRecord,
  listRepoRecords,
  resolveHandle,
  resolvePds,
} from "./endpoints.js";
import {
  normalizeTree,
  normalizeBlob,
  normalizeDefaultBranch,
  normalizeLanguages,
  normalizeLogText,
  normalizeBranchesText,
  normalizeRepoRecordToDetail,
  normalizeActorProfile,
  normalizeRepoRecord,
} from "./normalizers.js";

export type { CommitEntry, BranchEntry, BlobContent, DefaultBranchInfo } from "./normalizers.js";

const MIN = 60_000;

/** Resolved identity: DID + PDS hostname for an AT Protocol handle. */
export type Identity = { did: string; pds: string };

/**
 * Resolve an AT Protocol handle to its DID and PDS hostname.
 * Result is cached for 10 minutes (handles rarely change).
 */
export function useIdentity(handle: MaybeRef<string>) {
  return useQuery({
    queryKey: computed(() => ["identity", toValue(handle)]),
    queryFn: async (): Promise<Identity> => {
      const did = await resolveHandle(toValue(handle));
      const pds = await resolvePds(did);
      return { did, pds };
    },
    staleTime: 10 * MIN,
    gcTime: 60 * MIN,
  });
}

/** File tree for a path within a repo. */
export function useRepoTree(
  knotHost: MaybeRef<string>,
  repo: MaybeRef<string>,
  ref: MaybeRef<string>,
  path: MaybeRef<string | undefined> = undefined,
  options: { enabled?: MaybeRef<boolean> } = {},
) {
  return useQuery({
    queryKey: computed(() => ["tree", toValue(knotHost), toValue(repo), toValue(ref), toValue(path)]),
    queryFn: () =>
      fetchRepoTree(getKnotClient(toValue(knotHost)), {
        repo: toValue(repo),
        ref: toValue(ref),
        path: toValue(path),
      }).then((out) => normalizeTree(out, toValue(path) ?? "")),
    enabled: options.enabled,
    staleTime: 2 * MIN,
    gcTime: 10 * MIN,
  });
}

/** Raw file content (blob) for a specific path and ref. */
export function useRepoBlob(
  knotHost: MaybeRef<string>,
  repo: MaybeRef<string>,
  ref: MaybeRef<string>,
  path: MaybeRef<string>,
  options: { readme?: boolean; enabled?: MaybeRef<boolean> } = {},
) {
  return useQuery({
    queryKey: computed(() => ["blob", toValue(knotHost), toValue(repo), toValue(ref), toValue(path)]),
    queryFn: () =>
      fetchRepoBlob(getKnotClient(toValue(knotHost)), {
        repo: toValue(repo),
        ref: toValue(ref),
        path: toValue(path),
      }).then(normalizeBlob),
    enabled: options.enabled,
    staleTime: 5 * MIN,
    gcTime: 30 * MIN,
  });
}

/** Default branch name + latest commit for a repo. */
export function useDefaultBranch(
  knotHost: MaybeRef<string>,
  repo: MaybeRef<string>,
  options: { enabled?: MaybeRef<boolean> } = {},
) {
  return useQuery({
    queryKey: computed(() => ["defaultBranch", toValue(knotHost), toValue(repo)]),
    queryFn: () =>
      fetchDefaultBranch(getKnotClient(toValue(knotHost)), { repo: toValue(repo) }).then(normalizeDefaultBranch),
    enabled: options.enabled,
    staleTime: 5 * MIN,
    gcTime: 30 * MIN,
  });
}

/** Language breakdown for a repo (percentages). */
export function useRepoLanguages(
  knotHost: MaybeRef<string>,
  repo: MaybeRef<string>,
  ref?: MaybeRef<string | undefined>,
  options: { enabled?: MaybeRef<boolean> } = {},
) {
  return useQuery({
    queryKey: computed(() => ["languages", toValue(knotHost), toValue(repo), toValue(ref)]),
    queryFn: () =>
      fetchLanguages(getKnotClient(toValue(knotHost)), { repo: toValue(repo), ref: toValue(ref) }).then(
        normalizeLanguages,
      ),
    enabled: options.enabled,
    staleTime: 5 * MIN,
    gcTime: 30 * MIN,
  });
}

/** Paginated commit log for a repo/ref. */
export function useRepoLog(
  knotHost: MaybeRef<string>,
  repo: MaybeRef<string>,
  ref: MaybeRef<string>,
  options: {
    path?: MaybeRef<string | undefined>;
    limit?: number;
    cursor?: MaybeRef<string | undefined>;
    enabled?: MaybeRef<boolean>;
  } = {},
) {
  return useQuery({
    queryKey: computed(() => [
      "log",
      toValue(knotHost),
      toValue(repo),
      toValue(ref),
      toValue(options.path),
      toValue(options.cursor),
    ]),
    queryFn: () =>
      fetchRepoLog(getKnotClient(toValue(knotHost)), {
        repo: toValue(repo),
        ref: toValue(ref),
        path: toValue(options.path),
        limit: options.limit,
        cursor: toValue(options.cursor),
      }).then(normalizeLogText),
    enabled: options.enabled,
    staleTime: 2 * MIN,
    gcTime: 10 * MIN,
  });
}

/** Branch list for a repo. */
export function useRepoBranches(
  knotHost: MaybeRef<string>,
  repo: MaybeRef<string>,
  defaultBranch?: MaybeRef<string | undefined>,
  options: { enabled?: MaybeRef<boolean> } = {},
) {
  return useQuery({
    queryKey: computed(() => ["branches", toValue(knotHost), toValue(repo)]),
    queryFn: () =>
      fetchRepoBranches(getKnotClient(toValue(knotHost)), { repo: toValue(repo) }).then((raw) =>
        normalizeBranchesText(raw, toValue(defaultBranch)),
      ),
    enabled: options.enabled,
    staleTime: 2 * MIN,
    gcTime: 10 * MIN,
  });
}

/**
 * Fetch a repo's PDS record (metadata: description, topics, knot, etc.).
 * `pds` is the PDS hostname, e.g. "bsky.social".
 */
export function useRepoRecord(
  pds: MaybeRef<string>,
  did: MaybeRef<string>,
  repoName: MaybeRef<string>,
  handle: MaybeRef<string>,
  options: { enabled?: MaybeRef<boolean> } = {},
) {
  return useQuery({
    queryKey: computed(() => ["repoRecord", toValue(pds), toValue(did), toValue(repoName)]),
    queryFn: async () => {
      const { value: record, uri } = await fetchRepoRecord(toValue(pds), toValue(did), toValue(repoName)).then((r) => ({
        value: r.value,
        uri: r.uri,
      }));
      return normalizeRepoRecord(record, toValue(did), toValue(handle), uri);
    },
    enabled: options.enabled,
    staleTime: 5 * MIN,
    gcTime: 30 * MIN,
  });
}

/** List all repos for a user from their PDS. */
export function useUserRepos(
  pds: MaybeRef<string>,
  did: MaybeRef<string>,
  handle: MaybeRef<string>,
  options: { enabled?: MaybeRef<boolean> } = {},
) {
  return useQuery({
    queryKey: computed(() => ["userRepos", toValue(pds), toValue(did)]),
    queryFn: async () => {
      const { records } = await listRepoRecords(toValue(pds), toValue(did));
      return records.map((r) => normalizeRepoRecord(r.value, toValue(did), toValue(handle), r.uri));
    },
    enabled: options.enabled,
    staleTime: 5 * MIN,
    gcTime: 30 * MIN,
  });
}

/** Fetch a user's Tangled actor profile from their PDS. */
export function useActorProfile(
  pds: MaybeRef<string>,
  did: MaybeRef<string>,
  handle: MaybeRef<string>,
  displayName?: MaybeRef<string | undefined>,
  options: { enabled?: MaybeRef<boolean> } = {},
) {
  return useQuery({
    queryKey: computed(() => ["actorProfile", toValue(pds), toValue(did)]),
    queryFn: async () => {
      const { value } = await fetchActorProfile(toValue(pds), toValue(did));
      return normalizeActorProfile(value, toValue(did), toValue(handle), toValue(displayName));
    },
    enabled: options.enabled,
    staleTime: 10 * MIN,
    gcTime: 60 * MIN,
  });
}

/** Tag list for a repo. Wire format is a raw blob; parsed as lines. */
export function useRepoTags(
  knotHost: MaybeRef<string>,
  repo: MaybeRef<string>,
  options: { enabled?: MaybeRef<boolean> } = {},
) {
  return useQuery({
    queryKey: computed(() => ["tags", toValue(knotHost), toValue(repo)]),
    queryFn: () =>
      fetchRepoTags(getKnotClient(toValue(knotHost)), { repo: toValue(repo) }).then((raw) =>
        raw.trim().split("\n").filter(Boolean),
      ),
    enabled: options.enabled,
    staleTime: 2 * MIN,
    gcTime: 10 * MIN,
  });
}

/** Unified diff for a ref (patch text). */
export function useRepoDiff(
  knotHost: MaybeRef<string>,
  repo: MaybeRef<string>,
  ref: MaybeRef<string>,
  options: { enabled?: MaybeRef<boolean> } = {},
) {
  return useQuery({
    queryKey: computed(() => ["diff", toValue(knotHost), toValue(repo), toValue(ref)]),
    queryFn: () => fetchRepoDiff(getKnotClient(toValue(knotHost)), { repo: toValue(repo), ref: toValue(ref) }),
    enabled: options.enabled,
    staleTime: 5 * MIN,
    gcTime: 30 * MIN,
  });
}

/** Comparison diff between two revisions (patch text). */
export function useRepoCompare(
  knotHost: MaybeRef<string>,
  repo: MaybeRef<string>,
  rev1: MaybeRef<string>,
  rev2: MaybeRef<string>,
  options: { enabled?: MaybeRef<boolean> } = {},
) {
  return useQuery({
    queryKey: computed(() => ["compare", toValue(knotHost), toValue(repo), toValue(rev1), toValue(rev2)]),
    queryFn: () =>
      fetchRepoCompare(getKnotClient(toValue(knotHost)), {
        repo: toValue(repo),
        rev1: toValue(rev1),
        rev2: toValue(rev2),
      }),
    enabled: options.enabled,
    staleTime: 5 * MIN,
    gcTime: 30 * MIN,
  });
}

/**
 * Composite hook: fetch repo PDS record + default branch + languages in
 * parallel, returning a merged RepoDetail.
 */
export function useRepoDetail(
  pds: MaybeRef<string>,
  did: MaybeRef<string>,
  repoName: MaybeRef<string>,
  knotHost: MaybeRef<string>,
  handle: MaybeRef<string>,
) {
  const knotRepo = computed(() => `${toValue(did)}/${toValue(repoName)}`);

  const record = useRepoRecord(pds, did, repoName, handle);
  const branch = useDefaultBranch(knotHost, knotRepo);
  const languages = useRepoLanguages(knotHost, knotRepo);

  const data = computed(() => {
    if (!record.data.value) return undefined;
    return normalizeRepoRecordToDetail(
      {
        name: toValue(repoName),
        knot: toValue(knotHost),
        createdAt: record.data.value.updatedAt ?? "",
        $type: "sh.tangled.repo",
      },
      toValue(did),
      toValue(handle),
      record.data.value.atUri,
      { defaultBranch: branch.data.value?.name, languages: languages.data.value },
    );
  });

  return {
    data,
    isPending: computed(() => record.isPending.value || branch.isPending.value),
    isError: computed(() => record.isError.value || branch.isError.value),
    error: computed(() => record.error.value ?? branch.error.value),
  };
}
