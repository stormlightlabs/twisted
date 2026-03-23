/**
 * Transforms raw @atcute/tangled lexicon responses into app domain models.
 * No @atcute imports should appear in Vue components — this is the boundary.
 */

import type {
  ShTangledRepoTree,
  ShTangledRepoBlob,
  ShTangledRepoGetDefaultBranch,
  ShTangledRepoLanguages,
  ShTangledRepo,
  ShTangledActorProfile,
  ShTangledRepoIssue,
  ShTangledRepoIssueComment,
  ShTangledRepoPull,
  ShTangledRepoPullComment,
  ShTangledGraphFollow,
  ShTangledString,
} from "@atcute/tangled";
import type { RepoFile, RepoSummary, RepoDetail } from "@/domain/models/repo.js";
import type { UserSummary } from "@/domain/models/user.js";
import type { IssueSummary, IssueDetail } from "@/domain/models/issue.js";
import type { PullRequestSummary, PullRequestDetail } from "@/domain/models/pull-request.js";
import type { IssueComment, PullRequestComment } from "@/domain/models/comment.js";
import type { FollowSummary } from "@/domain/models/follow.js";
import type { StringSummary } from "@/domain/models/string.js";
import { getAtUriRkey } from "./uris.js";

function modeToFileKind(mode: string): RepoFile["type"] {
  const normalizedMode = mode.replace(/^0+/, "");
  if (normalizedMode === "40000") return "dir";
  if (normalizedMode === "160000") return "submodule";
  return "file";
}

export function normalizeTreeEntry(entry: ShTangledRepoTree.TreeEntry, parentPath: string): RepoFile {
  const kind = modeToFileKind(entry.mode);
  return {
    name: entry.name,
    path: parentPath ? `${parentPath}/${entry.name}` : entry.name,
    type: kind,
    size: kind === "file" ? entry.size : undefined,
    lastCommitMessage: entry.last_commit?.message,
  };
}

export function normalizeTree(output: ShTangledRepoTree.$output, currentPath = ""): RepoFile[] {
  return output.files.map((entry) => normalizeTreeEntry(entry, currentPath));
}

export type BlobContent = {
  path: string;
  content: string;
  encoding: "utf-8" | "base64";
  isBinary: boolean;
  mimeType?: string;
  size?: number;
};

export function normalizeBlob(output: ShTangledRepoBlob.$output): BlobContent {
  return {
    path: output.path,
    content: output.content ?? "",
    encoding: (output.encoding as "utf-8" | "base64") ?? "utf-8",
    isBinary: output.isBinary ?? false,
    mimeType: output.mimeType,
    size: output.size,
  };
}

export type DefaultBranchInfo = { name: string; hash: string; message?: string; when: string };

export function normalizeDefaultBranch(output: ShTangledRepoGetDefaultBranch.$output): DefaultBranchInfo {
  return { name: output.name, hash: output.hash, message: output.message, when: output.when };
}

export function normalizeLanguages(output: ShTangledRepoLanguages.$output): Record<string, number> {
  return Object.fromEntries(output.languages.map((l) => [l.name, l.percentage]));
}

export type CommitEntry = {
  hash: string;
  shortHash?: string;
  message: string;
  when: string;
  authorName?: string;
  authorEmail?: string;
};

export function normalizeLogText(raw: string): CommitEntry[] {
  const text = raw.trim();
  if (!text) return [];

  if (text.startsWith("[")) {
    try {
      const parsed = JSON.parse(text) as unknown[];
      return parsed.map((item) => normalizeCommitObject(item as Record<string, unknown>));
    } catch {
      console.warn("Failed to parse log as JSON array, falling back to other formats");
    }
  }

  if (text.startsWith("{")) {
    try {
      const parsed = JSON.parse(text) as Record<string, unknown>;
      const commits = getCommitObjects(parsed);
      if (commits.length) {
        return commits.map((item) => normalizeCommitObject(item));
      }
    } catch {
      try {
        return text
          .split("\n")
          .filter(Boolean)
          .map((line) => normalizeCommitObject(JSON.parse(line) as Record<string, unknown>));
      } catch {
        console.warn("Failed to parse log as JSON, falling back to other formats");
      }
    }
  }

  return text
    .split("\n")
    .filter(Boolean)
    .map((line) => ({ hash: "", message: line, when: "" }));
}

