export type DiscussionComment = {
  atUri: string;
  rkey: string;
  body: string;
  authorDid: string;
  authorHandle: string;
  createdAt: string;
  mentions?: string[];
  references?: string[];
  depth: number;
};

export type IssueComment = DiscussionComment & { issueAtUri: string; replyTo?: string };

export type PullRequestComment = DiscussionComment & { pullAtUri: string };
