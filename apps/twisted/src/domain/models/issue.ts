type IssueState = "open" | "closed";

export type IssueSummary = {
  atUri: string;
  rkey: string;
  repoAtUri: string;
  title: string;
  authorDid: string;
  authorHandle: string;
  state: IssueState;
  createdAt: string;
  commentCount?: number;
};

export type IssueDetail = IssueSummary & { body?: string; mentions?: string[]; references?: string[] };
