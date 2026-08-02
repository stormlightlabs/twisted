<template>
	<div class="copyable-identifier">
		<code>{{ value }}</code>
		<button type="button" @click="copy">{{ label }}</button>
	</div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const props = withDefaults(defineProps<{ value: string; noun?: string }>(), { noun: 'identifier' })
const label = ref(`Copy ${props.noun}`)

async function copy(): Promise<void> {
	try {
		await navigator.clipboard.writeText(props.value)
		label.value = 'Copied'
	} catch {
		label.value = 'Copy failed'
	}
}
</script>

<style scoped>
.copyable-identifier {
	display: grid;
	grid-template-columns: minmax(0, 1fr) auto;
	gap: var(--space-2);
	align-items: stretch;
}

code {
	min-inline-size: 0;
	border: 1px solid var(--app-border);
	border-radius: var(--radius-sm);
	padding: var(--space-3);
	background: var(--app-background);
	overflow-wrap: anywhere;
}

button {
	min-block-size: 44px;
	border: 1px solid var(--app-border);
	border-radius: var(--radius-sm);
	padding-inline: var(--space-4);
	color: var(--app-text);
	background: var(--app-surface-raised);
	font-weight: 700;
	cursor: pointer;
}

@media (max-width: 34rem) {
	.copyable-identifier {
		grid-template-columns: 1fr;
	}
}
</style>
