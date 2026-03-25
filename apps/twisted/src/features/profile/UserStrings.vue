<template>
  <div class="strings-view">
    <div v-if="isLoading" class="loading-center">
      <ion-spinner name="crescent" />
    </div>

    <template v-else>
      <ion-list lines="inset" class="string-list">
        <ion-item v-for="stringItem in strings" :key="stringItem.atUri" class="string-item" lines="none">
          <ion-label class="string-label">
            <div class="string-head">
              <span class="string-file mono">{{ stringItem.filename }}</span>
              <span class="string-time">{{ relativeTime(stringItem.createdAt) }}</span>
            </div>
            <p v-if="stringItem.description" class="string-description">{{ stringItem.description }}</p>
            <pre class="string-preview">{{ preview(stringItem.contents) }}</pre>
          </ion-label>
        </ion-item>
      </ion-list>

      <EmptyState
        v-if="!strings.length"
        :icon="documentTextOutline"
        title="No strings"
        message="This user hasn't published any strings yet." />
    </template>
  </div>
</template>

<script setup lang="ts">
  import { IonItem, IonLabel, IonList, IonSpinner } from "@ionic/vue";
  import { documentTextOutline } from "ionicons/icons";
  import EmptyState from "@/components/common/EmptyState.vue";
  import type { StringSummary } from "@/domain/models/string.js";

  defineProps<{ strings: StringSummary[]; isLoading?: boolean }>();

  function preview(contents: string): string {
    return contents.length > 280 ? `${contents.slice(0, 280)}...` : contents;
  }

  function relativeTime(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return "just now";
  }
</script>

<style scoped>
  .strings-view {
    padding-bottom: 32px;
  }

  .loading-center {
    display: flex;
    justify-content: center;
    padding: 48px 0;
  }

  .string-list {
    background: transparent;
    padding: 0;
  }

  .string-item {
    --background: transparent;
    --padding-start: 16px;
    --padding-end: 16px;
    --inner-padding-end: 0;
  }

  .string-label {
    white-space: normal;
    padding: 10px 0 14px;
  }

  .string-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .string-file {
    font-size: 12px;
    font-weight: 600;
    color: var(--t-accent);
  }

  .mono {
    font-family: var(--t-mono);
  }

  .string-time {
    font-size: 11px;
    color: var(--t-text-muted);
    flex-shrink: 0;
  }

  .string-description {
    margin: 6px 0 8px;
    font-size: 13px;
    line-height: 1.45;
    color: var(--t-text-secondary);
  }

  .string-preview {
    margin: 0;
    padding: 12px;
    border-radius: var(--t-radius-sm);
    border: 1px solid var(--t-border);
    background: var(--t-surface-raised);
    color: var(--t-text-primary);
    font-family: var(--t-mono);
    font-size: 12px;
    line-height: 1.45;
    overflow-x: auto;
    white-space: pre-wrap;
    word-break: break-word;
  }
</style>
