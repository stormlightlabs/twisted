/**
 * TanStack Query hooks for Constellation backlink counts, proxied through the Twister API.
 */
import { useQuery } from "@tanstack/vue-query";
import { computed, toValue } from "vue";
import type { MaybeRef } from "vue";
import { getTwisterApiUrl } from "@/core/config/project.js";

const SOURCE_STAR = "sh.tangled.feed.star:.subject";
const SOURCE_FOLLOW = "sh.tangled.graph.follow:.subject";

const MIN = 60_000;

async function fetchBacklinksCount(subject: string, source: string): Promise<number> {
  const url = new URL(getTwisterApiUrl("/backlinks/count"));
  url.searchParams.set("subject", subject);
  url.searchParams.set("source", source);

  const res = await fetch(url.toString(), { headers: { Accept: "application/json" } });

  if (!res.ok) {
    throw new Error(`Backlinks request failed: ${res.status}`);
  }

  const data = (await res.json()) as { count: number };
  return data.count;
}

/**
 * Fetches the star count for a repo AT URI from Constellation.
 * atUri should be in the form "at://did:plc:.../sh.tangled.repo/reponame".
 */
export function useRepoStarCount(atUri: MaybeRef<string>, options: { enabled?: MaybeRef<boolean> } = {}) {
  const normalizedUri = computed(() => toValue(atUri).trim());
  const enabled = computed(
    () => normalizedUri.value.length > 0 && (options.enabled === undefined || !!toValue(options.enabled)),
  );

  return useQuery({
    queryKey: computed(() => ["constellationStars", normalizedUri.value]),
    queryFn: () => fetchBacklinksCount(normalizedUri.value, SOURCE_STAR),
    enabled,
    staleTime: 5 * MIN,
    gcTime: 30 * MIN,
  });
}

/**
 * Fetches the follower count for a DID from Constellation.
 */
export function useFollowerCount(did: MaybeRef<string>, options: { enabled?: MaybeRef<boolean> } = {}) {
  const normalizedDid = computed(() => toValue(did).trim());
  const enabled = computed(
    () => normalizedDid.value.length > 0 && (options.enabled === undefined || !!toValue(options.enabled)),
  );

  return useQuery({
    queryKey: computed(() => ["constellationFollowers", normalizedDid.value]),
    queryFn: () => fetchBacklinksCount(normalizedDid.value, SOURCE_FOLLOW),
    enabled,
    staleTime: 5 * MIN,
    gcTime: 30 * MIN,
  });
}
