import { useQuery } from "@tanstack/vue-query";
import { computed, toValue } from "vue";
import type { MaybeRef } from "vue";
import { hasTwisterApi } from "@/core/config/project.js";
import type { RepoSummary } from "@/domain/models/repo.js";
import type { UserSummary } from "@/domain/models/user.js";
import { fetchProjectApiJson } from "./client.js";

const MIN = 60_000;

export type ProjectSearchMode = "keyword" | "semantic" | "hybrid";
export type ProjectSearchType = "all" | "repo" | "profile";

type ProjectSearchResult = {
  id: string;
  did?: string;
  at_uri?: string;
  collection: string;
  record_type: string;
  title: string;
  body_snippet?: string;
  summary?: string;
  repo_name?: string;
  author_handle?: string;
  score?: number;
  matched_by?: string[];
  created_at?: string;
  updated_at?: string;
  primary_language?: string;
  stars?: number;
  follower_count?: number;
  following_count?: number;
};

type ProjectSearchResponse = {
  query: string;
  mode: ProjectSearchMode;
  total: number;
  limit: number;
  offset: number;
  results: ProjectSearchResult[];
};

type IndexedProfileSummaryResponse = {
  did: string;
  handle?: string;
  follower_count?: number;
  following_count?: number;
  indexed_at?: string;
};

export type IndexedProfileSummary = {
  did: string;
  handle?: string;
  followerCount?: number;
  followingCount?: number;
  indexedAt?: string;
};

export type ProjectSearchResults = {
  query: string;
  mode: ProjectSearchMode;
  total: number;
  repos: RepoSummary[];
  profiles: UserSummary[];
};

function stripHighlight(html?: string): string | undefined {
  if (!html) return undefined;

  const text = html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text || undefined;
}

function parseAtUriRkey(atUri?: string, fallback = ""): string {
  if (!atUri) return fallback;

  const segments = atUri.split("/");
  return segments[segments.length - 1] || fallback;
}

function toRepoSummary(result: ProjectSearchResult): RepoSummary {
  const atUri = result.at_uri ?? result.id;
  const repoName = result.repo_name ?? result.title;

  return {
    atUri,
    rkey: parseAtUriRkey(result.at_uri, result.id),
    ownerDid: result.did ?? "",
    ownerHandle: result.author_handle ?? "unknown",
    name: repoName,
    description: result.summary ?? stripHighlight(result.body_snippet),
    primaryLanguage: result.primary_language,
    stars: result.stars,
    updatedAt: result.updated_at ?? result.created_at,
    knot: "",
  };
}

function toUserSummary(result: ProjectSearchResult): UserSummary {
  const handle = result.author_handle ?? result.title;
  const displayName = result.title !== handle ? result.title : undefined;

  return {
    did: result.did ?? "",
    handle,
    displayName,
    bio: result.summary ?? stripHighlight(result.body_snippet),
    followerCount: result.follower_count,
    followingCount: result.following_count,
  };
}

function normalizeProfileSummary(summary: IndexedProfileSummaryResponse): IndexedProfileSummary {
  return {
    did: summary.did,
    handle: summary.handle,
    followerCount: summary.follower_count,
    followingCount: summary.following_count,
    indexedAt: summary.indexed_at,
  };
}

export function useProjectSearch(
  query: MaybeRef<string>,
  options: {
    type?: MaybeRef<ProjectSearchType>;
    mode?: MaybeRef<ProjectSearchMode>;
    limit?: number;
    enabled?: MaybeRef<boolean>;
  } = {},
) {
  const normalizedQuery = computed(() => toValue(query).trim());
  const normalizedType = computed(() => toValue(options.type) ?? "all");
  const normalizedMode = computed(() => toValue(options.mode) ?? "keyword");
  const enabled = computed(
    () =>
      hasTwisterApi &&
      normalizedQuery.value.length > 0 &&
      (options.enabled === undefined || !!toValue(options.enabled)),
  );

  return useQuery({
    queryKey: computed(() => ["projectSearch", normalizedQuery.value, normalizedType.value, normalizedMode.value]),
    queryFn: async (): Promise<ProjectSearchResults> => {
      const params = new URLSearchParams({
        q: normalizedQuery.value,
        mode: normalizedMode.value,
        limit: String(options.limit ?? 20),
      });

      if (normalizedType.value !== "all") {
        params.set("type", normalizedType.value);
      }

      const response = await fetchProjectApiJson<ProjectSearchResponse>(`/search?${params.toString()}`);
      const repos = response.results.filter((result) => result.record_type === "repo").map(toRepoSummary);
      const profiles = response.results.filter((result) => result.record_type === "profile").map(toUserSummary);

      return { query: response.query, mode: response.mode, total: response.total, repos, profiles };
    },
    enabled,
    staleTime: 2 * MIN,
    gcTime: 10 * MIN,
  });
}

export function useIndexedProfileSummary(did: MaybeRef<string>, options: { enabled?: MaybeRef<boolean> } = {}) {
  const normalizedDid = computed(() => toValue(did).trim());
  const enabled = computed(
    () =>
      hasTwisterApi && normalizedDid.value.length > 0 && (options.enabled === undefined || !!toValue(options.enabled)),
  );

  return useQuery({
    queryKey: computed(() => ["indexedProfileSummary", normalizedDid.value]),
    queryFn: async () => {
      const response = await fetchProjectApiJson<IndexedProfileSummaryResponse>(
        `/profiles/${encodeURIComponent(normalizedDid.value)}/summary`,
      );
      return normalizeProfileSummary(response);
    },
    enabled,
    staleTime: 10 * MIN,
    gcTime: 30 * MIN,
  });
}
