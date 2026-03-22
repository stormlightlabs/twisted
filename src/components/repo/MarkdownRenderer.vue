<!-- TODO: markdown → HTML pipeline (e.g. marked + DOMPurify). -->
<template>
  <div class="markdown-body">
    <pre class="markdown-raw">{{ content }}</pre>
  </div>
</template>

<script setup lang="ts">
defineProps<{ content: string }>();
</script>

<style scoped>
.markdown-body {
  padding: 0 16px 24px;
}

.markdown-raw {
  font-family: var(--t-mono);
  font-size: 12px;
  color: var(--t-text-secondary);
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
  margin: 0;
  background: var(--t-surface-raised);
  border: 1px solid var(--t-border);
  border-radius: var(--t-radius-md);
  padding: 14px 16px;
  overflow-x: auto;
}
</style>
