import { Client } from "@atcute/client";
import type { OAuthUserAgent } from "@atcute/oauth-browser-client";
import { useAuthStore } from "./store.ts";

let authClient: Client | null = null;
let currentUserAgent: OAuthUserAgent | null = null;

export function getAuthClient(): Client | null {
  const authStore = useAuthStore();
  const userAgent = authStore.getUserAgent();

  if (!userAgent) {
    authClient = null;
    currentUserAgent = null;
    return null;
  }

  if (authClient && currentUserAgent === userAgent) {
    return authClient;
  }

  authClient = new Client({ handler: userAgent });
  currentUserAgent = userAgent;
  return authClient;
}

export function requireAuthClient(): Client {
  const client = getAuthClient();
  if (!client) {
    throw new Error("Authentication required");
  }
  return client;
}

export function clearAuthClient(): void {
  authClient = null;
  currentUserAgent = null;
}
