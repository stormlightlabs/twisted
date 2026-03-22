type PRStatus = "open" | "merged" | "closed";

export type PullRequestSummary = {
  atUri: string;
  rkey: string;
  title: string;
  authorDid: string;
  authorHandle: string;
  status: PRStatus;
  createdAt: string;
  updatedAt?: string;
  sourceBranch: string;
  sourceRepoAtUri?: string;
  sourceSha?: string;
  targetBranch: string;
  targetRepoAtUri: string;
  roundCount?: number;
};

export type PullRequestDetail = PullRequestSummary & {
  body?: string;
  mentions?: string[];
  references?: string[];
  patch?: string;
};
