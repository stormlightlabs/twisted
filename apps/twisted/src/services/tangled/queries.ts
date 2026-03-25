/**
 * TanStack Query hooks for Tangled data via Twister API.
 * Components should only use these hooks rather than endpoint wrappers directly.
 */

import { useQuery } from "@tanstack/vue-query";
import { computed, toValue } from "vue";
import type { MaybeRef } from "vue";
import type { FollowedUserSummary } from "@/domain/models/follow.js";
import type { StringSummary } from "@/domain/models/string.js";
import {
  fetchActor,
  fetchActorRepos,
  fetchActorRepo,
  fetchActorFollowing,
  fetchActorStrings,
  fetchActorIssues,
  fetchActorPulls,
  fetchRepoTree,
  fetchRepoBlob,
  fetchDefaultBranch,
  fetchLanguages,
  fetchRepoLog,
  fetchRepoBranches,
  fetchRepoTags,
  fetchRepoDiff,
  fetchRepoCompare,
  fetchRepoIssues,
  fetchRepoPulls,
  fetchIssueDetail,
  fetchIssueComments,
  fetchPullDetail,
  fetchPullComments,
} from "./endpoints.js";
import {
  normalizeTree,
  normalizeTreeReadme,
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
  normalizeFollowRecord,
  normalizeStringRecord,
} from "./normalizers.js";

export type { CommitEntry, BranchEntry, BlobContent, DefaultBranchInfo, RepoReadme } from "./normalizers.js";

const MIN = 60_000;

function hasText(value: MaybeRef<string | undefined>): boolean {
  return !!toValue(value)?.trim();
}

function isEnabled(required: boolean, enabled?: MaybeRef<boolean>): boolean {
  return required && (enabled === undefined || !!toValue(enabled));
}

/** Resolved identity: DID + PDS hostname for an AT Protocol handle. */
export type Identity = { did: string; pds: string };

/** Resolve a handle through Twister actor endpoint. */
export function useIdentity(handle: MaybeRef<string>, options: { enabled?: MaybeRef<boolean> } = {}) {
  const normalizedHandle = computed(() => toValue(handle).trim());

  return useQuery({
    queryKey: computed(() => ["identity", normalizedHandle.value]),
    queryFn: async (): Promise<Identity> => {
      const actor = await fetchActor(normalizedHandle.value);
      return { did: actor.did, pds: new URL(actor.pds).hostname };
    },
    enabled: computed(() => isEnabled(hasText(normalizedHandle), options.enabled)),
    staleTime: 10 * MIN,
    gcTime: 60 * MIN,
  });
}

/** File tree for a path within a repo. */
export function useRepoTree(
  handle: MaybeRef<string>,
  repo: MaybeRef<string>,
  ref: MaybeRef<string>,
  path: MaybeRef<string | undefined> = undefined,
  options: { enabled?: MaybeRef<boolean> } = {},
) {
  const h = computed(() => toValue(handle).trim());
  const r = computed(() => toValue(repo).trim());

  return useQuery({
    queryKey: computed(() => ["tree", h.value, r.value, toValue(ref), toValue(path)]),
    queryFn: () =>
      fetchRepoTree(h.value, r.value, { repo: `${h.value}/${r.value}`, ref: toValue(ref), path: toValue(path) }).then(
        (out) => normalizeTree(out, toValue(path) ?? ""),
      ),
    enabled: computed(() => isEnabled(hasText(h) && hasText(r) && hasText(ref), options.enabled)),
    staleTime: 2 * MIN,
    gcTime: 10 * MIN,
  });
}

/** README discovered by the repo tree endpoint for a ref root. */
export function useRepoReadme(
  handle: MaybeRef<string>,
  repo: MaybeRef<string>,
  ref: MaybeRef<string>,
  options: { enabled?: MaybeRef<boolean> } = {},
) {
  const h = computed(() => toValue(handle).trim());
  const r = computed(() => toValue(repo).trim());

  return useQuery({
    queryKey: computed(() => ["readme", h.value, r.value, toValue(ref)]),
    queryFn: () =>
      fetchRepoTree(h.value, r.value, { repo: `${h.value}/${r.value}`, ref: toValue(ref) }).then(normalizeTreeReadme),
    enabled: computed(() => isEnabled(hasText(h) && hasText(r) && hasText(ref), options.enabled)),
    staleTime: 5 * MIN,
    gcTime: 30 * MIN,
  });
}

