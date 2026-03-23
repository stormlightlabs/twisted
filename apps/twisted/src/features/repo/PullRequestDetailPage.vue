<template>
  <ion-page>
    <ion-header :translucent="true">
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button :default-href="backHref" />
        </ion-buttons>
        <ion-title class="detail-title">PR #{{ pullId }}</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content :fullscreen="true">
      <template v-if="isLoading">
        <SkeletonLoader variant="profile" />
        <SkeletonLoader v-for="n in 2" :key="n" variant="card" />
      </template>

      <EmptyState
        v-else-if="isError"
        :icon="alertCircleOutline"
        title="Could not load pull request"
        :message="errorMessage" />

      <EmptyState
        v-else-if="!pullRequest"
        :icon="alertCircleOutline"
        title="Pull request not found"
        message="This pull request doesn't exist for the selected repository." />

      <template v-else>
        <div class="detail-shell">
          <section class="hero">
            <div class="hero-top">
              <ion-badge class="status-badge" :class="pullRequest.status">{{ pullRequest.status }}</ion-badge>
              <span class="mono pr-key">{{ owner }}/{{ repoName }}#{{ pullRequest.rkey }}</span>
            </div>
            <h1 class="hero-title">{{ pullRequest.title }}</h1>
            <div class="hero-meta">
              <span class="mono meta-accent">{{ pullRequest.authorHandle }}</span>
              <span class="sep">·</span>
              <span>{{ relativeTime(pullRequest.createdAt) }}</span>
              <template v-if="pullRequest.roundCount !== undefined">
                <span class="sep">·</span>
                <ion-icon :icon="chatbubbleOutline" class="meta-icon" />
                <span>{{ pullRequest.roundCount }}</span>
              </template>
            </div>
            <div class="branch-row">
              <span class="branch mono">{{ pullRequest.sourceBranch || "unknown" }}</span>
              <span class="branch-arrow">→</span>
              <span class="branch mono">{{ pullRequest.targetBranch }}</span>
            </div>
          </section>

          <section class="section">
            <div class="section-head">
              <h2>Body</h2>
            </div>
            <MarkdownRenderer v-if="pullRequest.body" :content="pullRequest.body" :repo-context="markdownContext" />
            <EmptyState
              v-else
              :icon="documentTextOutline"
              title="No description"
              message="This pull request was opened without any body text." />
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
              message="No discussion has been recorded for this pull request yet." />
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
import {
  useIdentity,
  useRepoRecord,
  useDefaultBranch,
  usePullRequestDetail,
  usePullRequestComments,
} from "@/services/tangled/queries.js";
import type { RepoAssetContext } from "@/services/tangled/repo-assets.js";

const route = useRoute();
const owner = computed(() => String(route.params.owner ?? ""));
const repoName = computed(() => String(route.params.repo ?? ""));
const pullId = computed(() => String(route.params.pullId ?? ""));

const identity = useIdentity(owner, { enabled: computed(() => !!owner.value) });
const did = computed(() => identity.data.value?.did ?? "");
const pds = computed(() => identity.data.value?.pds ?? "");
const hasIdentity = computed(() => !!identity.data.value);

const repoQuery = useRepoRecord(pds, did, repoName, owner, { enabled: hasIdentity });
const knotHost = computed(() => repoQuery.data.value?.knot ?? "");
const knotRepo = computed(() => (did.value && repoName.value ? `${did.value}/${repoName.value}` : ""));
const branchQuery = useDefaultBranch(knotHost, knotRepo, {
  enabled: computed(() => !!knotHost.value && !!knotRepo.value),
});
const repoAtUri = computed(() => repoQuery.data.value?.atUri ?? "");
const markdownContext = computed<RepoAssetContext | undefined>(() => {
  if (!knotHost.value || !knotRepo.value || !branchQuery.data.value?.name) return undefined;

  return {
    owner: owner.value,
    repo: repoName.value,
    branch: branchQuery.data.value.name,
    knotHost: knotHost.value,
    knotRepo: knotRepo.value,
  };
});

const pullQuery = usePullRequestDetail(pds, did, owner, pullId, { enabled: hasIdentity });
const pullAtUri = computed(() => pullQuery.data.value?.atUri ?? "");
const commentsQuery = usePullRequestComments(pds, did, owner, pullAtUri, {
  enabled: computed(() => !!pullAtUri.value),
});

const pullRequest = computed(() => {
  const value = pullQuery.data.value;
  if (!value) return undefined;
  if (repoAtUri.value && value.targetRepoAtUri !== repoAtUri.value) return undefined;
  return value;
});

const comments = computed(() => commentsQuery.data.value ?? []);
const isLoading = computed(
  () =>
    identity.isPending.value || repoQuery.isPending.value || pullQuery.isPending.value || commentsQuery.isPending.value,
);
const isError = computed(
  () => identity.isError.value || repoQuery.isError.value || pullQuery.isError.value || commentsQuery.isError.value,
);
const errorMessage = computed(() => {
  const error = identity.error.value ?? repoQuery.error.value ?? pullQuery.error.value ?? commentsQuery.error.value;
  return error instanceof Error ? error.message : "An unexpected error occurred.";
});

const tabPrefix = computed(() => {
  if (route.path.startsWith("/tabs/explore")) return "/tabs/explore";
  if (route.path.startsWith("/tabs/activity")) return "/tabs/activity";
  return "/tabs/home";
});

const backHref = computed(() => `${tabPrefix.value}/repo/${owner.value}/${repoName.value}?tab=prs`);

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

.pr-key,
.mono {
  font-family: var(--t-mono);
}

.pr-key {
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
  margin-bottom: 10px;
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

.branch-row {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border-radius: 999px;
  background: var(--t-surface-raised);
  border: 1px solid var(--t-border);
}

.branch {
  font-size: 11px;
  color: var(--t-text-secondary);
}

.branch-arrow {
  color: var(--t-border-strong);
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

.status-badge {
  font-size: 11px;
  font-weight: 600;
  border-radius: 999px;
  padding: 3px 8px;
  text-transform: capitalize;
}

.status-badge.open {
  --background: var(--t-accent-dim);
  --color: var(--t-accent);
}

.status-badge.merged {
  --background: rgba(167, 139, 250, 0.1);
  --color: var(--t-purple);
}

.status-badge.closed {
  --background: transparent;
  --color: var(--t-text-muted);
  border: 1px solid var(--t-border-strong);
}
</style>
