import { describe, expect, it } from "vitest";
import { buildKnotUrl } from "@/services/tangled/endpoints.js";
import { buildIssueCommentThread, normalizeLogText, normalizeRepoRecord, normalizeTree } from "@/services/tangled/normalizers.js";
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

  it("preserves the repo record rkey separately from the display name", () => {
    const repo = normalizeRepoRecord(
      {
        $type: "sh.tangled.repo",
        name: "Writer",
        knot: "us-west.host.bsky.network",
        createdAt: "2026-03-22T10:00:00Z",
      },
      "did:plc:abc123",
      "alice.test",
      "at://did:plc:abc123/sh.tangled.repo/writer-app",
    );

    expect(repo.name).toBe("Writer");
    expect(repo.rkey).toBe("writer-app");
  });

  it("preserves the repo slash in knot XRPC query strings", () => {
    const url = buildKnotUrl("knot1.tangled.sh", "sh.tangled.repo.getDefaultBranch", {
      repo: "did:plc:xg2vq45muivyy3xwatcehspu/writer",
    });

    expect(url).toContain("repo=did%3Aplc%3Axg2vq45muivyy3xwatcehspu/writer");
    expect(url).not.toContain("%2Fwriter");
  });

  it("derives file kinds from zero-padded git modes", () => {
    const files = normalizeTree({
      files: [
        { mode: "0040000", name: ".github", size: 75, last_commit: { hash: "a", message: "dir", when: "2026-03-23T00:00:00Z" } },
        { mode: "0100644", name: "README.md", size: 3126, last_commit: { hash: "b", message: "file", when: "2026-03-23T00:00:00Z" } },
        { mode: "0160000", name: "vendor/lib", size: 0, last_commit: { hash: "c", message: "submodule", when: "2026-03-23T00:00:00Z" } },
      ],
      lastCommit: { hash: "a", message: "dir", when: "2026-03-23T00:00:00Z", author: { name: "Test", email: "test@example.com", when: "" } },
      ref: "main",
    });

    expect(files.map((file) => [file.name, file.type])).toEqual([
      [".github", "dir"],
      ["README.md", "file"],
      ["vendor/lib", "submodule"],
    ]);
  });

  it("parses wrapped commit arrays from repo log payloads", () => {
    const commits = normalizeLogText(
      JSON.stringify({
        commits: [
          {
            hash: "60074765a75ecb6a763dcf82252ef4365187af21",
            shortHash: "6007476",
            message: "feat: persist sidebar state between reloads",
            when: "2026-03-21T14:59:03Z",
            author: { name: "Owais Jamil", email: "desertthunder.dev@gmail.com" },
          },
        ],
      }),
    );

    expect(commits).toEqual([
      {
        hash: "60074765a75ecb6a763dcf82252ef4365187af21",
        shortHash: "6007476",
        message: "feat: persist sidebar state between reloads",
        when: "2026-03-21T14:59:03Z",
        authorName: "Owais Jamil",
        authorEmail: "desertthunder.dev@gmail.com",
      },
    ]);
  });

  it("hex-encodes byte-array commit hashes", () => {
    const commits = normalizeLogText(
      JSON.stringify({
        commits: [
          {
            hash: [219, 149, 244, 86, 116, 134, 146, 69, 98, 104, 59, 177, 138, 231, 236, 43, 189, 85, 234, 95],
            message: "docs: update site",
            when: "2026-03-21T15:08:58Z",
          },
        ],
      }),
    );

    expect(commits[0]).toMatchObject({
      hash: "db95f4567486924562683bb18ae7ec2bbd55ea5f",
      shortHash: "db95f45",
      message: "docs: update site",
      when: "2026-03-21T15:08:58Z",
    });
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
