<template>
	<router-link class="repo-card" :to="links.repository(repository.uri)">
		<div>
			<span>
				<strong>{{ repositoryName(repository) }}</strong>
				<code>{{ repositoryRkey(repository.uri) }}</code>
			</span>
			<small>{{ repository.value.knot.replace(/^https?:\/\//, '') }}</small>
		</div>
		<p v-if="repository.value.description">{{ repository.value.description }}</p>
		<ul v-if="repository.value.topics?.length" aria-label="Topics">
			<li v-for="topic in repository.value.topics.slice(0, 5)" :key="topic">{{ topic }}</li>
		</ul>
		<code class="repo-card__uri">{{ repository.uri }}</code>
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

function repositoryRkey(uri: string): string {
	return uri.split('/').at(-1) ?? uri
}
</script>

<style scoped>
.repo-card {
	display: grid;
	gap: var(--space-2);
	border-block-end: 1px solid var(--app-border);
	padding: var(--space-4) var(--space-2);
	color: var(--app-text);
	background: transparent;
	text-decoration: none;
}
.repo-card:hover {
	background: var(--app-surface);
}
.repo-card > div {
	display: flex;
	flex-wrap: wrap;
	align-items: baseline;
	justify-content: space-between;
	gap: var(--space-2);
}
.repo-card > div > span {
	display: flex;
	flex-wrap: wrap;
	align-items: baseline;
	gap: var(--space-2);
}
.repo-card strong {
	font-family: var(--font-display);
	font-size: var(--text-lg);
}
.repo-card small {
	color: var(--app-success);
	font-size: var(--text-xs);
}
.repo-card > div code {
	color: var(--app-text-muted);
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
.repo-card__uri {
	color: var(--app-text-muted);
	font-size: var(--text-xs);
	overflow-wrap: anywhere;
}
</style>
