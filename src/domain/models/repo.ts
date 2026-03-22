import type { UserSummary } from "./user";

export type RepoSummary = {
  atUri: string;
  ownerDid: string;
  ownerHandle: string;
  name: string;
  description?: string;
  primaryLanguage?: string;
  stars?: number;
  forks?: number;
  updatedAt?: string;
  knot: string;
};

export type RepoDetail = RepoSummary & {
  readme?: string;
  defaultBranch?: string;
  languages?: Record<string, number>;
  collaborators?: UserSummary[];
  topics?: string[];
};

type FileKind = "file" | "dir" | "submodule";

export type RepoFile = { path: string; name: string; type: FileKind; size?: number; lastCommitMessage?: string };
