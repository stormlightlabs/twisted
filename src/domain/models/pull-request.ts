type PRStatus = "open" | "merged" | "closed";

export type PullRequestSummary = {
  atUri: string;
  title: string;
  authorDid: string;
  authorHandle: string;
  status: PRStatus;
  createdAt: string;
  updatedAt?: string;
  sourceBranch: string;
  targetBranch: string;
  roundCount?: number;
};
