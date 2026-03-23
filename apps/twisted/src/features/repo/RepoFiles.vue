<template>
  <div class="files-view">
    <div v-if="selectedFile || currentPath" class="viewer-header">
      <ion-button fill="clear" size="small" class="back-btn" @click="goBack">
        <ion-icon slot="start" :icon="arrowBackOutline" />
        {{ selectedFile ? "Files" : "Up" }}
      </ion-button>
      <span class="file-path mono">{{ selectedFile ? selectedFile.path : currentPath }}</span>
    </div>

    <template v-if="selectedFile">
      <template v-if="blobQuery.isPending.value">
        <SkeletonLoader v-for="n in 6" :key="n" variant="list-item" />
      </template>
      <EmptyState
        v-else-if="blobQuery.isError.value"
        :icon="alertCircleOutline"
        title="Could not load file"
        :message="blobQuery.error.value instanceof Error ? blobQuery.error.value.message : 'Unknown error'" />
      <template v-else-if="blobQuery.data.value">
        <div v-if="binaryPreviewUrl" class="image-preview-wrap">
          <div class="file-meta">
            <span class="file-size" v-if="blobQuery.data.value.size != null">
              {{ formatSize(blobQuery.data.value.size) }}
            </span>
          </div>
          <img :src="binaryPreviewUrl" :alt="selectedFile?.name ?? 'Repository image'" class="image-preview" />
        </div>
        <div v-else-if="blobQuery.data.value.isBinary" class="binary-notice">
          <ion-icon :icon="documentOutline" class="binary-icon" />
          Binary file — cannot display.
        </div>
        <div v-else class="file-content-wrap">
          <div class="file-meta">
            <span class="file-size" v-if="blobQuery.data.value.size != null">
              {{ formatSize(blobQuery.data.value.size) }}
            </span>
          </div>
          <div
            v-if="highlightedHtml"
            class="file-content shiki-wrap"
            v-html="highlightedHtml" />
          <pre v-else class="file-content"><code>{{ blobQuery.data.value.content }}</code></pre>
        </div>
      </template>
    </template>

    <template v-else>
      <template v-if="treeQuery.isPending.value">
        <SkeletonLoader v-for="n in 6" :key="n" variant="list-item" />
      </template>
      <EmptyState
        v-else-if="treeQuery.isError.value"
        :icon="alertCircleOutline"
        title="Could not load files"
        :message="treeQuery.error.value instanceof Error ? treeQuery.error.value.message : 'Unknown error'" />
      <ion-list v-else lines="inset" class="file-list">
        <FileTreeItem v-for="file in sortedFiles" :key="file.path" :file="file" @click="handleFileClick(file)" />
      </ion-list>
      <EmptyState
        v-if="!sortedFiles.length && !treeQuery.isPending.value && !treeQuery.isError.value"
        :icon="folderOpenOutline"
        title="No files"
        :message="currentPath ? 'This directory is empty.' : 'This repository appears to be empty.'" />
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onBeforeUnmount } from "vue";
import { IonList, IonButton, IonIcon } from "@ionic/vue";
import { folderOpenOutline, alertCircleOutline, arrowBackOutline, documentOutline } from "ionicons/icons";
import FileTreeItem from "@/components/repo/FileTreeItem.vue";
import EmptyState from "@/components/common/EmptyState.vue";
import SkeletonLoader from "@/components/common/SkeletonLoader.vue";
import { useRepoBlob, useRepoTree } from "@/services/tangled/queries.js";
import type { RepoFile } from "@/domain/models/repo.js";
import { highlightCode } from "@/lib/syntax.js";
import { createObjectUrlFromBlobContent } from "@/services/tangled/repo-assets.js";

const props = defineProps<{ knotHost: string; knotRepo: string; branch: string }>();

const selectedFile = ref<RepoFile | null>(null);
const currentPath = ref("");

const treeQuery = useRepoTree(
  computed(() => props.knotHost),
  computed(() => props.knotRepo),
  computed(() => props.branch),
  currentPath,
  { enabled: computed(() => !!props.knotHost && !!props.knotRepo && !!props.branch) },
);