/** Raw file content (blob) for a specific path and ref. */
export function useRepoBlob(
  handle: MaybeRef<string>,
  repo: MaybeRef<string>,
  ref: MaybeRef<string>,
  path: MaybeRef<string>,
  options: { readme?: boolean; enabled?: MaybeRef<boolean> } = {},
) {
  const h = computed(() => toValue(handle).trim());
  const r = computed(() => toValue(repo).trim());

  return useQuery({
    queryKey: computed(() => ["blob", h.value, r.value, toValue(ref), toValue(path)]),
    queryFn: () =>
      fetchRepoBlob(h.value, r.value, { repo: `${h.value}/${r.value}`, ref: toValue(ref), path: toValue(path) }).then(
        normalizeBlob,
      ),
    enabled: computed(() => isEnabled(hasText(h) && hasText(r) && hasText(ref) && hasText(path), options.enabled)),
    staleTime: 5 * MIN,
    gcTime: 30 * MIN,
  });
}

/** Default branch name + latest commit for a repo. */
export function useDefaultBranch(
  handle: MaybeRef<string>,
  repo: MaybeRef<string>,
  options: { enabled?: MaybeRef<boolean> } = {},
) {
  const h = computed(() => toValue(handle).trim());
  const r = computed(() => toValue(repo).trim());

  return useQuery({
    queryKey: computed(() => ["defaultBranch", h.value, r.value]),
    queryFn: () => fetchDefaultBranch(h.value, r.value).then(normalizeDefaultBranch),
    enabled: computed(() => isEnabled(hasText(h) && hasText(r), options.enabled)),
    staleTime: 5 * MIN,
    gcTime: 30 * MIN,
  });
}

/** Language breakdown for a repo (percentages). */
export function useRepoLanguages(
  handle: MaybeRef<string>,
  repo: MaybeRef<string>,
  ref?: MaybeRef<string | undefined>,
  options: { enabled?: MaybeRef<boolean> } = {},
) {
  const h = computed(() => toValue(handle).trim());
  const r = computed(() => toValue(repo).trim());

  return useQuery({
    queryKey: computed(() => ["languages", h.value, r.value, toValue(ref)]),
    queryFn: () => fetchLanguages(h.value, r.value, toValue(ref)).then(normalizeLanguages),
    enabled: computed(() => isEnabled(hasText(h) && hasText(r), options.enabled)),
    staleTime: 5 * MIN,
    gcTime: 30 * MIN,
  });
}

/** Paginated commit log for a repo/ref. */
export function useRepoLog(
  handle: MaybeRef<string>,
  repo: MaybeRef<string>,
  ref: MaybeRef<string>,
  options: {
    path?: MaybeRef<string | undefined>;
    limit?: number;
    cursor?: MaybeRef<string | undefined>;
    enabled?: MaybeRef<boolean>;
  } = {},
) {
  const h = computed(() => toValue(handle).trim());
  const r = computed(() => toValue(repo).trim());

  return useQuery({
    queryKey: computed(() => ["log", h.value, r.value, toValue(ref), toValue(options.path), toValue(options.cursor)]),
    queryFn: () =>
      fetchRepoLog(h.value, r.value, {
        ref: toValue(ref),
        path: toValue(options.path),
        limit: options.limit,
        cursor: toValue(options.cursor),
      }).then(normalizeLogText),
    enabled: computed(() => isEnabled(hasText(h) && hasText(r) && hasText(ref), options.enabled)),
    staleTime: 2 * MIN,
    gcTime: 10 * MIN,
  });
}

/** Branch list for a repo. */
export function useRepoBranches(
  handle: MaybeRef<string>,
  repo: MaybeRef<string>,
  defaultBranch?: MaybeRef<string | undefined>,
  options: { enabled?: MaybeRef<boolean> } = {},
) {
  const h = computed(() => toValue(handle).trim());
  const r = computed(() => toValue(repo).trim());

  return useQuery({
    queryKey: computed(() => ["branches", h.value, r.value]),
    queryFn: () =>
      fetchRepoBranches(h.value, r.value).then((raw) => normalizeBranchesText(raw, toValue(defaultBranch))),
    enabled: computed(() => isEnabled(hasText(h) && hasText(r), options.enabled)),
    staleTime: 2 * MIN,
    gcTime: 10 * MIN,
  });
}

