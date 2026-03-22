<template>
  <div class="files-view">
    <ion-list lines="inset" class="file-list">
      <FileTreeItem
        v-for="file in sortedFiles"
        :key="file.name"
        :file="file"
        lines="inset"
        @click="handleFileClick(file)" />
    </ion-list>

    <EmptyState
      v-if="!files.length"
      :icon="folderOpenOutline"
      title="No files"
      message="This repository appears to be empty." />
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { IonList } from "@ionic/vue";
import { folderOpenOutline } from "ionicons/icons";
import FileTreeItem from "@/components/repo/FileTreeItem.vue";
import EmptyState from "@/components/common/EmptyState.vue";
import type { RepoFile } from "@/domain/models/repo";

const props = defineProps<{ files: RepoFile[] }>();

/* Sort dirs first, then files, alphabetically within each group */
const sortedFiles = computed(() => {
  return [...props.files].sort((a, b) => {
    if (a.type === b.type) return a.name.localeCompare(b.name);
    return a.type === "dir" ? -1 : 1;
  });
});

function handleFileClick(file: RepoFile) {
  // TODO: navigate into dir or open file viewer
  console.log("file clicked:", file.path, file.name);
}
</script>

<style scoped>
.files-view {
  padding-bottom: 32px;
}

.file-list {
  background: transparent;
  padding: 8px 0;
}
</style>
