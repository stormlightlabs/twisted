<template>
  <div class="issues-view">
    <div v-if="isLoading" class="loading-center">
      <ion-spinner name="crescent" />
    </div>

    <template v-else>
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

      <ion-list lines="inset" class="issue-list">
        <ion-item
          v-for="issue in filtered"
          :key="issue.atUri"
          class="issue-item"
          button
          lines="inset"
          @click="emit('select', issue)">
          <div slot="start" class="state-dot" :class="issue.state" />
          <ion-label class="issue-label">
            <span class="issue-title">{{ issue.title }}</span>
            <div class="issue-meta">
              <span class="mono">{{ issue.authorHandle }}</span>
              <span class="sep">·</span>
              <span>{{ relativeTime(issue.createdAt) }}</span>
              <template v-if="issue.commentCount">
                <span class="sep">·</span>
                <ion-icon :icon="chatbubbleOutline" class="meta-icon" />
                <span>{{ issue.commentCount }}</span>
              </template>
            </div>
          </ion-label>
          <ion-badge slot="end" class="state-badge" :class="issue.state">
            {{ issue.state }}
          </ion-badge>
        </ion-item>
      </ion-list>

      <EmptyState
        v-if="!filtered.length"
        :icon="alertCircleOutline"
        title="No issues"
        :message="filter === 'all' ? 'No issues filed yet.' : `No ${filter} issues.`" />
    </template>
  </div>
</template>

<script setup lang="ts">
  import { ref, computed } from "vue";
  import { IonList, IonItem, IonLabel, IonBadge, IonIcon, IonChip, IonSpinner } from "@ionic/vue";
  import { chatbubbleOutline, alertCircleOutline } from "ionicons/icons";
  import EmptyState from "@/components/common/EmptyState.vue";
  import type { IssueSummary } from "@/domain/models/issue.js";

  const props = defineProps<{ issues: IssueSummary[]; isLoading?: boolean }>();
  const emit = defineEmits<{ select: [issue: IssueSummary] }>();

  const filter = ref<"all" | "open" | "closed">("open");

  const FILTERS = [
    { value: "open", label: "Open" },
    { value: "closed", label: "Closed" },
    { value: "all", label: "All" },
  ] as const;

  const filtered = computed(() => {
    if (filter.value === "all") return props.issues;
    return props.issues.filter((i) => i.state === filter.value);
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
  .issues-view {
    padding-bottom: 32px;
  }

  .loading-center {
    display: flex;
    justify-content: center;
    padding: 48px 0;
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

  .issue-list {
    background: transparent;
    padding: 0;
  }

  .issue-item {
    --background: transparent;
    --padding-start: 16px;
    --inner-padding-end: 12px;
  }

  .state-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
    margin-right: 12px;
  }

  .state-dot.open {
    background: var(--t-green);
  }
  .state-dot.closed {
    background: var(--t-text-muted);
  }

  .issue-label {
    white-space: normal;
    padding: 10px 0;
  }

  .issue-title {
    font-size: 13px;
    font-weight: 500;
    color: var(--t-text-primary);
    display: block;
    margin-bottom: 4px;
    line-height: 1.4;
  }

  .issue-meta {
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
    color: var(--t-accent);
  }

  .sep {
    color: var(--t-border-strong);
  }

  .meta-icon {
    font-size: 11px;
  }

  .state-badge {
    font-size: 11px;
    font-weight: 500;
    border-radius: 99px;
    padding: 2px 8px;
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
