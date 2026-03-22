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
  fetchIssueRecord,
  fetchPullRecord,
  listRepoRecords,
  listIssueRecords,
  listIssueCommentRecords,
  listIssueStateRecords,
  listPullRecords,
  listPullCommentRecords,
  listPullStatusRecords,
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
  normalizeIssueRecord,
  normalizeIssueDetail,
  normalizeIssueComment,
  buildIssueCommentThread,
  normalizePullRecord,
  normalizePullDetail,
  normalizePullComment,
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
 * Issues for a repo. Lists sh.tangled.repo.issue records from the owner's PDS,
 * filtered by repo AT URI, joined with state from sh.tangled.repo.issue.state.
 */
export function useRepoIssues(
  pds: MaybeRef<string>,
  did: MaybeRef<string>,
  handle: MaybeRef<string>,
  repoAtUri: MaybeRef<string>,
  options: { enabled?: MaybeRef<boolean> } = {},
) {
  return useQuery({
    queryKey: computed(() => ["issues", toValue(pds), toValue(did), toValue(repoAtUri)]),
    queryFn: async () => {
      const [issuesRes, statesRes] = await Promise.all([
        listIssueRecords(toValue(pds), toValue(did)),
        listIssueStateRecords(toValue(pds), toValue(did)),
      ]);

      const stateMap = new Map<string, "open" | "closed">();
      for (const s of statesRes.records) {
        const closed = s.value.state === "sh.tangled.repo.issue.state.closed";
        stateMap.set(s.value.issue, closed ? "closed" : "open");
      }

      const targetRepo = toValue(repoAtUri);
      return issuesRes.records
        .filter((r) => !targetRepo || r.value.repo === targetRepo)
        .map((r) => normalizeIssueRecord(r.value, r.uri, toValue(did), toValue(handle), stateMap.get(r.uri) ?? "open"));
    },
    enabled: options.enabled,
    staleTime: 2 * MIN,
    gcTime: 10 * MIN,
  });
}

/**
 * Pull requests for a repo. Lists sh.tangled.repo.pull records from the owner's
 * PDS filtered by target repo AT URI, joined with status records.
 */
export function useRepoPRs(
  pds: MaybeRef<string>,
  did: MaybeRef<string>,
  handle: MaybeRef<string>,
  repoAtUri: MaybeRef<string>,
  options: { enabled?: MaybeRef<boolean> } = {},
) {
  return useQuery({
    queryKey: computed(() => ["prs", toValue(pds), toValue(did), toValue(repoAtUri)]),
    queryFn: async () => {
      const [pullsRes, statusesRes] = await Promise.all([
        listPullRecords(toValue(pds), toValue(did)),
        listPullStatusRecords(toValue(pds), toValue(did)),
      ]);

      const statusMap = new Map<string, "open" | "merged" | "closed">();
      for (const s of statusesRes.records) {
        const raw = s.value.status ?? "sh.tangled.repo.pull.status.open";
        const status =
          raw === "sh.tangled.repo.pull.status.merged"
            ? "merged"
            : raw === "sh.tangled.repo.pull.status.closed"
              ? "closed"
              : "open";
        statusMap.set(s.value.pull, status);
      }

      const targetRepo = toValue(repoAtUri);
      return pullsRes.records
        .filter((r) => !targetRepo || r.value.target.repo === targetRepo)
        .map((r) => normalizePullRecord(r.value, r.uri, toValue(did), toValue(handle), statusMap.get(r.uri) ?? "open"));
    },
    enabled: options.enabled,
    staleTime: 2 * MIN,
    gcTime: 10 * MIN,
  });
}

