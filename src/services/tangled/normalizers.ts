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
} from "@atcute/tangled";
import type { RepoFile, RepoSummary, RepoDetail } from "@/domain/models/repo.js";
import type { UserSummary } from "@/domain/models/user.js";
import type { IssueSummary, IssueDetail } from "@/domain/models/issue.js";
import type { PullRequestSummary, PullRequestDetail } from "@/domain/models/pull-request.js";
import type { IssueComment, PullRequestComment } from "@/domain/models/comment.js";
import { getAtUriRkey } from "./uris.js";

function modeToFileKind(mode: string): RepoFile["type"] {
  if (mode.startsWith("04")) return "dir";
  if (mode === "160000") return "submodule";
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
      return text
        .split("\n")
        .filter(Boolean)
        .map((line) => normalizeCommitObject(JSON.parse(line) as Record<string, unknown>));
    } catch {
      console.warn("Failed to parse log as newline-delimited JSON, falling back to other formats");
    }
  }

  return text
    .split("\n")
    .filter(Boolean)
    .map((line) => ({ hash: "", message: line, when: "" }));
}

function normalizeCommitObject(obj: Record<string, unknown>): CommitEntry {
  return {
    hash: String(obj.hash ?? obj.sha ?? obj.id ?? ""),
    shortHash: obj.shortHash != null ? String(obj.shortHash) : undefined,
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
): UserSummary & { location?: string; pronouns?: string; links?: string[]; pinnedRepos?: string[] } {
  return {
    did,
    handle,
    displayName,
    avatar: `https://avatar.tangled.sh/${did}`,
    bio: record.description,
    location: record.location,
    pronouns: record.pronouns,
    links: record.links,
    pinnedRepos: record.pinnedRepositories,
  };
}
