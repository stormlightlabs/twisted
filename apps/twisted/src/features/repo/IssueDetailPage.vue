<template>
  <ion-page>
    <ion-header :translucent="true">
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button :default-href="backHref" />
        </ion-buttons>
        <ion-title class="detail-title">Issue #{{ issueId }}</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content :fullscreen="true">
      <template v-if="isLoading">
        <SkeletonLoader variant="profile" />
        <SkeletonLoader v-for="n in 2" :key="n" variant="card" />
      </template>

      <EmptyState v-else-if="isError" :icon="alertCircleOutline" title="Could not load issue" :message="errorMessage" />

      <EmptyState
        v-else-if="!issue"
        :icon="alertCircleOutline"
        title="Issue not found"
        message="This issue doesn't exist for the selected repository." />

      <template v-else>
        <div class="detail-shell">
          <section class="hero">
            <div class="hero-top">
              <ion-badge class="state-badge" :class="issue.state">{{ issue.state }}</ion-badge>
              <span class="mono issue-key">{{ owner }}/{{ repoName }}#{{ issue.rkey }}</span>
            </div>
            <h1 class="hero-title">{{ issue.title }}</h1>
            <div class="hero-meta">
              <span class="mono meta-accent">{{ issue.authorHandle }}</span>
              <span class="sep">·</span>
              <span>{{ relativeTime(issue.createdAt) }}</span>
              <template v-if="issue.commentCount !== undefined">
                <span class="sep">·</span>
                <ion-icon :icon="chatbubbleOutline" class="meta-icon" />
                <span>{{ issue.commentCount }}</span>
              </template>
            </div>
          </section>

          <section class="section">
            <div class="section-head">
              <h2>Body</h2>
            </div>
            <MarkdownRenderer v-if="issue.body" :content="issue.body" :repo-context="markdownContext" />
            <EmptyState
              v-else
              :icon="documentTextOutline"
              title="No description"
              message="This issue was opened without any body text." />
          </section>

          <section class="section">
            <div class="section-head">
              <h2>Comments</h2>
              <span class="section-count">{{ comments.length }}</span>
            </div>
            <CommentThread v-if="comments.length" :comments="comments" />
            <EmptyState
              v-else
              :icon="chatbubbleOutline"
              title="No comments"
              message="No discussion has been recorded for this issue yet." />
          </section>
        </div>
      </template>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButtons,
  IonBackButton,
  IonBadge,
  IonIcon,
} from "@ionic/vue";
import { alertCircleOutline, chatbubbleOutline, documentTextOutline } from "ionicons/icons";
import SkeletonLoader from "@/components/common/SkeletonLoader.vue";
import EmptyState from "@/components/common/EmptyState.vue";
import MarkdownRenderer from "@/components/repo/MarkdownRenderer.vue";
import CommentThread from "@/components/repo/CommentThread.vue";
import { useRepoRecord, useIssueDetail, useIssueComments, useDefaultBranch } from "@/services/tangled/queries.js";
import type { RepoAssetContext } from "@/services/tangled/repo-assets.js";

const route = useRoute();
const owner = computed(() => String(route.params.owner ?? ""));
const repoName = computed(() => String(route.params.repo ?? ""));
const issueId = computed(() => String(route.params.issueId ?? ""));

const repoQuery = useRepoRecord(owner, repoName, { enabled: computed(() => !!owner.value && !!repoName.value) });
const branchQuery = useDefaultBranch(owner, repoName, {
  enabled: computed(() => !!owner.value && !!repoName.value),
});
const repoAtUri = computed(() => repoQuery.data.value?.atUri ?? "");
const markdownContext = computed<RepoAssetContext | undefined>(() => {
  if (!owner.value || !repoName.value || !branchQuery.data.value?.name) return undefined;

  return {
    owner: owner.value,
    repo: repoName.value,
    branch: branchQuery.data.value.name,
  };
});

const issueQuery = useIssueDetail(owner, issueId, { enabled: computed(() => !!owner.value && !!issueId.value) });
const commentsQuery = useIssueComments(owner, issueId, { enabled: computed(() => !!owner.value && !!issueId.value) });

const issue = computed(() => {
  const value = issueQuery.data.value;
  if (!value) return undefined;
  if (repoAtUri.value && value.repoAtUri !== repoAtUri.value) return undefined;
  return value;
});

const comments = computed(() => commentsQuery.data.value ?? []);
const isLoading = computed(
  () => repoQuery.isPending.value || issueQuery.isPending.value || commentsQuery.isPending.value,
);
const isError = computed(
  () => repoQuery.isError.value || issueQuery.isError.value || commentsQuery.isError.value,
);
const errorMessage = computed(() => {
  const error = repoQuery.error.value ?? issueQuery.error.value ?? commentsQuery.error.value;
  return error instanceof Error ? error.message : "An unexpected error occurred.";
});

const tabPrefix = computed(() => {
  if (route.path.startsWith("/tabs/explore")) return "/tabs/explore";
  if (route.path.startsWith("/tabs/activity")) return "/tabs/activity";
  return "/tabs/home";
});

const backHref = computed(() => `${tabPrefix.value}/repo/${owner.value}/${repoName.value}?tab=issues`);

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
</script>

<style scoped>
.detail-title {
  font-family: var(--t-mono);
  font-size: 14px;
}

.detail-shell {
  padding: 18px 16px 32px;
}

.hero {
  margin-bottom: 24px;
}

.hero-top {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 10px;
}

.issue-key,
.mono {
  font-family: var(--t-mono);
}

.issue-key {
  font-size: 11px;
  color: var(--t-text-muted);
}

.hero-title {
  margin: 0 0 8px;
  font-size: 22px;
  line-height: 1.2;
  color: var(--t-text-primary);
}

.hero-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  font-size: 13px;
  color: var(--t-text-muted);
}

.meta-accent {
  color: var(--t-accent);
  font-size: 12px;
}

.sep {
  color: var(--t-border-strong);
}

.meta-icon {
  font-size: 12px;
}

.section {
  margin-top: 20px;
}

.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.section-head h2 {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: var(--t-text-muted);
  margin: 0;
}

.section-count {
  font-size: 12px;
  color: var(--t-text-muted);
}

.state-badge {
  font-size: 11px;
  font-weight: 600;
  border-radius: 999px;
  padding: 3px 8px;
  text-transform: capitalize;
}

.state-badge.open {
  --background: var(--t-green-dim);
  --color: var(--t-green);
}

.state-badge.closed {
  --background: transparent;
  --color: var(--t-text-muted);
  border: 1px solid var(--t-border-strong);
}
</style>
