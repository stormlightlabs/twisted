type ItemKind =
  | "repo_created"
  | "repo_starred"
  | "user_followed"
  | "pr_opened"
  | "pr_merged"
  | "issue_opened"
  | "issue_closed";

export type ActivityItem = {
  id: string;
  kind: ItemKind;
  actorDid: string;
  actorHandle: string;
  targetUri?: string;
  targetName?: string;
  createdAt: string;
};
