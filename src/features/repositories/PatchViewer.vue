<template>
	<section class="patch-viewer" :aria-busy="loading">
		<p v-if="loading" class="patch-viewer__status">Preparing the patch…</p>
		<div v-show="!loading && !failed" ref="root" class="patch-viewer__rendered" />
		<div v-if="failed" class="patch-viewer__fallback">
			<p>The enhanced view is unavailable, so these changes are shown as plain text.</p>
			<pre><code>{{ patch }}</code></pre>
		</div>
	</section>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'

const props = defineProps<{ patch: string }>()
const root = ref<HTMLElement>()
const loading = ref(true)
const failed = ref(false)
let cleanups: Array<() => void> = []
let renderVersion = 0

function cleanUp() {
	for (const dispose of cleanups) dispose()
	cleanups = []
	root.value?.replaceChildren()
}

async function renderPatch() {
	const version = ++renderVersion
	cleanUp()
	loading.value = true
	failed.value = false
	await nextTick()
	if (!root.value) return

	try {
		const { FileDiff, parsePatchFiles } = await import('@pierre/diffs')
		if (version !== renderVersion || !root.value) return
		const files = parsePatchFiles(props.patch, undefined, true).flatMap((parsed) => parsed.files)
		if (files.length === 0) throw new Error('The response did not contain a readable patch')

		for (const file of files) {
			const container = document.createElement('div')
			container.className = 'patch-viewer__file'
			root.value.append(container)
			const diff = new FileDiff({
				diffStyle: 'unified',
				overflow: 'scroll',
				diffIndicators: 'bars',
				hunkSeparators: 'line-info-basic',
				disableErrorHandling: true,
			})
			diff.render({ fileDiff: file, fileContainer: container })
			cleanups.push(() => diff.cleanUp())
		}
	} catch {
		cleanUp()
		failed.value = true
	} finally {
		if (version === renderVersion) loading.value = false
	}
}

watch(() => props.patch, renderPatch, { immediate: true })
onBeforeUnmount(() => {
	renderVersion += 1
	cleanUp()
})
</script>

<style scoped>
.patch-viewer,
.patch-viewer__rendered {
	display: grid;
	gap: var(--space-4);
	min-inline-size: 0;
}

.patch-viewer__status,
.patch-viewer__fallback > p {
	margin: 0;
	color: var(--app-text-muted);
}

.patch-viewer__rendered :deep(.patch-viewer__file),
.patch-viewer__fallback pre {
	min-inline-size: 0;
	margin: 0;
	border: 1px solid var(--app-border);
	border-radius: var(--radius-md);
	overflow: hidden;
}

.patch-viewer__fallback {
	display: grid;
	gap: var(--space-3);
}

.patch-viewer__fallback pre {
	max-block-size: 70vh;
	overflow: auto;
	padding: var(--space-4);
	background: var(--app-surface);
	font-size: var(--text-sm);
}
</style>
