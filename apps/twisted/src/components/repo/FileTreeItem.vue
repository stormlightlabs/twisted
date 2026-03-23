<template>
  <ion-item class="file-item" :lines="lines" button @click="emit('click')">
    <ion-icon slot="start" :icon="fileIcon" class="file-icon" :class="file.type" />
    <ion-label class="file-label">
      <span class="file-name">{{ file.name }}</span>
      <span v-if="file.lastCommitMessage" class="commit-msg">{{ file.lastCommitMessage }}</span>
    </ion-label>
    <span v-if="file.type === 'dir'" class="chevron">
      <ion-icon :icon="chevronForwardOutline" />
    </span>
  </ion-item>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { IonItem, IonLabel, IonIcon } from "@ionic/vue";
import { folderOpenOutline, documentTextOutline, gitBranchOutline, chevronForwardOutline } from "ionicons/icons";
import type { RepoFile } from "@/domain/models/repo.js";

const props = defineProps<{ file: RepoFile; lines?: "full" | "inset" | "none" }>();

const emit = defineEmits<{ click: [] }>();

const fileIcon = computed(() => {
  if (props.file.type === "dir") return folderOpenOutline;
  if (props.file.type === "submodule") return gitBranchOutline;
  return documentTextOutline;
});
</script>

<style scoped>
.file-item {
  --background: transparent;
  --padding-start: 16px;
  --inner-padding-end: 12px;
  --min-height: 46px;
}

.file-icon {
  font-size: 17px;
  margin-right: 10px;
  flex-shrink: 0;
}

.file-icon.dir {
  color: var(--t-amber);
}

.file-icon.file {
  color: var(--t-text-muted);
}

.file-icon.submodule {
  color: var(--t-purple);
}

.file-label {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 0;
  min-width: 0;
}

.file-name {
  font-family: var(--t-mono);
  font-size: 13px;
  font-weight: 500;
  color: var(--t-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex-shrink: 0;
  max-width: 45%;
}

.commit-msg {
  font-size: 12px;
  color: var(--t-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
  margin-left: 12px;
}

.chevron {
  font-size: 14px;
  color: var(--t-text-muted);
  flex-shrink: 0;
}
</style>
