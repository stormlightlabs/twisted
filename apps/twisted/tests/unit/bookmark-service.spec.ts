import { describe, expect, it, beforeEach } from "vitest";
import type { BookmarkItem } from "@/domain/models/bookmark.ts";
import {
  buildFileBookmarkId,
  buildRepoBookmarkId,
  buildStringBookmarkId,
  createSavedFileInput,
  getBookmark,
  hasBookmark,
  listBookmarks,
  removeBookmark,
  resetBookmarkStateForTests,
  saveFileBookmark,
  saveRepoBookmark,
  saveStringBookmark,
} from "@/core/bookmarks/service.ts";

function memoryStorage(seed: BookmarkItem[] = []) {
  let items = [...seed];
  return {
    async load() {
      return [...items];
    },
    async save(next: BookmarkItem[]) {
      items = [...next];
    },
  };
}

describe("bookmark service", () => {
  beforeEach(() => {
    resetBookmarkStateForTests(memoryStorage());
  });

  it("saves, lists, and removes mixed bookmark kinds", async () => {
    await saveRepoBookmark({
      atUri: "at://did:plc:test/sh.tangled.repo/demo",
      rkey: "demo",
      ownerDid: "did:plc:test",
      ownerHandle: "alice.test",
      name: "demo",
      description: "demo repo",
      knot: "knot.test",
    });
    await saveStringBookmark("alice.test", {
      atUri: "at://did:plc:test/sh.tangled.string/snippet",
      rkey: "snippet",
      filename: "main.ts",
      contents: "console.log('hi')",
      createdAt: "2026-03-25T10:00:00Z",
    });
    await saveFileBookmark(
      createSavedFileInput(
        "alice.test",
        "demo",
        "main",
        "README.md",
        { path: "README.md", content: "# Demo", encoding: "utf-8", isBinary: false },
        "readme",
      ),
    );

    expect((await listBookmarks()).map((item) => item.kind).sort()).toEqual(["file", "repo", "string"]);
    expect(await listBookmarks("repo")).toHaveLength(1);
    expect(await listBookmarks("string")).toHaveLength(1);
    expect(await listBookmarks("file")).toHaveLength(1);

    const repoId = buildRepoBookmarkId("at://did:plc:test/sh.tangled.repo/demo");
    await removeBookmark(repoId);

    expect(await getBookmark(repoId)).toBeUndefined();
    expect(await listBookmarks("repo")).toHaveLength(0);
  });

  it("overwrites existing bookmarks and keeps reactive lookup current", async () => {
    const stringId = buildStringBookmarkId("at://did:plc:test/sh.tangled.string/snippet");

    await saveStringBookmark("alice.test", {
      atUri: "at://did:plc:test/sh.tangled.string/snippet",
      rkey: "snippet",
      filename: "main.ts",
      contents: "one",
      createdAt: "2026-03-25T10:00:00Z",
    });
    await saveStringBookmark("alice.test", {
      atUri: "at://did:plc:test/sh.tangled.string/snippet",
      rkey: "snippet",
      filename: "main.ts",
      contents: "two",
      createdAt: "2026-03-25T10:00:00Z",
    });

    expect(hasBookmark(stringId)).toBe(true);
    expect((await getBookmark(stringId))?.kind).toBe("string");
    expect((await getBookmark(stringId))?.kind === "string" && (await getBookmark(stringId))?.contents).toBe("two");
  });

  it("builds stable file bookmark ids", () => {
    expect(buildFileBookmarkId("alice.test", "demo", "main", "docs/README.md")).toBe(
      "file:alice.test/demo/main/docs/README.md",
    );
  });
});
