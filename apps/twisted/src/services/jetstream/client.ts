/**
 * JetstreamClient — subscribes to the AT Protocol Jetstream WebSocket firehose
 * and filters for sh.tangled.* collection events, emitting ActivityItems.
 *
 * Connects on demand, auto-reconnects after disconnection, and tracks the last
 * event cursor so gap-free resume is possible on reconnect.
 *
 * Data source decision: Jetstream is chosen over PDS polling because it provides
 * a public, real-time stream of all network events without requiring authentication
 * or prior knowledge of specific user DIDs. PDS polling would require a known list
 * of accounts to follow, and the Twister API does not yet expose an activity feed.
 */
import type { ActivityItem } from "@/domain/models/activity.js";

const JETSTREAM_URL = "wss://jetstream2.us-east.bsky.network/subscribe";
const MAX_ITEMS = 200;
const RECONNECT_DELAY_MS = 3_000;

const WANTED_COLLECTIONS = [
  "sh.tangled.repo",
  "sh.tangled.feed.star",
  "sh.tangled.graph.follow",
  "sh.tangled.repo.issue",
  "sh.tangled.repo.issue.state",
  "sh.tangled.repo.pull",
];

type JetstreamRecord = Record<string, unknown>;

type JetstreamCommit = {
  rev: string;
  operation: "create" | "update" | "delete";
  collection: string;
  rkey: string;
  record?: JetstreamRecord;
  cid?: string;
};

type JetstreamEventKind = "commit" | "identity" | "account";

type JetstreamEvent = { did: string; time_us: number; kind: JetstreamEventKind; commit?: JetstreamCommit };

export type JetstreamCallbacks = {
  onEvent: (item: ActivityItem) => void;
  onConnected?: () => void;
  onDisconnected?: () => void;
  onError?: () => void;
};

function extractAtUri(record: JetstreamRecord, field: string): string {
  const subject = record[field] as { uri?: string } | string | undefined;
  if (typeof subject === "string") return subject;
  return subject?.uri ?? "";
}

/** Extract the last path segment of an AT URI (the rkey / repo name). */
function atUriRkey(atUri: string): string | undefined {
  const seg = atUri.split("/").pop();
  return seg || undefined;
}

/** Extract the DID embedded in an AT URI (at://did:plc:.../collection/rkey). */
function atUriDid(atUri: string): string | undefined {
  const match = /^at:\/\/(did:[^/]+)/.exec(atUri);
  return match?.[1];
}

function toActivityKind(commit: JetstreamCommit): ActivityItem["kind"] | null {
  if (commit.operation === "delete") return null;

  switch (commit.collection) {
    case "sh.tangled.repo":
      return commit.operation === "create" ? "repo_created" : null;
    case "sh.tangled.feed.star":
      return commit.operation === "create" ? "repo_starred" : null;
    case "sh.tangled.graph.follow":
      return commit.operation === "create" ? "user_followed" : null;
    case "sh.tangled.repo.issue":
      return commit.operation === "create" ? "issue_opened" : null;
    case "sh.tangled.repo.issue.state": {
      if (commit.operation !== "create" || !commit.record) return null;
      const status = commit.record["status"] as string | undefined;
      return status === "closed" ? "issue_closed" : null;
    }
    case "sh.tangled.repo.pull":
      return commit.operation === "create" ? "pr_opened" : null;
    default:
      return null;
  }
}

function extractTargetInfo(commit: JetstreamCommit): { targetName?: string; targetOwnerDid?: string } {
  const record = commit.record;
  if (!record) return {};

  switch (commit.collection) {
    case "sh.tangled.repo": {
      return { targetName: record["name"] as string | undefined };
    }
    case "sh.tangled.feed.star": {
      const uri = extractAtUri(record, "subject");
      return { targetName: atUriRkey(uri), targetOwnerDid: atUriDid(uri) };
    }
    case "sh.tangled.graph.follow": {
      const subject = record["subject"] as string | undefined;
      return { targetOwnerDid: subject };
    }
    case "sh.tangled.repo.issue":
    case "sh.tangled.repo.issue.state":
    case "sh.tangled.repo.pull": {
      const uri = extractAtUri(record, "subject");
      return { targetName: atUriRkey(uri), targetOwnerDid: atUriDid(uri) };
    }
    default:
      return {};
  }
}

/** Returns a short, human-readable identifier from a DID while the handle is being resolved. */
function placeholderHandle(did: string): string {
  const parts = did.split(":");
  const id = parts[2] ?? did;
  return id.length > 10 ? `${id.slice(0, 10)}…` : id;
}

export class JetstreamClient {
  private ws: WebSocket | null = null;
  private callbacks: JetstreamCallbacks;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private cursor: number | null = null;
  private stopped = false;
  readonly maxItems: number;

  constructor(callbacks: JetstreamCallbacks, maxItems = MAX_ITEMS) {
    this.callbacks = callbacks;
    this.maxItems = maxItems;
  }

  connect(): void {
    this.stopped = false;
    this._open();
  }

  disconnect(): void {
    this.stopped = true;
    this._clearTimer();
    this._close();
    this.callbacks.onDisconnected?.();
  }

  resetCursor(): void {
    this.cursor = null;
  }

  private _buildUrl(): string {
    const params = new URLSearchParams();
    for (const col of WANTED_COLLECTIONS) {
      params.append("wantedCollections", col);
    }
    if (this.cursor !== null) {
      params.set("cursor", String(this.cursor));
    }
    return `${JETSTREAM_URL}?${params.toString()}`;
  }

  private _open(): void {
    this._close();

    let ws: WebSocket;
    try {
      ws = new WebSocket(this._buildUrl());
    } catch {
      if (!this.stopped) this._scheduleReconnect();
      return;
    }

    this.ws = ws;

    ws.onopen = () => {
      this.callbacks.onConnected?.();
    };

    ws.onmessage = (ev: MessageEvent) => {
      try {
        const event = JSON.parse(ev.data as string) as JetstreamEvent;
        this.cursor = event.time_us;

        if (event.kind !== "commit" || !event.commit) return;

        const kind = toActivityKind(event.commit);
        if (!kind) return;

        const { targetName, targetOwnerDid } = extractTargetInfo(event.commit);

        const item: ActivityItem = {
          id: `${event.did}-${event.commit.collection}-${event.commit.rkey}`,
          kind,
          actorDid: event.did,
          actorHandle: placeholderHandle(event.did),
          targetUri:
            targetOwnerDid && targetName
              ? `at://${targetOwnerDid}/${event.commit.collection}/${targetName}`
              : undefined,
          targetName,
          targetOwnerDid,
          createdAt: new Date(Math.floor(event.time_us / 1_000)).toISOString(),
        };

        this.callbacks.onEvent(item);
      } catch (error) {
        console.warn("Failed to parse Jetstream event", { raw: ev.data, error });
      }
    };

    ws.onerror = () => {
      this.callbacks.onError?.();
    };

    ws.onclose = () => {
      this.ws = null;
      if (!this.stopped) {
        this._scheduleReconnect();
      }
    };
  }

  private _close(): void {
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws.onmessage = null;
      this.ws.onopen = null;
      this.ws.close();
      this.ws = null;
    }
  }

  private _clearTimer(): void {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private _scheduleReconnect(): void {
    this._clearTimer();
    this.callbacks.onDisconnected?.();
    this.reconnectTimer = setTimeout(() => {
      if (!this.stopped) this._open();
    }, RECONNECT_DELAY_MS);
  }
}
