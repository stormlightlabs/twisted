/**
 * TanStack Query hooks for the Constellation backlink API.
 * https://constellation.microcosm.blue
 *
 * Constellation is a public AT Protocol backlink index. It answers
 * "how many records link to this subject?" — star counts, follower
 * counts, reaction counts — without requiring authentication.
 *
 * Calling it directly from the app avoids adding per-resource endpoints
 * to the Twister API for every social signal we need.
 */
import { useQuery } from "@tanstack/vue-query";
import { computed, toValue } from "vue";
import type { MaybeRef } from "vue";

const CONSTELLATION_BASE = "https://constellation.microcosm.blue";

// AT Protocol collection + field paths used as Constellation "sources".
const SOURCE_STAR = "sh.tangled.feed.star:subject.uri";
const SOURCE_FOLLOW = "sh.tangled.graph.follow:subject";

const MIN = 60_000;

async function fetchBacklinksCount(subject: string, source: string): Promise<number> {
  const url = new URL(`${CONSTELLATION_BASE}/xrpc/blue.microcosm.links.getBacklinksCount`);
  url.searchParams.set("subject", subject);
  url.searchParams.set("source", source);

  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
  });

  if (!res.ok) {
    throw new Error(`Constellation request failed: ${res.status}`);
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
