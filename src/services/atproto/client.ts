import { Client, simpleFetchHandler } from "@atcute/client";
import { MalformedResponseError, NetworkError, NotFoundError, RateLimitedError } from "@/core/errors/tangled.js";

/**  Cache knot clients by hostname to avoid creating duplicates */
const knotClientCache = new Map<string, Client>();

/**
 * Returns a singleton XRPC client for the given knot hostname.
 * e.g. getKnotClient('us-west.tangled.sh')
 */
export function getKnotClient(knotHost: string): Client {
  const cached = knotClientCache.get(knotHost);
  if (cached) return cached;

  const client = new Client({ handler: simpleFetchHandler({ service: `https://${knotHost}` }) });
  knotClientCache.set(knotHost, client);
  return client;
}

/**
 * PDS client — used for com.atproto.repo.getRecord calls.
 * Points at bsky.social by default; resolve-handle first to find a user's actual PDS.
 */
export const pdsClient = new Client({ handler: simpleFetchHandler({ service: "https://bsky.social" }) });

/**
 * Inspect an XRPC error response and throw the appropriate typed error.
 * Call this after checking `!response.ok`.
 */
export function throwOnXrpcError(status: number, error: string, message?: string): never {
  if (status === 404 || error === "NotFound" || error === "RepoNotFound") {
    throw new NotFoundError(message ?? "Resource");
  }
  if (status === 429 || error === "RateLimitExceeded") {
    throw new RateLimitedError();
  }
  if (status === 0 || error === "NetworkError" || error === "Timeout") {
    throw new NetworkError(message);
  }
  throw new MalformedResponseError(error, message);
}
