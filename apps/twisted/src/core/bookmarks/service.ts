import { computed, readonly, shallowRef } from "vue";
import { del, get, set } from "idb-keyval";
import type { RepoSummary } from "@/domain/models/repo.js";
import type { StringSummary } from "@/domain/models/string.js";
import type { BlobContent } from "@/services/tangled/normalizers.js";
import type { BookmarkItem, BookmarkKind, BookmarkedRepo, SavedFile, SavedString } from "@/domain/models/bookmark.js";

const BOOKMARKS_KEY = "twisted-bookmarks";

type BookmarkStorage = { load(): Promise<BookmarkItem[]>; save(items: BookmarkItem[]): Promise<void> };

const state = shallowRef<BookmarkItem[]>([]);
let loaded = false;
let loadPromise: Promise<BookmarkItem[]> | null = null;
const defaultStorage: BookmarkStorage = {
  async load() {
    return ((await get<BookmarkItem[]>(BOOKMARKS_KEY)) ?? []).map(normalizeBookmarkItem);
  },
  async save(items) {
    if (items.length === 0) {
      await del(BOOKMARKS_KEY);
      return;
    }
    await set(BOOKMARKS_KEY, items);
  },
};
let storage: BookmarkStorage = defaultStorage;

function normalizeBookmarkItem(item: BookmarkItem): BookmarkItem {
  return item;
}

function sortItems(items: BookmarkItem[]): BookmarkItem[] {
  return [...items].sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}

async function persist(items: BookmarkItem[]): Promise<BookmarkItem[]> {
  const next = sortItems(items);
  state.value = next;
  loaded = true;
  await storage.save(next);
  return next;
}

export async function ensureBookmarksLoaded(): Promise<BookmarkItem[]> {
  if (loaded) return state.value;
  if (!loadPromise) {
    loadPromise = storage.load().then((items) => {
      state.value = sortItems(items);
      loaded = true;
      loadPromise = null;
      return state.value;
    });
  }
  return loadPromise;
}

export function useBookmarks() {
  void ensureBookmarksLoaded();
  return { bookmarks: readonly(state), hasBookmarks: computed(() => state.value.length > 0) };
}

export function buildRepoBookmarkId(atUri: string): string {
  return `repo:${atUri}`;
}

export function buildStringBookmarkId(atUri: string): string {
  return `string:${atUri}`;
}

export function buildFileBookmarkId(owner: string, repo: string, branch: string, path: string): string {
  return `file:${owner}/${repo}/${branch}/${path}`;
}

export async function listBookmarks(kind?: BookmarkKind): Promise<BookmarkItem[]> {
  const items = await ensureBookmarksLoaded();
  return kind ? items.filter((item) => item.kind === kind) : items;
}

export async function getBookmark(id: string): Promise<BookmarkItem | undefined> {
  return (await ensureBookmarksLoaded()).find((item) => item.id === id);
}

export async function isBookmarked(id: string): Promise<boolean> {
  return (await ensureBookmarksLoaded()).some((item) => item.id === id);
}

export function hasBookmark(id: string): boolean {
  return state.value.some((item) => item.id === id);
}

export async function removeBookmark(id: string): Promise<void> {
  await persist((await ensureBookmarksLoaded()).filter((item) => item.id !== id));
}

export async function removeRepoBookmark(id: string): Promise<void> {
  await removeBookmark(id);
}

export async function saveRepoBookmark(repo: RepoSummary): Promise<BookmarkedRepo> {
  const now = new Date().toISOString();
  const bookmark: BookmarkedRepo = {
    id: buildRepoBookmarkId(repo.atUri),
    kind: "repo",
    title: `${repo.ownerHandle}/${repo.name}`,
    ownerHandle: repo.ownerHandle,
    repoName: repo.name,
    atUri: repo.atUri,
    savedAt: now,
    lastFetchedAt: now,
    repo,
  };
  await persist([bookmark, ...(await ensureBookmarksLoaded()).filter((item) => item.id !== bookmark.id)]);
  return bookmark;
}

export async function saveStringBookmark(ownerHandle: string, stringItem: StringSummary): Promise<SavedString> {
  const now = new Date().toISOString();
  const bookmark: SavedString = {
    id: buildStringBookmarkId(stringItem.atUri),
    kind: "string",
    title: stringItem.filename,
    ownerHandle,
    atUri: stringItem.atUri,
    filename: stringItem.filename,
    description: stringItem.description,
    contents: stringItem.contents,
    createdAt: stringItem.createdAt,
    savedAt: now,
    lastFetchedAt: now,
  };
  await persist([bookmark, ...(await ensureBookmarksLoaded()).filter((item) => item.id !== bookmark.id)]);
  return bookmark;
}

export async function saveFileBookmark(file: SavedFileInput): Promise<SavedFile> {
  const now = new Date().toISOString();
  const bookmark: SavedFile = { ...file, savedAt: now, lastFetchedAt: now };
  await persist([bookmark, ...(await ensureBookmarksLoaded()).filter((item) => item.id !== bookmark.id)]);
  return bookmark;
}

type SavedFileInput = Omit<SavedFile, "savedAt" | "lastFetchedAt">;

export function createSavedFileInput(
  ownerHandle: string,
  repoName: string,
  branch: string,
  path: string,
  blob: BlobContent,
  sourceKind: "file" | "readme",
): SavedFileInput {
  return {
    id: buildFileBookmarkId(ownerHandle, repoName, branch, path),
    kind: "file",
    title: path.split("/").pop() ?? path,
    ownerHandle,
    repoName,
    branch,
    path,
    sourceKind,
    content: blob.content,
    encoding: blob.encoding,
    isBinary: blob.isBinary,
    mimeType: blob.mimeType,
    size: blob.size,
  };
}

export function resetBookmarkStateForTests(nextStorage?: BookmarkStorage): void {
  state.value = [];
  loaded = false;
  loadPromise = null;
  storage = nextStorage ?? defaultStorage;
}
