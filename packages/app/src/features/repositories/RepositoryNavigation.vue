<template>
	<nav class="repository-navigation" aria-label="Repository">
		<router-link :to="links.repository(repo)">Overview</router-link>
		<router-link :to="links.source(repo, currentRef)">Source</router-link>
		<router-link :to="links.commits(repo, currentRef)">History</router-link>
		<router-link :to="links.compare(repo, currentRef || 'HEAD', currentRef || 'HEAD')">Compare</router-link>
		<router-link :to="links.branches(repo)">Branches</router-link>
		<router-link :to="links.tags(repo)">Tags</router-link>
	</nav>
</template>

<script setup lang="ts">
import { links } from '@/lib/router/links'

defineProps<{ repo: string; currentRef?: string }>()
</script>

<style scoped>
.repository-navigation {
	display: flex;
	gap: var(--space-2);
	overflow-x: auto;
	border-block-end: 1px solid var(--app-border);
	padding-block-end: var(--space-2);
}

.repository-navigation a {
	flex: 0 0 auto;
	min-block-size: 44px;
	border-radius: var(--radius-sm);
	padding: var(--space-3) var(--space-4);
	color: var(--app-text-muted);
	font-weight: 700;
	text-decoration: none;
}

.repository-navigation a:hover,
.repository-navigation a.router-link-active {
	color: var(--app-text);
	background: var(--app-surface-raised);
}
</style>
