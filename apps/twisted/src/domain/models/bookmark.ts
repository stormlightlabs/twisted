import type { RepoSummary } from "./repo.ts";

export type BookmarkKind = "repo" | "string" | "file";

type BookmarkBase = { id: string; kind: BookmarkKind; title: string; savedAt: string; lastFetchedAt: string };

export type BookmarkedRepo = BookmarkBase & {
  kind: "repo";
  ownerHandle: string;
  repoName: string;
  atUri: string;
  repo: RepoSummary;
};

export type SavedString = BookmarkBase & {
  kind: "string";
  ownerHandle: string;
  atUri: string;
  filename: string;
  description?: string;
  contents: string;
  createdAt: string;
};

export type SavedFile = BookmarkBase & {
  kind: "file";
  ownerHandle: string;
  repoName: string;
  branch: string;
  path: string;
  sourceAtUri?: string;
  sourceKind: "file" | "readme";
  content: string;
  encoding: "utf-8" | "base64";
  isBinary: boolean;
  mimeType?: string;
  size?: number;
};

export type BookmarkItem = BookmarkedRepo | SavedString | SavedFile;
