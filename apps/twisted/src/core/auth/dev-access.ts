import { readonly, ref } from "vue";
import { isDevBuild } from "@/core/config/app.ts";

const STORAGE_KEY = "twisted-dev-auth-enabled";

const devAuthEnabled = ref(readStoredDevAuthEnabled());

export function useDevAuthFeatures() {
  return {
    canToggleDevAuth: isDevBuild,
    isDevAuthEnabled: readonly(devAuthEnabled),
    setDevAuthEnabled,
  };
}

export function getIsDevAuthEnabled(): boolean {
  return devAuthEnabled.value;
}

export function setDevAuthEnabled(value: boolean): void {
  if (!isDevBuild) return;

  devAuthEnabled.value = value;

  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, value ? "true" : "false");
  }
}

function readStoredDevAuthEnabled(): boolean {
  if (!isDevBuild) return false;
  if (typeof window === "undefined") return true;

  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored !== "false";
}
