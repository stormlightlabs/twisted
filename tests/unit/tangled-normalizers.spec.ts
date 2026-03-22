import { describe, expect, it } from "vitest";
import { buildIssueCommentThread } from "@/services/tangled/normalizers.js";
import { getAtUriRkey, parseAtUri } from "@/services/tangled/uris.js";
import type { IssueComment } from "@/domain/models/comment.js";

function makeComment(overrides: Partial<IssueComment> = {}): IssueComment {
  return {
    atUri: "at://did:plc:test/sh.tangled.repo.issue.comment/root",
    rkey: "root",
    issueAtUri: "at://did:plc:test/sh.tangled.repo.issue/123",
    body: "root",
    authorDid: "did:plc:test",
    authorHandle: "alice.test",
    createdAt: "2026-03-22T10:00:00Z",
    depth: 0,
    ...overrides,
  };
}

describe("AT URI helpers", () => {
  it("extracts URI parts and rkey", () => {
    const uri = "at://did:plc:abc123/sh.tangled.repo.issue/42";

    expect(parseAtUri(uri)).toEqual({ did: "did:plc:abc123", collection: "sh.tangled.repo.issue", rkey: "42" });
    expect(getAtUriRkey(uri)).toBe("42");
  });
});

describe("buildIssueCommentThread", () => {
  it("orders comments by parent-child relationship and assigns depth", () => {
    const root = makeComment();
    const reply = makeComment({
      atUri: "at://did:plc:test/sh.tangled.repo.issue.comment/reply",
      rkey: "reply",
      body: "reply",
      createdAt: "2026-03-22T10:01:00Z",
      replyTo: root.atUri,
    });
    const secondRoot = makeComment({
      atUri: "at://did:plc:test/sh.tangled.repo.issue.comment/second",
      rkey: "second",
      body: "second root",
      createdAt: "2026-03-22T10:02:00Z",
    });

    const ordered = buildIssueCommentThread([secondRoot, reply, root]);

    expect(ordered.map((comment) => [comment.rkey, comment.depth])).toEqual([
      ["root", 0],
      ["reply", 1],
      ["second", 0],
    ]);
  });

  it("treats orphaned replies as top-level comments", () => {
    const orphan = makeComment({
      atUri: "at://did:plc:test/sh.tangled.repo.issue.comment/orphan",
      rkey: "orphan",
      replyTo: "at://did:plc:test/sh.tangled.repo.issue.comment/missing",
    });

    const ordered = buildIssueCommentThread([orphan]);

    expect(ordered).toHaveLength(1);
    expect(ordered[0]?.depth).toBe(0);
  });
});
