import type { PullRequestSummary } from "@/domain/models/pull-request.js";

const MOCK_PRS: PullRequestSummary[] = [
  {
    atUri: "at://did:plc:a1b2c3d4e5f6g7h8i9j0k1l2/sh.tangled.pr/3",
    title: "feat: add dark mode support to token system",
    authorDid: "did:plc:c3d4e5f6g7h8i9j0k1l2m3n4",
    authorHandle: "clara.bsky.social",
    status: "open",
    createdAt: "2026-03-20T10:12:00Z",
    updatedAt: "2026-03-21T15:44:00Z",
    sourceBranch: "feat/dark-mode-tokens",
    targetBranch: "main",
    roundCount: 2,
  },
  {
    atUri: "at://did:plc:a1b2c3d4e5f6g7h8i9j0k1l2/sh.tangled.pr/2",
    title: "fix: resolve CORS issue with lexicon fetch",
    authorDid: "did:plc:b2c3d4e5f6g7h8i9j0k1l2m3",
    authorHandle: "bob.tngl.sh",
    status: "merged",
    createdAt: "2026-03-15T08:30:00Z",
    updatedAt: "2026-03-16T11:00:00Z",
    sourceBranch: "fix/cors-lexicon",
    targetBranch: "main",
    roundCount: 1,
  },
  {
    atUri: "at://did:plc:a1b2c3d4e5f6g7h8i9j0k1l2/sh.tangled.pr/1",
    title: "chore: upgrade @atcute/client to v4",
    authorDid: "did:plc:a1b2c3d4e5f6g7h8i9j0k1l2",
    authorHandle: "alice.tngl.sh",
    status: "merged",
    createdAt: "2026-03-08T14:00:00Z",
    updatedAt: "2026-03-09T09:20:00Z",
    sourceBranch: "chore/atcute-v4",
    targetBranch: "main",
    roundCount: 1,
  },
  {
    atUri: "at://did:plc:p2cp5gopk7mgjegy9waligxd/sh.tangled.pr/5",
    title: "feat: tab routing with per-tab navigation stacks",
    authorDid: "did:plc:p2cp5gopk7mgjegy9waligxd",
    authorHandle: "desertthunder.dev",
    status: "open",
    createdAt: "2026-03-21T18:05:00Z",
    sourceBranch: "feat/tab-routing",
    targetBranch: "main",
    roundCount: 0,
  },
  {
    atUri: "at://did:plc:b2c3d4e5f6g7h8i9j0k1l2m3/sh.tangled.pr/7",
    title: "refactor: replace manual flag parsing with cobra",
    authorDid: "did:plc:e5f6g7h8i9j0k1l2m3n4o5p6",
    authorHandle: "riku.tngl.sh",
    status: "closed",
    createdAt: "2026-03-12T09:45:00Z",
    updatedAt: "2026-03-13T12:30:00Z",
    sourceBranch: "refactor/cobra-cli",
    targetBranch: "main",
    roundCount: 3,
  },
];

export function getMockPullRequests(repoAtUri?: string): PullRequestSummary[] {
  if (repoAtUri) {
    return MOCK_PRS.filter((pr) => pr.atUri.startsWith(repoAtUri.replace("/sh.tangled.repo/", "/sh.tangled.pr/")));
  }
  return MOCK_PRS;
}

export function getMockOpenPRs(): PullRequestSummary[] {
  return MOCK_PRS.filter((pr) => pr.status === "open");
}
