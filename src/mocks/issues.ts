import type { IssueSummary } from "@/domain/models/issue.js";

const MOCK_ISSUES: IssueSummary[] = [
  {
    atUri: "at://did:plc:a1b2c3d4e5f6g7h8i9j0k1l2/sh.tangled.issue/8",
    title: "Support streaming responses from XRPC subscriptions",
    authorDid: "did:plc:p2cp5gopk7mgjegy9waligxd",
    authorHandle: "desertthunder.dev",
    state: "open",
    createdAt: "2026-03-21T12:00:00Z",
    commentCount: 4,
  },
  {
    atUri: "at://did:plc:a1b2c3d4e5f6g7h8i9j0k1l2/sh.tangled.issue/7",
    title: "Keyboard navigation broken in record browser",
    authorDid: "did:plc:c3d4e5f6g7h8i9j0k1l2m3n4",
    authorHandle: "clara.bsky.social",
    state: "open",
    createdAt: "2026-03-19T17:30:00Z",
    commentCount: 2,
  },
  {
    atUri: "at://did:plc:a1b2c3d4e5f6g7h8i9j0k1l2/sh.tangled.issue/6",
    title: "Add pagination to lexicon list endpoint",
    authorDid: "did:plc:b2c3d4e5f6g7h8i9j0k1l2m3",
    authorHandle: "bob.tngl.sh",
    state: "open",
    createdAt: "2026-03-17T09:15:00Z",
    commentCount: 7,
  },
  {
    atUri: "at://did:plc:a1b2c3d4e5f6g7h8i9j0k1l2/sh.tangled.issue/5",
    title: "DID resolution fails when PLC directory is unreachable",
    authorDid: "did:plc:e5f6g7h8i9j0k1l2m3n4o5p6",
    authorHandle: "riku.tngl.sh",
    state: "closed",
    createdAt: "2026-03-10T11:00:00Z",
    commentCount: 5,
  },
  {
    atUri: "at://did:plc:a1b2c3d4e5f6g7h8i9j0k1l2/sh.tangled.issue/4",
    title: "Export TypeScript types for all lexicon schemas",
    authorDid: "did:plc:a1b2c3d4e5f6g7h8i9j0k1l2",
    authorHandle: "alice.tngl.sh",
    state: "closed",
    createdAt: "2026-03-06T14:20:00Z",
    commentCount: 3,
  },
  {
    atUri: "at://did:plc:p2cp5gopk7mgjegy9waligxd/sh.tangled.issue/12",
    title: "Offline mode: cache last-viewed repos to IndexedDB",
    authorDid: "did:plc:p2cp5gopk7mgjegy9waligxd",
    authorHandle: "desertthunder.dev",
    state: "open",
    createdAt: "2026-03-22T08:40:00Z",
    commentCount: 0,
  },
  {
    atUri: "at://did:plc:p2cp5gopk7mgjegy9waligxd/sh.tangled.issue/11",
    title: "Skeleton loaders flicker on fast connections",
    authorDid: "did:plc:c3d4e5f6g7h8i9j0k1l2m3n4",
    authorHandle: "clara.bsky.social",
    state: "open",
    createdAt: "2026-03-18T16:05:00Z",
    commentCount: 1,
  },
];

export function getMockIssues(): IssueSummary[] {
  return MOCK_ISSUES;
}

export function getMockOpenIssues(): IssueSummary[] {
  return MOCK_ISSUES.filter((i) => i.state === "open");
}