/** Fetch a repo record (metadata: description, topics, knot, etc.). */
export function useRepoRecord(
  handle: MaybeRef<string>,
  repoName: MaybeRef<string>,
  options: { enabled?: MaybeRef<boolean> } = {},
) {
  const h = computed(() => toValue(handle).trim());
  const repo = computed(() => toValue(repoName).trim());

  return useQuery({
    queryKey: computed(() => ["repoRecord", h.value, repo.value]),
    queryFn: async () => {
      const response = await fetchActorRepo(h.value, repo.value);
      return normalizeRepoRecord(response.record.value, response.did, response.handle, response.record.uri);
    },
    enabled: computed(() => isEnabled(hasText(h) && hasText(repo), options.enabled)),
    staleTime: 5 * MIN,
    gcTime: 30 * MIN,
  });
}

/** List all repos for a user. */
export function useUserRepos(handle: MaybeRef<string>, options: { enabled?: MaybeRef<boolean> } = {}) {
  const h = computed(() => toValue(handle).trim());

  return useQuery({
    queryKey: computed(() => ["userRepos", h.value]),
    queryFn: async () => {
      const response = await fetchActorRepos(h.value);
      return response.records.map((r) => normalizeRepoRecord(r.value, response.did, response.handle, r.uri));
    },
    enabled: computed(() => isEnabled(hasText(h), options.enabled)),
    staleTime: 5 * MIN,
    gcTime: 30 * MIN,
  });
}

/** Fetch a user's Tangled actor profile. */
export function useActorProfile(
  handle: MaybeRef<string>,
  displayName?: MaybeRef<string | undefined>,
  options: { enabled?: MaybeRef<boolean> } = {},
) {
  const h = computed(() => toValue(handle).trim());

  return useQuery({
    queryKey: computed(() => ["actorProfile", h.value]),
    queryFn: async () => {
      const response = await fetchActor(h.value);
      return normalizeActorProfile(
        response.profile.value,
        response.did,
        response.handle,
        response.bsky?.displayName ?? toValue(displayName),
        response.bsky?.avatar,
      );
    },
    enabled: computed(() => isEnabled(hasText(h), options.enabled)),
    staleTime: 10 * MIN,
    gcTime: 60 * MIN,
  });
}

/** Tag list for a repo. Wire format is a raw blob; parsed as lines. */
export function useRepoTags(
  handle: MaybeRef<string>,
  repo: MaybeRef<string>,
  options: { enabled?: MaybeRef<boolean> } = {},
) {
  const h = computed(() => toValue(handle).trim());
  const r = computed(() => toValue(repo).trim());

  return useQuery({
    queryKey: computed(() => ["tags", h.value, r.value]),
    queryFn: () => fetchRepoTags(h.value, r.value).then((raw) => raw.trim().split("\n").filter(Boolean)),
    enabled: computed(() => isEnabled(hasText(h) && hasText(r), options.enabled)),
    staleTime: 2 * MIN,
    gcTime: 10 * MIN,
  });
}

/** Unified diff for a ref (patch text). */
export function useRepoDiff(
  handle: MaybeRef<string>,
  repo: MaybeRef<string>,
  ref: MaybeRef<string>,
  options: { enabled?: MaybeRef<boolean> } = {},
) {
  const h = computed(() => toValue(handle).trim());
  const r = computed(() => toValue(repo).trim());

  return useQuery({
    queryKey: computed(() => ["diff", h.value, r.value, toValue(ref)]),
    queryFn: () => fetchRepoDiff(h.value, r.value, { repo: `${h.value}/${r.value}`, ref: toValue(ref) }),
    enabled: computed(() => isEnabled(hasText(h) && hasText(r) && hasText(ref), options.enabled)),
    staleTime: 5 * MIN,
    gcTime: 30 * MIN,
  });
}

/** Comparison diff between two revisions (patch text). */
export function useRepoCompare(
  handle: MaybeRef<string>,
  repo: MaybeRef<string>,
  rev1: MaybeRef<string>,
  rev2: MaybeRef<string>,
  options: { enabled?: MaybeRef<boolean> } = {},
) {
  const h = computed(() => toValue(handle).trim());
  const r = computed(() => toValue(repo).trim());

  return useQuery({
    queryKey: computed(() => ["compare", h.value, r.value, toValue(rev1), toValue(rev2)]),
    queryFn: () =>
      fetchRepoCompare(h.value, r.value, { repo: `${h.value}/${r.value}`, rev1: toValue(rev1), rev2: toValue(rev2) }),
    enabled: computed(() => isEnabled(hasText(h) && hasText(r) && hasText(rev1) && hasText(rev2), options.enabled)),
    staleTime: 5 * MIN,
    gcTime: 30 * MIN,
  });
}

