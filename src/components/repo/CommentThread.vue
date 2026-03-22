<template>
  <div class="comment-thread">
    <article v-for="comment in comments" :key="comment.atUri" class="comment-card" :style="commentStyle(comment.depth)">
      <div class="comment-head">
        <span class="author mono">{{ comment.authorHandle }}</span>
        <span class="dot">·</span>
        <span class="time">{{ relativeTime(comment.createdAt) }}</span>
        <span v-if="comment.depth > 0" class="reply-pill">Reply</span>
      </div>

      <pre class="comment-body">{{ comment.body }}</pre>
    </article>
  </div>
</template>

<script setup lang="ts">
import type { IssueComment, PullRequestComment } from "@/domain/models/comment.js";

defineProps<{ comments: Array<IssueComment | PullRequestComment> }>();

function relativeTime(iso: string): string {
  const timestamp = Date.parse(iso);
  if (Number.isNaN(timestamp)) return iso;

  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60_000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return "just now";
}

function commentStyle(depth: number) {
  return { marginLeft: `${Math.min(depth, 4) * 16}px` };
}
</script>

<style scoped>
.comment-thread {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.comment-card {
  background: var(--t-surface-raised);
  border: 1px solid var(--t-border);
  border-radius: var(--t-radius-md);
  padding: 12px 14px;
}

.comment-head {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  margin-bottom: 8px;
  font-size: 12px;
  color: var(--t-text-muted);
}

.author {
  color: var(--t-accent);
  font-size: 11px;
}

.mono {
  font-family: var(--t-mono);
}

.dot {
  color: var(--t-border-strong);
}

.reply-pill {
  padding: 1px 6px;
  border-radius: 999px;
  background: var(--t-accent-dim);
  color: var(--t-accent);
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.comment-body {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: inherit;
  font-size: 13px;
  line-height: 1.55;
  color: var(--t-text-secondary);
}
</style>
