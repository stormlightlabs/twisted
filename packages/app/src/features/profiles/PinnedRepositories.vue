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
import type { ValidatedRecordView } from '@/lib/api'
import { useBobbinClientProvider } from '@/lib/api'
import RequestState from '@/components/RequestState.vue'
import { useRouteRequest } from '@/lib/requests'
import type { ShTangledRepo } from '@atcute/tangled'
import { computed } from 'vue'
import RepositoryCard from './RepositoryCard.vue'

const props = defineProps<{ did: string; pds: string; repositories: readonly string[] }>()
const getClient = useBobbinClientProvider()
const source = computed(() => JSON.stringify([props.did, props.pds, props.repositories]))
const request = useRouteRequest(source, async (_source, signal, attempt) => {
	const repositories = await loadOwnerRepositories(signal, attempt.cache)
	const byUri = new Map(repositories.map((repository) => [repository.uri, repository]))
	const byRepoDid = new Map<string, ValidatedRecordView<ShTangledRepo.Main>>()
	for (const repository of repositories) {
		if (repository.value.repoDid) byRepoDid.set(repository.value.repoDid, repository)
	}

	return props.repositories.map((identifier) => ({
		identifier,
		repository: identifier.startsWith('at://') ? byUri.get(identifier) : byRepoDid.get(identifier),
	}))
})

async function loadOwnerRepositories(signal: AbortSignal, cache: 'default' | 'reload') {
	const repositories: ValidatedRecordView<ShTangledRepo.Main>[] = []
	let cursor: string | undefined
	let pages = 0
	do {
		const page = await getClient().listPdsRepos(props.did, props.pds, { cache, cursor, limit: 100, signal })
		repositories.push(...page.items)
		cursor = page.cursor
		pages += 1
	} while (cursor && pages < 100)
	return repositories
}
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
