<template>
	<router-link class="repo-card" :to="links.repository(repository.uri)">
		<div>
			<strong>{{ repositoryName(repository) }}</strong>
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
import type { ValidatedRecordView } from '@/lib/api'
import { links } from '@/lib/router/links'
import type { ShTangledRepo } from '@atcute/tangled'
import type { DeepReadonly } from 'vue'

defineProps<{ repository: DeepReadonly<ValidatedRecordView<ShTangledRepo.Main>> }>()

function repositoryName(repository: DeepReadonly<ValidatedRecordView<ShTangledRepo.Main>>): string {
	const name = repository.value.name?.trim()
	if (name) return name
	const recordKey = repository.uri.split('/').at(-1)
	return recordKey && !/^3[a-z0-9]{12}$/i.test(recordKey) ? recordKey : 'Repository'
}
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