/** Issues for a repo, returned with current state by the backend. */
export function useRepoIssues(
  handle: MaybeRef<string>,
  repo: MaybeRef<string>,
  options: { enabled?: MaybeRef<boolean> } = {},
) {
  const h = computed(() => toValue(handle).trim());
  const r = computed(() => toValue(repo).trim());

  return useQuery({
    queryKey: computed(() => ["issues", h.value, r.value]),
    queryFn: async () => {
      const response = await fetchRepoIssues(h.value, r.value);
      return response.records.map((entry) =>
        normalizeIssueRecord(entry.value, entry.uri, response.did, response.handle, entry.state),
      );
    },
    enabled: computed(() => isEnabled(hasText(h) && hasText(r), options.enabled)),
    staleTime: 2 * MIN,
    gcTime: 10 * MIN,
  });
}

/** Pull requests for a repo, returned with current status by the backend. */
export function useRepoPRs(
  handle: MaybeRef<string>,
  repo: MaybeRef<string>,
  options: { enabled?: MaybeRef<boolean> } = {},
) {
  const h = computed(() => toValue(handle).trim());
  const r = computed(() => toValue(repo).trim());

  return useQuery({
    queryKey: computed(() => ["prs", h.value, r.value]),
    queryFn: async () => {
      const response = await fetchRepoPulls(h.value, r.value);
      return response.records.map((entry) =>
        normalizePullRecord(entry.value, entry.uri, response.did, response.handle, entry.status),
      );
    },
    enabled: computed(() => isEnabled(hasText(h) && hasText(r), options.enabled)),
    staleTime: 2 * MIN,
    gcTime: 10 * MIN,
  });
}

export function useUserStrings(handle: MaybeRef<string>, options: { enabled?: MaybeRef<boolean> } = {}) {
  const h = computed(() => toValue(handle).trim());

  return useQuery({
    queryKey: computed(() => ["userStrings", h.value]),
    queryFn: async (): Promise<StringSummary[]> => {
      const response = await fetchActorStrings(h.value);
      return response.records
        .map((record) => normalizeStringRecord(record.value, record.uri))
        .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));
    },
    enabled: computed(() => isEnabled(hasText(h), options.enabled)),
    staleTime: 2 * MIN,
    gcTime: 10 * MIN,
  });
}

export function useUserFollowing(handle: MaybeRef<string>, options: { enabled?: MaybeRef<boolean> } = {}) {
  const h = computed(() => toValue(handle).trim());

  return useQuery({
    queryKey: computed(() => ["userFollowing", h.value]),
    queryFn: async (): Promise<FollowedUserSummary[]> => {
      const response = await fetchActorFollowing(h.value);
      const follows = response.records
        .map((record) => normalizeFollowRecord(record.value, record.uri))
        .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));

      return Promise.all(
        follows.map(async (follow) => {
          try {
            const subject = await fetchActor(follow.subjectDid);
            return {
              ...normalizeActorProfile(
                subject.profile.value,
                subject.did,
                subject.handle,
                subject.bsky?.displayName,
                subject.bsky?.avatar,
              ),
              followAtUri: follow.atUri,
              followedAt: follow.createdAt,
            };
          } catch {
            return {
              did: follow.subjectDid,
              handle: follow.subjectDid,
              followAtUri: follow.atUri,
              followedAt: follow.createdAt,
            };
          }
        }),
      );
    },
    enabled: computed(() => isEnabled(hasText(h), options.enabled)),
    staleTime: 5 * MIN,
    gcTime: 30 * MIN,
  });
}

export function useUserIssues(handle: MaybeRef<string>, options: { enabled?: MaybeRef<boolean> } = {}) {
  const h = computed(() => toValue(handle).trim());

  return useQuery({
    queryKey: computed(() => ["userIssues", h.value]),
    queryFn: async () => {
      const response = await fetchActorIssues(h.value);
      return response.records
        .map((entry) => normalizeIssueRecord(entry.value, entry.uri, response.did, response.handle, entry.state))
        .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));
    },
    enabled: computed(() => isEnabled(hasText(h), options.enabled)),
    staleTime: 2 * MIN,
    gcTime: 10 * MIN,
  });
}

export function useUserPullRequests(handle: MaybeRef<string>, options: { enabled?: MaybeRef<boolean> } = {}) {
  const h = computed(() => toValue(handle).trim());

  return useQuery({
    queryKey: computed(() => ["userPullRequests", h.value]),
    queryFn: async () => {
      const response = await fetchActorPulls(h.value);
      return response.records
        .map((entry) => normalizePullRecord(entry.value, entry.uri, response.did, response.handle, entry.status))
        .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));
    },
    enabled: computed(() => isEnabled(hasText(h), options.enabled)),
    staleTime: 2 * MIN,
    gcTime: 10 * MIN,
  });
}