export function useIssueDetail(
  pds: MaybeRef<string>,
  did: MaybeRef<string>,
  handle: MaybeRef<string>,
  issueRkey: MaybeRef<string>,
  options: { enabled?: MaybeRef<boolean> } = {},
) {
  return useQuery({
    queryKey: computed(() => ["issueDetail", toValue(pds), toValue(did), toValue(issueRkey)]),
    queryFn: async () => {
      const [issueRes, statesRes, commentsRes] = await Promise.all([
        fetchIssueRecord(toValue(pds), toValue(did), toValue(issueRkey)),
        listIssueStateRecords(toValue(pds), toValue(did)),
        listIssueCommentRecords(toValue(pds), toValue(did)),
      ]);

      const currentState = statesRes.records.reduce<"open" | "closed">((state, record) => {
        if (record.value.issue !== issueRes.uri) return state;
        return record.value.state === "sh.tangled.repo.issue.state.closed" ? "closed" : "open";
      }, "open");

      const commentCount = commentsRes.records.filter((record) => record.value.issue === issueRes.uri).length;

      return normalizeIssueDetail(
        issueRes.value,
        issueRes.uri,
        toValue(did),
        toValue(handle),
        currentState,
        commentCount,
      );
    },
    enabled: options.enabled,
    staleTime: 2 * MIN,
    gcTime: 10 * MIN,
  });
}

export function useIssueComments(
  pds: MaybeRef<string>,
  did: MaybeRef<string>,
  handle: MaybeRef<string>,
  issueAtUri: MaybeRef<string>,
  options: { enabled?: MaybeRef<boolean> } = {},
) {
  return useQuery({
    queryKey: computed(() => ["issueComments", toValue(pds), toValue(did), toValue(issueAtUri)]),
    queryFn: async () => {
      const response = await listIssueCommentRecords(toValue(pds), toValue(did));
      const comments = response.records
        .filter((record) => record.value.issue === toValue(issueAtUri))
        .map((record) => normalizeIssueComment(record.value, record.uri, toValue(did), toValue(handle)));

      return buildIssueCommentThread(comments);
    },
    enabled: options.enabled,
    staleTime: 2 * MIN,
    gcTime: 10 * MIN,
  });
}

export function usePullRequestDetail(
  pds: MaybeRef<string>,
  did: MaybeRef<string>,
  handle: MaybeRef<string>,
  pullRkey: MaybeRef<string>,
  options: { enabled?: MaybeRef<boolean> } = {},
) {
  return useQuery({
    queryKey: computed(() => ["pullDetail", toValue(pds), toValue(did), toValue(pullRkey)]),
    queryFn: async () => {
      const [pullRes, statusesRes, commentsRes] = await Promise.all([
        fetchPullRecord(toValue(pds), toValue(did), toValue(pullRkey)),
        listPullStatusRecords(toValue(pds), toValue(did)),
        listPullCommentRecords(toValue(pds), toValue(did)),
      ]);

      const currentStatus = statusesRes.records.reduce<"open" | "merged" | "closed">((status, record) => {
        if (record.value.pull !== pullRes.uri) return status;
        if (record.value.status === "sh.tangled.repo.pull.status.merged") return "merged";
        if (record.value.status === "sh.tangled.repo.pull.status.closed") return "closed";
        return "open";
      }, "open");

      const roundCount = commentsRes.records.filter((record) => record.value.pull === pullRes.uri).length;

      return normalizePullDetail(pullRes.value, pullRes.uri, toValue(did), toValue(handle), currentStatus, roundCount);
    },
    enabled: options.enabled,
    staleTime: 2 * MIN,
    gcTime: 10 * MIN,
  });
}

export function usePullRequestComments(
  pds: MaybeRef<string>,
  did: MaybeRef<string>,
  handle: MaybeRef<string>,
  pullAtUri: MaybeRef<string>,
  options: { enabled?: MaybeRef<boolean> } = {},
) {
  return useQuery({
    queryKey: computed(() => ["pullComments", toValue(pds), toValue(did), toValue(pullAtUri)]),
    queryFn: async () => {
      const response = await listPullCommentRecords(toValue(pds), toValue(did));
      return response.records
        .filter((record) => record.value.pull === toValue(pullAtUri))
        .map((record) => normalizePullComment(record.value, record.uri, toValue(did), toValue(handle)))
        .sort((left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt));
    },
    enabled: options.enabled,
    staleTime: 2 * MIN,
    gcTime: 10 * MIN,
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
