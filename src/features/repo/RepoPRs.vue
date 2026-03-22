<template>
  <div class="prs-view">
    <!-- Filter -->
    <div class="filters-row">
      <ion-chip
        v-for="f in FILTERS"
        :key="f.value"
        class="filter-chip"
        :class="{ active: filter === f.value }"
        @click="filter = f.value">
        {{ f.label }}
      </ion-chip>
    </div>

    <ion-list lines="inset" class="pr-list">
      <ion-item v-for="pr in filtered" :key="pr.atUri" class="pr-item" button lines="inset">
        <div slot="start" class="status-icon" :class="pr.status">
          <ion-icon :icon="gitMergeOutline" />
        </div>
        <ion-label class="pr-label">
          <span class="pr-title">{{ pr.title }}</span>
          <div class="pr-meta">
            <span class="mono">{{ pr.authorHandle }}</span>
            <span class="sep">·</span>
            <span class="branch mono">{{ pr.sourceBranch }}</span>
            <span class="sep">→</span>
            <span class="branch mono">{{ pr.targetBranch }}</span>
            <span class="sep">·</span>
            <span>{{ relativeTime(pr.createdAt) }}</span>
          </div>
        </ion-label>
        <ion-badge slot="end" class="status-badge" :class="pr.status">
          {{ pr.status }}
        </ion-badge>
      </ion-item>
    </ion-list>

    <EmptyState
      v-if="!filtered.length"
      :icon="gitMergeOutline"
      title="No pull requests"
      :message="filter === 'all' ? 'No PRs yet.' : `No ${filter} PRs.`" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { IonList, IonItem, IonLabel, IonBadge, IonIcon, IonChip } from "@ionic/vue";
import { gitMergeOutline } from "ionicons/icons";
import EmptyState from "@/components/common/EmptyState.vue";
import type { PullRequestSummary } from "@/domain/models/pull-request";

const props = defineProps<{ prs: PullRequestSummary[] }>();

const filter = ref<"all" | "open" | "merged" | "closed">("open");

const FILTERS = [
  { value: "open", label: "Open" },
  { value: "merged", label: "Merged" },
  { value: "closed", label: "Closed" },
  { value: "all", label: "All" },
] as const;

const filtered = computed(() => {
  if (filter.value === "all") return props.prs;
  return props.prs.filter((pr) => pr.status === filter.value);
});

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}d ago`;
  if (h > 0) return `${h}h ago`;
  if (m > 0) return `${m}m ago`;
  return "just now";
}
</script>

<style scoped>
.prs-view {
  padding-bottom: 32px;
}

.filters-row {
  display: flex;
  gap: 6px;
  padding: 12px 16px 8px;
}

.filter-chip {
  --background: var(--t-surface-raised);
  --color: var(--t-text-secondary);
  border: 1px solid var(--t-border);
  font-size: 13px;
  margin: 0;
  cursor: pointer;
}

.filter-chip.active {
  --background: var(--t-accent-dim);
  --color: var(--t-accent);
  border-color: var(--t-accent);
}

.pr-list {
  background: transparent;
  padding: 0;
}

.pr-item {
  --background: transparent;
  --padding-start: 16px;
  --inner-padding-end: 12px;
}

.status-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  font-size: 14px;
  margin-right: 10px;
  flex-shrink: 0;
}

.status-icon.open {
  color: var(--t-accent);
  background: var(--t-accent-dim);
}
.status-icon.merged {
  color: var(--t-purple);
  background: rgba(167, 139, 250, 0.1);
}
.status-icon.closed {
  color: var(--t-text-muted);
  background: var(--t-surface-raised);
}

.pr-label {
  white-space: normal;
  padding: 10px 0;
}

.pr-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--t-text-primary);
  display: block;
  margin-bottom: 4px;
  line-height: 1.4;
}

.pr-meta {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--t-text-muted);
  flex-wrap: wrap;
}

.mono {
  font-family: var(--t-mono);
  font-size: 11px;
}

.mono:first-child {
  color: var(--t-accent);
}

.branch {
  color: var(--t-text-secondary);
}

.sep {
  color: var(--t-border-strong);
}

.status-badge {
  font-size: 11px;
  font-weight: 500;
  border-radius: 99px;
  padding: 2px 8px;
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
