import { computed, readonly, ref } from "vue";

export type ThemePreference = "system" | "light" | "dark";

type ResolvedTheme = "light" | "dark";

const STORAGE_KEY = "twisted-theme-preference";
const DARK_CLASS = "ion-palette-dark";
const SYSTEM_DARK_QUERY = "(prefers-color-scheme: dark)";

const themePreference = ref<ThemePreference>(readStoredThemePreference());
const resolvedTheme = ref<ResolvedTheme>(resolveThemePreference(themePreference.value));

let hasRegisteredMediaListener = false;

export function useThemePreference() {
  return {
    themePreference: readonly(themePreference),
    resolvedTheme: readonly(resolvedTheme),
    isSystemTheme: computed(() => themePreference.value === "system"),
    setThemePreference,
  };
}

export function initializeThemePreference() {
  applyResolvedTheme(resolveThemePreference(themePreference.value));

  if (hasRegisteredMediaListener || typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return;
  }

  const mediaQuery = window.matchMedia(SYSTEM_DARK_QUERY);
  const handleChange = () => {
    if (themePreference.value !== "system") return;
    applyResolvedTheme(mediaQuery.matches ? "dark" : "light");
  };

  if (typeof mediaQuery.addEventListener === "function") {
    mediaQuery.addEventListener("change", handleChange);
  } else if (typeof (mediaQuery as MediaQueryList & { addListener?: typeof handleChange }).addListener === "function") {
    (mediaQuery as MediaQueryList & { addListener?: typeof handleChange }).addListener?.(handleChange);
  }

  hasRegisteredMediaListener = true;
}

export function setThemePreference(value: ThemePreference) {
  themePreference.value = value;
  resolvedTheme.value = resolveThemePreference(value);
  applyResolvedTheme(resolvedTheme.value);

  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, value);
  }
}

function readStoredThemePreference(): ThemePreference {
  if (typeof window === "undefined") return "system";

  const storedValue = window.localStorage.getItem(STORAGE_KEY);
  return isThemePreference(storedValue) ? storedValue : "system";
}

function resolveThemePreference(value: ThemePreference): ResolvedTheme {
  if (value === "dark" || value === "light") return value;

  if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
    return window.matchMedia(SYSTEM_DARK_QUERY).matches ? "dark" : "light";
  }

  return "light";
}

function applyResolvedTheme(value: ResolvedTheme) {
  resolvedTheme.value = value;

  if (typeof document === "undefined") return;

  const root = document.documentElement;
  root.classList.toggle(DARK_CLASS, value === "dark");
  root.dataset.theme = value;
  root.style.colorScheme = value;
}

function isThemePreference(value: string | null): value is ThemePreference {
  return value === "system" || value === "light" || value === "dark";
}
