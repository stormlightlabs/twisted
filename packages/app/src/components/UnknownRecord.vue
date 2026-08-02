<template>
	<article class="unknown-record">
		<record-header :author="author" :canonical-url="canonicalUrl" :collection="collection" :uri="uri" />
		<p>This record type does not have a dedicated view yet. Its validated data is shown below.</p>
		<pre><code>{{ formattedValue }}</code></pre>
	</article>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import RecordHeader from './RecordHeader.vue'

const props = defineProps<{ uri: string; collection: string; value: unknown; author?: string; canonicalUrl?: string }>()
const formattedValue = computed(() => JSON.stringify(props.value, null, 2))
</script>

<style scoped>
.unknown-record > p {
	max-inline-size: 65ch;
	color: var(--app-text-muted);
	line-height: 1.6;
}

.unknown-record pre {
	max-inline-size: 100%;
	border: 1px solid var(--app-border);
	border-radius: var(--radius-sm);
	padding: var(--space-4);
	background: var(--app-surface);
	overflow: auto;
}
</style>
