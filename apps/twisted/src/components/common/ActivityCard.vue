<template>
  <ion-item class="activity-item" lines="none" button @click="emit('click')">
    <div slot="start" class="kind-icon" :style="{ color: config.color, background: config.dimColor }">
      <ion-icon :icon="config.icon" />
    </div>

    <ion-label class="activity-label">
      <div class="activity-text">
        <button class="actor" type="button" @click.stop="emit('actorClick')">{{ item.actorHandle }}</button>
        <span class="verb"> {{ config.verb }} </span>
        <span v-if="item.targetName" class="target">{{ item.targetName }}</span>
      </div>
      <div class="activity-time">{{ relativeTime(item.createdAt) }}</div>
    </ion-label>
  </ion-item>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { IonItem, IonLabel, IonIcon } from "@ionic/vue";
import {
  addCircleOutline,
  starOutline,
  personAddOutline,
  gitMergeOutline,
  checkmarkCircleOutline,
  alertCircleOutline,
  closeCircleOutline,
} from "ionicons/icons";
import type { ActivityItem } from "@/domain/models/activity.js";

const props = defineProps<{ item: ActivityItem }>();
const emit = defineEmits<{ click: []; actorClick: [] }>();

type KindConfig = { icon: string; color: string; dimColor: string; verb: string };

const KIND_MAP: Record<ActivityItem["kind"], KindConfig> = {
  repo_created: { icon: addCircleOutline, color: "#22d3ee", dimColor: "rgba(34,211,238,0.1)", verb: "created" },
  repo_starred: { icon: starOutline, color: "#fbbf24", dimColor: "rgba(251,191,36,0.1)", verb: "starred" },
  user_followed: { icon: personAddOutline, color: "#a78bfa", dimColor: "rgba(167,139,250,0.1)", verb: "followed" },
  pr_opened: { icon: gitMergeOutline, color: "#22d3ee", dimColor: "rgba(34,211,238,0.1)", verb: "opened a PR on" },
  pr_merged: {
    icon: checkmarkCircleOutline,
    color: "#34d399",
    dimColor: "rgba(52,211,153,0.1)",
    verb: "merged a PR in",
  },
  issue_opened: {
    icon: alertCircleOutline,
    color: "#fb923c",
    dimColor: "rgba(251,146,60,0.1)",
    verb: "opened an issue on",
  },
  issue_closed: {
    icon: closeCircleOutline,
    color: "#6b7280",
    dimColor: "rgba(107,114,128,0.1)",
    verb: "closed an issue on",
  },
};

const config = computed(() => KIND_MAP[props.item.kind]);

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
.activity-item {
  --background: transparent;
  --padding-start: 16px;
  --padding-end: 16px;
  --inner-padding-end: 0;
  --min-height: 56px;
}

.kind-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  font-size: 17px;
  margin-right: 12px;
  flex-shrink: 0;
}

.activity-label {
  padding: 10px 0;
  white-space: normal;
}

.activity-text {
  font-size: 13px;
  line-height: 1.45;
  color: var(--t-text-secondary);
  display: inline-flex;
  gap: 4px;
}

.actor {
  appearance: none;
  background: transparent;
  border: 0;
  padding: 0;
  margin: 0;
  cursor: pointer;
  font-family: var(--t-mono);
  font-size: 12px;
  font-weight: 600;
  color: var(--t-accent);
}

.verb {
  color: var(--t-text-secondary);
}

.target {
  font-family: var(--t-mono);
  font-size: 12px;
  font-weight: 500;
  color: var(--t-text-primary);
}

.activity-time {
  font-size: 11px;
  color: var(--t-text-muted);
  margin-top: 2px;
}
</style>