function getCommitObjects(obj: Record<string, unknown>): Array<Record<string, unknown>> {
  const collections = [obj.commits, obj.log, obj.entries];

  for (const value of collections) {
    if (Array.isArray(value)) {
      return value.filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null);
    }
  }

  if ("hash" in obj || "sha" in obj || "id" in obj || "message" in obj || "subject" in obj) {
    return [obj];
  }

  return [];
}

function normalizeCommitObject(obj: Record<string, unknown>): CommitEntry {
  const hash = normalizeCommitHash(obj.hash ?? obj.sha ?? obj.id) ?? "";
  const shortHash = normalizeCommitHash(obj.shortHash) || (hash ? hash.slice(0, 7) : undefined);

  return {
    hash,
    shortHash,
    message: String(obj.message ?? obj.subject ?? ""),
    when: String(obj.when ?? obj.date ?? obj.timestamp ?? ""),
    authorName: obj.author
      ? String((obj.author as Record<string, unknown>).name ?? "")
      : typeof obj.authorName === "string"
        ? obj.authorName
        : undefined,
    authorEmail: obj.author
      ? String((obj.author as Record<string, unknown>).email ?? "")
      : typeof obj.authorEmail === "string"
        ? obj.authorEmail
        : undefined,
  };
}

function normalizeCommitHash(value: unknown): string | undefined {
  if (value == null) return undefined;
  if (typeof value === "string") return value || undefined;

  if (value instanceof Uint8Array) {
    return Array.from(value, (byte) => byte.toString(16).padStart(2, "0")).join("");
  }

  if (Array.isArray(value) && value.every((entry) => Number.isInteger(entry) && entry >= 0 && entry <= 255)) {
    return value.map((byte) => Number(byte).toString(16).padStart(2, "0")).join("");
  }

  return String(value) || undefined;
}

export type BranchEntry = { name: string; isDefault?: boolean };

export function normalizeBranchesText(raw: string, defaultBranch?: string): BranchEntry[] {
  const text = raw.trim();
  if (!text) return [];

  let names: string[] = [];

  if (text.startsWith("[")) {
    try {
      const parsed = JSON.parse(text) as unknown[];
      names = parsed.map((item) =>
        typeof item === "string" ? item : String((item as Record<string, unknown>).name ?? item),
      );
    } catch {
      console.warn("Failed to parse branches as JSON array, falling back to other formats");
    }
  }

  if (!names.length) {
    names = text.split("\n").filter(Boolean);
  }

  return names.map((name) => ({ name, isDefault: name === defaultBranch }));
}

export function normalizeRepoRecord(
  record: ShTangledRepo.Main,
  ownerDid: string,
  ownerHandle: string,
  atUri: string,
): RepoSummary {
  return {
    atUri,
    rkey: getAtUriRkey(atUri),
    ownerDid,
    ownerHandle,
    name: record.name,
    description: record.description,
    knot: record.knot,
    updatedAt: record.createdAt,
    topics: record.topics,
  } as RepoSummary & { topics?: string[] };
}

export function normalizeRepoRecordToDetail(
  record: ShTangledRepo.Main,
  ownerDid: string,
  ownerHandle: string,
  atUri: string,
  extras: Partial<Pick<RepoDetail, "readme" | "defaultBranch" | "languages">> = {},
): RepoDetail {
  return { ...normalizeRepoRecord(record, ownerDid, ownerHandle, atUri), topics: record.topics, ...extras };
}

export function normalizeIssueRecord(
  record: ShTangledRepoIssue.Main,
  atUri: string,
  authorDid: string,
  authorHandle: string,
  state: "open" | "closed" = "open",
): IssueSummary {
  return {
    atUri,
    rkey: getAtUriRkey(atUri),
    repoAtUri: record.repo,
    title: record.title,
    authorDid,
    authorHandle,
    state,
    createdAt: record.createdAt,
  };
}

export function normalizeIssueDetail(
  record: ShTangledRepoIssue.Main,
  atUri: string,
  authorDid: string,
  authorHandle: string,
  state: "open" | "closed" = "open",
  commentCount = 0,
): IssueDetail {
  return {
    ...normalizeIssueRecord(record, atUri, authorDid, authorHandle, state),
    body: record.body,
    mentions: record.mentions,
    references: record.references,
    commentCount,
  };
}

