<template>
	<router-link class="repo-card" :to="links.repository(repository.uri)">
		<div>
			<strong>{{ repository.value.name || 'Untitled repository' }}</strong>
			<span>{{ repository.value.knot.replace(/^https?:\/\//, '') }}</span>
		</div>
		<p v-if="repository.value.description">{{ repository.value.description }}</p>
		<ul v-if="repository.value.topics?.length" aria-label="Topics">
			<li v-for="topic in repository.value.topics.slice(0, 5)" :key="topic">{{ topic }}</li>
		</ul>
		<code>{{ repository.uri }}</code>
	</router-link>
</template>

<script setup lang="ts">
import type { ValidatedRecordView } from '@/api'
import { links } from '@/router/links'
import type { ShTangledRepo } from '@atcute/tangled'
import type { DeepReadonly } from 'vue'

defineProps<{ repository: DeepReadonly<ValidatedRecordView<ShTangledRepo.Main>> }>()
</script>

<style scoped>
.repo-card {
	display: grid;
	gap: var(--space-3);
	border: 1px solid var(--app-border);
	border-radius: var(--radius-md);
	padding: var(--space-5);
	color: var(--app-text);
	background: var(--app-surface);
	text-decoration: none;
}
.repo-card > div {
	display: flex;
	flex-wrap: wrap;
	align-items: baseline;
	justify-content: space-between;
	gap: var(--space-2);
}
.repo-card strong {
	font-family: var(--font-display);
	font-size: var(--text-lg);
}
.repo-card span {
	color: var(--app-success);
	font-size: var(--text-xs);
}
.repo-card p {
	margin: 0;
	color: var(--app-text-muted);
	line-height: 1.5;
}
.repo-card ul {
	display: flex;
	flex-wrap: wrap;
	gap: var(--space-2);
	margin: 0;
	padding: 0;
	list-style: none;
}
.repo-card li {
	border: 1px solid var(--app-border);
	border-radius: 999px;
	padding: var(--space-1) var(--space-3);
	color: var(--app-text-muted);
	font-size: var(--text-xs);
}
.repo-card code {
	color: var(--app-text-muted);
	font-size: var(--text-xs);
	overflow-wrap: anywhere;
}
</style>
