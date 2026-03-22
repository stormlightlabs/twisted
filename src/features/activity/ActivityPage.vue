<template>
  <ion-page>
    <ion-header :translucent="true">
      <ion-toolbar>
        <ion-title>Activity</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content :fullscreen="true">
      <ion-header collapse="condense">
        <ion-toolbar>
          <ion-title size="large">Activity</ion-title>
        </ion-toolbar>
      </ion-header>

      <!-- Filter chips -->
      <div class="filters-wrap">
        <ion-chip
          v-for="f in FILTERS"
          :key="f.value"
          class="filter-chip"
          :class="{ active: activeFilter === f.value }"
          @click="activeFilter = f.value">
          {{ f.label }}
        </ion-chip>
      </div>

      <!-- Activity list -->
      <ion-list lines="inset">
        <template v-if="loading">
          <SkeletonLoader v-for="n in 6" :key="n" variant="list-item" />
        </template>
        <template v-else-if="filteredActivity.length">
          <ActivityCard v-for="item in filteredActivity" :key="item.id" :item="item" />
        </template>
        <template v-else>
          <EmptyState :icon="pulseOutline" title="No activity" message="Nothing here yet for this filter." />
        </template>
      </ion-list>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonList, IonChip } from "@ionic/vue";
import { pulseOutline } from "ionicons/icons";
import ActivityCard from "@/components/common/ActivityCard.vue";
import SkeletonLoader from "@/components/common/SkeletonLoader.vue";
import EmptyState from "@/components/common/EmptyState.vue";
import { getMockActivity } from "@/mocks/activity";
import type { ActivityItem } from "@/domain/models/activity";

const loading = ref(true);
const allActivity = getMockActivity();
const activeFilter = ref<"all" | "repos" | "prs" | "issues" | "people">("all");

const FILTERS = [
  { value: "all", label: "All" },
  { value: "repos", label: "Repos" },
  { value: "prs", label: "PRs" },
  { value: "issues", label: "Issues" },
  { value: "people", label: "People" },
] as const;

const KIND_GROUPS: Record<string, ActivityItem["kind"][]> = {
  repos: ["repo_created", "repo_starred"],
  prs: ["pr_opened", "pr_merged"],
  issues: ["issue_opened", "issue_closed"],
  people: ["user_followed"],
};

const filteredActivity = computed(() => {
  if (activeFilter.value === "all") return allActivity;
  const kinds = KIND_GROUPS[activeFilter.value] ?? [];
  return allActivity.filter((a) => kinds.includes(a.kind));
});

onMounted(() => {
  setTimeout(() => {
    loading.value = false;
  }, 400);
});
</script>

<style scoped>
.filters-wrap {
  display: flex;
  gap: 6px;
  padding: 12px 16px 4px;
  overflow-x: auto;
  scrollbar-width: none;
}

.filters-wrap::-webkit-scrollbar {
  display: none;
}

.filter-chip {
  --background: var(--t-surface-raised);
  --color: var(--t-text-secondary);
  border: 1px solid var(--t-border);
  flex-shrink: 0;
  font-size: 13px;
  margin: 0;
  cursor: pointer;
}

.filter-chip.active {
  --background: var(--t-accent-dim);
  --color: var(--t-accent);
  border-color: var(--t-accent);
}

ion-list {
  background: transparent;
  padding: 0;
}
</style>