export function normalizePullRecord(
  record: ShTangledRepoPull.Main,
  atUri: string,
  authorDid: string,
  authorHandle: string,
  status: "open" | "merged" | "closed" = "open",
): PullRequestSummary {
  return {
    atUri,
    rkey: getAtUriRkey(atUri),
    title: record.title,
    authorDid,
    authorHandle,
    status,
    createdAt: record.createdAt,
    sourceBranch: record.source?.branch ?? "",
    sourceRepoAtUri: record.source?.repo,
    sourceSha: record.source?.sha,
    targetBranch: record.target.branch,
    targetRepoAtUri: record.target.repo,
  };
}

export function normalizePullDetail(
  record: ShTangledRepoPull.Main,
  atUri: string,
  authorDid: string,
  authorHandle: string,
  status: "open" | "merged" | "closed" = "open",
  roundCount = 0,
): PullRequestDetail {
  return {
    ...normalizePullRecord(record, atUri, authorDid, authorHandle, status),
    body: record.body,
    mentions: record.mentions,
    references: record.references,
    patch: record.patch,
    roundCount,
  };
}

export function normalizeIssueComment(
  record: ShTangledRepoIssueComment.Main,
  atUri: string,
  authorDid: string,
  authorHandle: string,
): IssueComment {
  return {
    atUri,
    rkey: getAtUriRkey(atUri),
    issueAtUri: record.issue,
    replyTo: record.replyTo,
    body: record.body,
    authorDid,
    authorHandle,
    createdAt: record.createdAt,
    mentions: record.mentions,
    references: record.references,
    depth: 0,
  };
}

export function normalizePullComment(
  record: ShTangledRepoPullComment.Main,
  atUri: string,
  authorDid: string,
  authorHandle: string,
): PullRequestComment {
  return {
    atUri,
    rkey: getAtUriRkey(atUri),
    pullAtUri: record.pull,
    body: record.body,
    authorDid,
    authorHandle,
    createdAt: record.createdAt,
    mentions: record.mentions,
    references: record.references,
    depth: 0,
  };
}

function compareByCreatedAt<T extends { createdAt: string; atUri: string }>(left: T, right: T): number {
  const leftTime = Date.parse(left.createdAt);
  const rightTime = Date.parse(right.createdAt);

  if (Number.isNaN(leftTime) || Number.isNaN(rightTime) || leftTime === rightTime) {
    return left.atUri.localeCompare(right.atUri);
  }

  return leftTime - rightTime;
}

export function normalizeStringRecord(record: ShTangledString.Main, atUri: string): StringSummary {
  return {
    atUri,
    rkey: getAtUriRkey(atUri),
    filename: record.filename,
    description: record.description,
    contents: record.contents,
    createdAt: record.createdAt,
  };
}

export function normalizeFollowRecord(record: ShTangledGraphFollow.Main, atUri: string): FollowSummary {
  return { atUri, subjectDid: record.subject, createdAt: record.createdAt };
}

export function buildIssueCommentThread(comments: IssueComment[]): IssueComment[] {
  const sorted = [...comments].sort(compareByCreatedAt);
  const knownUris = new Set(sorted.map((comment) => comment.atUri));
  const byParent = new Map<string | undefined, IssueComment[]>();

  for (const comment of sorted) {
    const parent = comment.replyTo && knownUris.has(comment.replyTo) ? comment.replyTo : undefined;
    const siblings = byParent.get(parent) ?? [];
    siblings.push(comment);
    byParent.set(parent, siblings);
  }

  const ordered: IssueComment[] = [];
  const seen = new Set<string>();

  const visit = (parent: string | undefined, depth: number) => {
    const children = byParent.get(parent) ?? [];
    for (const comment of children) {
      if (seen.has(comment.atUri)) continue;
      seen.add(comment.atUri);
      ordered.push({ ...comment, depth });
      visit(comment.atUri, depth + 1);
    }
  };

  visit(undefined, 0);

  for (const comment of sorted) {
    if (!seen.has(comment.atUri)) ordered.push(comment);
  }

  return ordered;
}

export function normalizeActorProfile(
  record: ShTangledActorProfile.Main,
  did: string,
  handle: string,
  displayName?: string,
  avatar?: string,
): UserSummary & { location?: string; pronouns?: string; links?: string[]; pinnedRepos?: string[] } {
  const links = record.links?.map((link) => link.trim()).filter(Boolean);

  return {
    did,
    handle,
    displayName,
    avatar,
    bio: record.description,
    location: record.location,
    pronouns: record.pronouns,
    links,
    pinnedRepos: record.pinnedRepositories,
  };
}
