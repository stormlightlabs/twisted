type IssueState = "open" | "closed";

export type IssueSummary = {
  atUri: string;
  title: string;
  authorDid: string;
  authorHandle: string;
  state: IssueState;
  createdAt: string;
  commentCount?: number;
};
