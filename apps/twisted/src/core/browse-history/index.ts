const REPOS_KEY = "twisted-recent-repos";
const PROFILES_KEY = "twisted-recent-profiles";
const MAX_ITEMS = 10;

export type RecentRepo = {
  ownerHandle: string;
  name: string;
  description?: string;
  primaryLanguage?: string;
  stars?: number;
  visitedAt: number;
};

export type RecentProfile = { handle: string; displayName?: string; bio?: string; visitedAt: number };

function read<T>(key: string): T[] {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    return JSON.parse(raw) as T[];
  } catch {
    return [];
  }
}

function write<T>(key: string, items: T[]): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(items));
  } catch (error) {
    console.warn("Failed to write browse history to localStorage", { error });
  }
}

export function getRecentRepos(): RecentRepo[] {
  return read<RecentRepo>(REPOS_KEY);
}

export function trackRepoVisit(repo: Omit<RecentRepo, "visitedAt">): void {
  const existing = read<RecentRepo>(REPOS_KEY).filter(
    (r) => !(r.ownerHandle === repo.ownerHandle && r.name === repo.name),
  );
  existing.unshift({ ...repo, visitedAt: Date.now() });
  write(REPOS_KEY, existing.slice(0, MAX_ITEMS));
}

export function getRecentProfiles(): RecentProfile[] {
  return read<RecentProfile>(PROFILES_KEY);
}

export function trackProfileVisit(profile: Omit<RecentProfile, "visitedAt">): void {
  const existing = read<RecentProfile>(PROFILES_KEY).filter((p) => p.handle !== profile.handle);
  existing.unshift({ ...profile, visitedAt: Date.now() });
  write(PROFILES_KEY, existing.slice(0, MAX_ITEMS));
}

export function clearBrowseHistory(): void {
  write(REPOS_KEY, []);
  write(PROFILES_KEY, []);
}
