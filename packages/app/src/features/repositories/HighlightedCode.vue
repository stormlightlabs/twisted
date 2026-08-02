<template>
	<div class="highlighted-code" :aria-busy="loading">
		<span v-if="loading" class="sr-only">Applying syntax highlighting…</span>
		<ol :class="['code-lines', { 'code-lines--wrap': wrap }]">
			<li v-for="(line, index) in renderedLines" :id="`L${index + 1}`" :key="index">
				<a :href="`#L${index + 1}`" :aria-label="`Line ${index + 1}`">{{ index + 1 }}</a>
				<code
					><span v-for="(token, tokenIndex) in line" :key="tokenIndex" :style="tokenStyle(token)">{{
						token.content
					}}</span
					><span v-if="line.length === 0"> </span
				></code>
			</li>
		</ol>
	</div>
</template>

<script setup lang="ts">
import { highlightSource } from './syntax'
import type { ThemedToken } from 'shiki'
import { computed, ref, watch } from 'vue'

const props = defineProps<{ lines: string[]; path: string; wrap: boolean }>()
const highlighted = ref<ThemedToken[][]>()
const loading = ref(false)
let renderVersion = 0

const renderedLines = computed(
	() => highlighted.value ?? props.lines.map((content, offset) => [{ content, offset } satisfies ThemedToken]),
)

watch(
	() => [props.lines, props.path] as const,
	async ([lines, path]) => {
		const version = ++renderVersion
		highlighted.value = undefined
		loading.value = true
		try {
			const tokens = await highlightSource(lines.join('\n'), path)
			if (version === renderVersion) highlighted.value = tokens
		} catch {
			// Plain source remains visible when a grammar cannot be loaded.
		} finally {
			if (version === renderVersion) loading.value = false
		}
	},
	{ immediate: true },
)

function tokenStyle(token: ThemedToken): Record<string, string> | undefined {
	if (!token.color && !token.fontStyle) return undefined
	return {
		...(token.color ? { color: token.color } : {}),
		...(token.fontStyle && token.fontStyle & 1 ? { fontStyle: 'italic' } : {}),
		...(token.fontStyle && token.fontStyle & 2 ? { fontWeight: '700' } : {}),
		...(token.fontStyle && token.fontStyle & 4 ? { textDecoration: 'underline' } : {}),
	}
}
</script>

<style scoped>
.code-lines {
	margin: 0;
	padding: var(--space-3) 0;
	overflow-x: auto;
	background: var(--app-background);
	list-style: none;
}

.code-lines li {
	display: grid;
	grid-template-columns: 4rem minmax(max-content, 1fr);
	min-block-size: 1.55rem;
	padding-inline-end: var(--space-4);
}

.code-lines li:target {
	background: color-mix(in srgb, var(--app-accent) 14%, transparent);
}

.code-lines li > a {
	padding-inline: var(--space-3);
	color: var(--app-text-muted);
	text-align: end;
	text-decoration: none;
	user-select: none;
}

.code-lines code {
	white-space: pre;
}

.code-lines--wrap li {
	grid-template-columns: 4rem minmax(0, 1fr);
}

.code-lines--wrap code {
	overflow-wrap: anywhere;
	white-space: pre-wrap;
}
</style>
