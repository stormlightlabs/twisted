<template>
  <div v-if="imageUrl" class="image-wrap">
    <img :src="imageUrl" :alt="bookmark.title" class="image-preview" />
  </div>
  <div v-else-if="showMarkdown" class="markdown-wrap">
    <MarkdownRenderer :content="textContent" />
  </div>
  <div v-else-if="highlightedHtml" class="code-render" v-html="highlightedHtml" />
  <pre v-else-if="textContent" class="code-wrap"><code>{{ textContent }}</code></pre>
  <div v-else class="empty-copy">This saved item has no viewable content.</div>
</template>

<script setup lang="ts">
  import { computed, onBeforeUnmount, ref, watch } from "vue";
  import MarkdownRenderer from "@/components/repo/MarkdownRenderer.vue";
  import type { SavedFile, SavedString } from "@/domain/models/bookmark.js";
  import { highlightCode } from "@/lib/syntax.js";
  import { createObjectUrlFromBlobContent } from "@/services/tangled/repo-assets.js";

  const props = defineProps<{ bookmark: SavedFile | SavedString }>();

  const highlightedHtml = ref("");
  const imageUrl = ref<string | null>(null);

  const textContent = computed(() => {
    return props.bookmark.kind === "string" ? props.bookmark.contents : props.bookmark.content;
  });

  const displayName = computed(() => {
    return props.bookmark.kind === "string" ? props.bookmark.filename : props.bookmark.path;
  });

  const showMarkdown = computed(() => {
    if (props.bookmark.kind === "string") return false;
    return props.bookmark.sourceKind === "readme" || /\.md$/i.test(props.bookmark.path);
  });

  watch(
    () => [props.bookmark, showMarkdown.value] as const,
    async ([bookmark, markdown]) => {
      highlightedHtml.value = "";

      if (imageUrl.value) {
        URL.revokeObjectURL(imageUrl.value);
        imageUrl.value = null;
      }

      if (bookmark.kind === "file" && bookmark.isBinary) {
        imageUrl.value = createObjectUrlFromBlobContent({
          path: bookmark.path,
          content: bookmark.content,
          encoding: bookmark.encoding,
          isBinary: bookmark.isBinary,
          mimeType: bookmark.mimeType,
          size: bookmark.size,
        });
        return;
      }

      if (!markdown && textContent.value) {
        highlightedHtml.value = (await highlightCode(textContent.value, displayName.value)) ?? "";
      }
    },
    { immediate: true },
  );

  onBeforeUnmount(() => {
    if (imageUrl.value) {
      URL.revokeObjectURL(imageUrl.value);
    }
  });
</script>

<style scoped>
  .image-wrap,
  .markdown-wrap,
  .code-wrap {
    margin: 0;
  }

  .image-preview {
    display: block;
    width: 100%;
    height: auto;
    object-fit: contain;
    background: var(--t-surface-raised);
  }

  .code-wrap {
    padding: 16px;
    overflow-x: auto;
    font-family: var(--t-mono);
    font-size: 12px;
    line-height: 1.6;
    color: var(--t-text-primary);
    white-space: pre-wrap;
    word-break: break-word;
  }

  .code-render :deep(.shiki) {
    margin: 0;
    padding: 16px;
    background: transparent !important;
    white-space: pre-wrap;
  }

  .empty-copy {
    padding: 24px 16px;
    color: var(--t-text-muted);
    font-size: 14px;
  }
</style>