export function useIssueDetail(
  handle: MaybeRef<string>,
  issueRkey: MaybeRef<string>,
  options: { enabled?: MaybeRef<boolean> } = {},
) {
  const h = computed(() => toValue(handle).trim());
  const rkey = computed(() => toValue(issueRkey).trim());

  return useQuery({
    queryKey: computed(() => ["issueDetail", h.value, rkey.value]),
    queryFn: async () => {
      const [issueRes, commentsRes, actor] = await Promise.all([
        fetchIssueDetail(h.value, rkey.value),
        fetchIssueComments(h.value, rkey.value),
        fetchActor(h.value),
      ]);

      return normalizeIssueDetail(
        issueRes.value,
        issueRes.uri,
        actor.did,
        actor.handle,
        issueRes.state,
        commentsRes.records.length,
      );
    },
    enabled: computed(() => isEnabled(hasText(h) && hasText(rkey), options.enabled)),
    staleTime: 2 * MIN,
    gcTime: 10 * MIN,
  });
}

export function useIssueComments(
  handle: MaybeRef<string>,
  issueRkey: MaybeRef<string>,
  options: { enabled?: MaybeRef<boolean> } = {},
) {
  const h = computed(() => toValue(handle).trim());
  const rkey = computed(() => toValue(issueRkey).trim());

  return useQuery({
    queryKey: computed(() => ["issueComments", h.value, rkey.value]),
    queryFn: async () => {
      const [response, actor] = await Promise.all([fetchIssueComments(h.value, rkey.value), fetchActor(h.value)]);
      const comments = response.records.map((record) =>
        normalizeIssueComment(record.value, record.uri, actor.did, actor.handle),
      );

      return buildIssueCommentThread(comments);
    },
    enabled: computed(() => isEnabled(hasText(h) && hasText(rkey), options.enabled)),
    staleTime: 2 * MIN,
    gcTime: 10 * MIN,
  });
}

export function usePullRequestDetail(
  handle: MaybeRef<string>,
  pullRkey: MaybeRef<string>,
  options: { enabled?: MaybeRef<boolean> } = {},
) {
  const h = computed(() => toValue(handle).trim());
  const rkey = computed(() => toValue(pullRkey).trim());

  return useQuery({
    queryKey: computed(() => ["pullDetail", h.value, rkey.value]),
    queryFn: async () => {
      const [pullRes, commentsRes, actor] = await Promise.all([
        fetchPullDetail(h.value, rkey.value),
        fetchPullComments(h.value, rkey.value),
        fetchActor(h.value),
      ]);

      return normalizePullDetail(
        pullRes.value,
        pullRes.uri,
        actor.did,
        actor.handle,
        pullRes.status,
        commentsRes.records.length,
      );
    },
    enabled: computed(() => isEnabled(hasText(h) && hasText(rkey), options.enabled)),
    staleTime: 2 * MIN,
    gcTime: 10 * MIN,
  });
}

export function usePullRequestComments(
  handle: MaybeRef<string>,
  pullRkey: MaybeRef<string>,
  options: { enabled?: MaybeRef<boolean> } = {},
) {
  const h = computed(() => toValue(handle).trim());
  const rkey = computed(() => toValue(pullRkey).trim());

  return useQuery({
    queryKey: computed(() => ["pullComments", h.value, rkey.value]),
    queryFn: async () => {
      const [response, actor] = await Promise.all([fetchPullComments(h.value, rkey.value), fetchActor(h.value)]);
      return response.records
        .map((record) => normalizePullComment(record.value, record.uri, actor.did, actor.handle))
        .sort((left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt));
    },
    enabled: computed(() => isEnabled(hasText(h) && hasText(rkey), options.enabled)),
    staleTime: 2 * MIN,
    gcTime: 10 * MIN,
  });
}

/** Composite hook: repo record + default branch + languages in parallel. */
export function useRepoDetail(handle: MaybeRef<string>, repoName: MaybeRef<string>) {
  const record = useRepoRecord(handle, repoName);
  const branch = useDefaultBranch(handle, repoName);
  const languages = useRepoLanguages(handle, repoName);

  const data = computed(() => {
    if (!record.data.value) return undefined;
    return normalizeRepoRecordToDetail(
      {
        name: toValue(repoName),
        knot: record.data.value.knot,
        createdAt: record.data.value.updatedAt ?? "",
        $type: "sh.tangled.repo",
      },
      record.data.value.ownerDid,
      record.data.value.ownerHandle,
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
