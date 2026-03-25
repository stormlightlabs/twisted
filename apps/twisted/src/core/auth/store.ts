import { defineStore } from "pinia";
import { ref, computed, Ref } from "vue";
import type { Session } from "@atcute/oauth-browser-client";
import { getSession, deleteStoredSession, listStoredSessions, OAuthUserAgent } from "@atcute/oauth-browser-client";
import { initializeOAuth } from "./oauth-config.js";

export type AuthState = "idle" | "restoring" | "authenticating" | "authenticated" | "error";

export const useAuthStore = defineStore("auth", () => {
  const state = ref<AuthState>("idle");
  const session = ref<Session | null>(null);
  const userAgent: Ref<OAuthUserAgent | null> = ref(null);
  const error = ref<string | null>(null);
  const accounts = ref<`did:${string}:${string}`[]>([]);

  const isAuthenticated = computed(() => state.value === "authenticated" && session.value !== null);
  const did = computed(() => session.value?.info.sub ?? null);
  const pds = computed(() => session.value?.info.aud ?? null);

  function initialize() {
    initializeOAuth();
    accounts.value = listStoredSessions();
  }

  async function restoreSession(preferredDid?: `did:${string}:${string}`): Promise<boolean> {
    state.value = "restoring";
    error.value = null;

    try {
      const dids = listStoredSessions();
      if (dids.length === 0) {
        state.value = "idle";
        return false;
      }

      const targetDid = preferredDid && dids.includes(preferredDid) ? preferredDid : dids[0];
      const restoredSession = await getSession(targetDid, { allowStale: true });

      session.value = restoredSession;
      userAgent.value = new OAuthUserAgent(restoredSession);
      accounts.value = dids;
      state.value = "authenticated";
      return true;
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Failed to restore session";
      state.value = "error";
      return false;
    }
  }

  async function switchAccount(targetDid: `did:${string}:${string}`): Promise<boolean> {
    if (!accounts.value.includes(targetDid)) {
      error.value = "Account not found";
      return false;
    }

    return restoreSession(targetDid);
  }

  function setSession(newSession: Session) {
    session.value = newSession;
    userAgent.value = new OAuthUserAgent(newSession);
    state.value = "authenticated";
    error.value = null;
    accounts.value = listStoredSessions();
  }

  async function refreshSession(): Promise<boolean> {
    if (!session.value) return false;

    try {
      const refreshed = await getSession(session.value.info.sub, { noCache: true });
      session.value = refreshed;
      userAgent.value = new OAuthUserAgent(refreshed);
      return true;
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Failed to refresh session";
      return false;
    }
  }

  async function logout(): Promise<void> {
    if (userAgent.value) {
      try {
        await userAgent.value.signOut();
      } catch {
        if (session.value) {
          deleteStoredSession(session.value.info.sub);
        }
      }
    } else if (session.value) {
      deleteStoredSession(session.value.info.sub);
    }

    session.value = null;
    userAgent.value = null;
    state.value = "idle";
    error.value = null;
    accounts.value = listStoredSessions();
  }

  async function logoutAll(): Promise<void> {
    const dids = listStoredSessions();
    for (const d of dids) {
      deleteStoredSession(d);
    }
    session.value = null;
    userAgent.value = null;
    state.value = "idle";
    error.value = null;
    accounts.value = [];
  }

  function getUserAgent(): OAuthUserAgent | null {
    return userAgent.value;
  }

  return {
    state,
    session,
    userAgent,
    error,
    accounts,
    isAuthenticated,
    did,
    pds,
    initialize,
    restoreSession,
    switchAccount,
    setSession,
    refreshSession,
    logout,
    logoutAll,
    getUserAgent,
  };
});
