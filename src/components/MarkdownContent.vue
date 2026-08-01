<template>
	<div class="markdown-content" @click="followLocalLink" v-html="html"></div>
</template>

<script setup lang="ts">
import { renderMarkdown } from '@/content'
import { computed } from 'vue'
import { useRouter } from 'vue-router'

const props = defineProps<{ source: string; repo?: string }>()
const router = useRouter()
const html = computed(() =>
	renderMarkdown(props.source, { repo: props.repo, resolveRoute: (location) => router.resolve(location).href }),
)

function followLocalLink(event: MouseEvent): void {
	if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
		return
	const target = event.target
	if (!(target instanceof Element)) return
	const anchor = target.closest<HTMLAnchorElement>('a[data-twisted-link="local"]')
	if (!anchor) return

	event.preventDefault()
	void router.push(anchor.getAttribute('href') ?? '/')
}
</script>

<style scoped>
.markdown-content {
	max-inline-size: 75ch;
	line-height: 1.65;
	overflow-wrap: anywhere;
}

.markdown-content :deep(h1),
.markdown-content :deep(h2),
.markdown-content :deep(h3),
.markdown-content :deep(h4) {
	margin-block: 1.6em 0.55em;
	font-family: var(--font-display);
	line-height: 1.15;
	text-wrap: balance;
}

.markdown-content :deep(p),
.markdown-content :deep(ul),
.markdown-content :deep(ol),
.markdown-content :deep(blockquote),
.markdown-content :deep(pre),
.markdown-content :deep(table) {
	margin-block: var(--space-4);
}

.markdown-content :deep(blockquote) {
	margin-inline: 0;
	border-inline-start: 3px solid var(--app-accent);
	padding-inline: var(--space-5);
	color: var(--app-text-muted);
}

.markdown-content :deep(pre),
.markdown-content :deep(code) {
	background: var(--app-surface);
}

.markdown-content :deep(code) {
	border-radius: 0.25rem;
	padding: 0.125em 0.35em;
}

.markdown-content :deep(pre) {
	max-inline-size: 100%;
	border: 1px solid var(--app-border);
	border-radius: var(--radius-sm);
	padding: var(--space-4);
	overflow: auto;
}

.markdown-content :deep(pre code) {
	padding: 0;
}

.markdown-content :deep(table) {
	display: block;
	max-inline-size: 100%;
	border-collapse: collapse;
	overflow-x: auto;
}

.markdown-content :deep(th),
.markdown-content :deep(td) {
	border: 1px solid var(--app-border);
	padding: var(--space-2) var(--space-3);
	text-align: start;
}
</style>
