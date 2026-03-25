const STORAGE_KEY = "twisted-search-history";
const MAX_ITEMS = 10;

export type SearchHistoryEntry = { query: string; timestamp: number };

function readHistory(): SearchHistoryEntry[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as SearchHistoryEntry[];
  } catch {
    return [];
  }
}

function writeHistory(entries: SearchHistoryEntry[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch (error) {
    console.warn("Failed to write search history to localStorage", { error });
  }
}

export function getSearchHistory(): SearchHistoryEntry[] {
  return readHistory();
}

export function addToSearchHistory(query: string): void {
  const trimmed = query.trim();
  if (!trimmed) return;

  const entries = readHistory().filter((e) => e.query !== trimmed);
  entries.unshift({ query: trimmed, timestamp: Date.now() });
  writeHistory(entries.slice(0, MAX_ITEMS));
}

export function removeFromSearchHistory(query: string): void {
  writeHistory(readHistory().filter((e) => e.query !== query));
}

export function clearSearchHistory(): void {
  writeHistory([]);
}
