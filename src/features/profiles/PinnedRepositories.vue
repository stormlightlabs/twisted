<template>
	<section class="profile-section" aria-labelledby="pinned-heading">
		<div class="profile-section__heading">
			<p class="section-label">Saved for visitors</p>
			<h2 id="pinned-heading">Pinned repositories</h2>
		</div>
		<request-state
			:error="request.error.value"
			:loading="request.phase.value === 'loading'"
			:retry-in-ms="request.retryInMs.value"
			noun="pinned repositories"
			@retry="request.retry" />
		<div v-if="request.data.value" class="repo-list">
			<template v-for="item in request.data.value" :key="item.identifier">
				<repository-card v-if="item.repository" :repository="item.repository" />
				<div v-else class="repo-unavailable">
					<strong>Repository unavailable</strong>
					<code>{{ item.identifier }}</code>
				</div>
			</template>
		</div>
	</section>
</template>

<script setup lang="ts">
import { useBobbinClientProvider } from '@/api'
import RequestState from '@/components/RequestState.vue'
import { useRouteRequest } from '@/requests'
import { computed } from 'vue'
import RepositoryCard from './RepositoryCard.vue'

const props = defineProps<{ repositories: readonly string[] }>()
const getClient = useBobbinClientProvider()
const source = computed(() => props.repositories.join('\u0000'))
const request = useRouteRequest(source, async (_source, signal) => {
	const results = await Promise.allSettled(
		props.repositories.map((identifier) =>
			identifier.startsWith('at://')
				? getClient().getRepo(identifier as Parameters<ReturnType<typeof getClient>['getRepo']>[0], { signal })
				: getClient().getRepoByRepoDid(identifier as Parameters<ReturnType<typeof getClient>['getRepoByRepoDid']>[0], {
						signal,
					}),
		),
	)
	return results.map((result, index) => ({
		identifier: props.repositories[index],
		repository: result.status === 'fulfilled' ? result.value : undefined,
	}))
})
</script>

<style scoped>
.profile-section {
	display: grid;
	gap: var(--space-4);
}
.profile-section__heading h2 {
	margin: 0;
	font-family: var(--font-display);
	font-size: var(--text-2xl);
}
.repo-list {
	display: grid;
	gap: var(--space-3);
}
.repo-unavailable {
	display: grid;
	gap: var(--space-2);
	border: 1px solid var(--app-border);
	border-radius: var(--radius-md);
	padding: var(--space-5);
}
.repo-unavailable code {
	color: var(--app-text-muted);
	font-size: var(--text-xs);
	overflow-wrap: anywhere;
}
</style>