const sortedFiles = computed(() => {
  const files = treeQuery.data.value ?? [];
  return [...files].sort((a, b) => {
    if (a.type === b.type) return a.name.localeCompare(b.name);
    if (a.type === "dir") return -1;
    if (b.type === "dir") return 1;
    if (a.type === "submodule") return -1;
    if (b.type === "submodule") return 1;
    return 0;
  });
});

const filePath = computed(() => selectedFile.value?.path ?? "");
const isFileSelected = computed(() => !!selectedFile.value && selectedFile.value.type === "file");

const blobQuery = useRepoBlob(
  computed(() => props.knotHost),
  computed(() => props.knotRepo),
  computed(() => props.branch),
  filePath,
  { enabled: isFileSelected },
);

function handleFileClick(file: RepoFile) {
  if (file.type === "dir") {
    currentPath.value = file.path;
    selectedFile.value = null;
    return;
  }

  if (file.type === "submodule") return;

  selectedFile.value = file;
}

function goBack() {
  if (selectedFile.value) {
    selectedFile.value = null;
    return;
  }

  if (!currentPath.value) return;
  const segments = currentPath.value.split("/").filter(Boolean);
  segments.pop();
  currentPath.value = segments.join("/");
}

const highlightedHtml = ref<string | null>(null);
const binaryPreviewUrl = ref<string | null>(null);

watch(
  () => [blobQuery.data.value?.content, selectedFile.value?.name] as const,
  async ([content, name]) => {
    highlightedHtml.value = null;
    if (!content || !name) return;
    highlightedHtml.value = await highlightCode(content, name);
  },
  { immediate: true },
);

watch(
  () => blobQuery.data.value,
  (blob) => {
    if (binaryPreviewUrl.value) {
      URL.revokeObjectURL(binaryPreviewUrl.value);
      binaryPreviewUrl.value = null;
    }

    if (!blob) return;
    binaryPreviewUrl.value = createObjectUrlFromBlobContent(blob);
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  if (binaryPreviewUrl.value) {
    URL.revokeObjectURL(binaryPreviewUrl.value);
  }
});

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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

.viewer-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 8px 4px;
  border-bottom: 1px solid var(--t-border);
}

.back-btn {
  --color: var(--t-accent);
  flex-shrink: 0;
}

.file-path {
  font-family: var(--t-mono);
  font-size: 12px;
  color: var(--t-text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-content-wrap {
  overflow: auto;
}

.image-preview-wrap {
  display: flex;
  flex-direction: column;
}

.image-preview {
  display: block;
  width: 100%;
  height: auto;
  object-fit: contain;
  background: var(--t-surface-raised);
}

.file-meta {
  padding: 6px 16px;
  border-bottom: 1px solid var(--t-border);
  display: flex;
  justify-content: flex-end;
}

.file-size {
  font-size: 11px;
  color: var(--t-text-muted);
  font-family: var(--t-mono);
}

.file-content {
  margin: 0;
  padding: 16px;
  font-family: var(--t-mono);
  font-size: 12px;
  line-height: 1.6;
  color: var(--t-text-secondary);
  white-space: pre;
  overflow-x: auto;
  tab-size: 2;
}

.binary-notice {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 24px 16px;
  font-size: 14px;
  color: var(--t-text-muted);
}

.binary-icon {
  font-size: 20px;
}

.shiki-wrap :deep(.shiki) {
  margin: 0;
  padding: 16px;
  font-family: var(--t-mono);
  font-size: 12px;
  line-height: 1.6;
  tab-size: 2;
  overflow-x: auto;
  background: transparent !important;
}

.shiki-wrap :deep(.shiki code) {
  font-family: inherit;
  font-size: inherit;
  background: transparent !important;
}

/* Dual-theme: light tokens visible by default, dark tokens on dark scheme */
.shiki-wrap :deep(.shiki span) {
  color: var(--shiki-light);
}

@media (prefers-color-scheme: dark) {
  .shiki-wrap :deep(.shiki span) {
    color: var(--shiki-dark);
  }
}
</style>
