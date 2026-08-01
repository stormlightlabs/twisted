<template>
	<section class="profile-section" aria-labelledby="repos-heading">
		<div class="profile-section__heading">
			<p class="section-label">Public code</p>
			<h2 id="repos-heading">Repositories</h2>
		</div>
		<request-state
			:empty="request.phase.value === 'empty'"
			empty-message="This person has no public repositories yet."
			:error="request.error.value"
			:has-content="request.hasContent.value"
			:loading="request.phase.value === 'loading'"
			:retry-in-ms="request.retryInMs.value"
			noun="repositories"
			@retry="request.retry" />
		<div v-if="repositories.length" class="repo-list">
			<repository-card v-for="repository in repositories" :key="repository.uri" :repository="repository" />
		</div>
		<request-state
			:error="nextError"
			:has-content="true"
			:loading="loadingNext"
			noun="more repositories"
			@retry="loadNext" />
		<button v-if="nextCursor && !loadingNext" class="show-more" type="button" @click="loadNext">Show more</button>
	</section>
</template>

<script setup lang="ts">
import type { BobbinError, ValidatedRecordView } from '@/api'
import { errorFromException, useBobbinClientProvider } from '@/api'
import RequestState from '@/components/RequestState.vue'
import { useRouteRequest } from '@/requests'
import type { ShTangledRepo } from '@atcute/tangled'
import { computed, ref } from 'vue'
import RepositoryCard from './RepositoryCard.vue'

const props = defineProps<{ did: string }>()
const getClient = useBobbinClientProvider()
const appended = ref<ValidatedRecordView<ShTangledRepo.Main>[]>([])
const nextCursor = ref<string>()
const loadingNext = ref(false)
const nextError = ref<BobbinError>()
const requestedCursors = new Set<string>()

const request = useRouteRequest(
	() => props.did,
	async (did, signal, attempt) => {
		appended.value = []
		requestedCursors.clear()
		const page = await getClient().listRepos(did as Parameters<ReturnType<typeof getClient>['listRepos']>[0], {
			signal,
			cache: attempt.cache,
			limit: 20,
		})
		nextCursor.value = page.cursor
		return page.items
	},
	{ isEmpty: (items) => items.length === 0 },
)
const repositories = computed(() => [...(request.data.value ?? []), ...appended.value])

async function loadNext(): Promise<void> {
	const cursor = nextCursor.value
	if (!cursor || loadingNext.value || requestedCursors.has(cursor)) return
	requestedCursors.add(cursor)
	loadingNext.value = true
	nextError.value = undefined
	try {
		const page = await getClient().listRepos(props.did as Parameters<ReturnType<typeof getClient>['listRepos']>[0], {
			cursor,
			limit: 20,
		})
		appended.value.push(...page.items)
		nextCursor.value = page.cursor
	} catch (error) {
		requestedCursors.delete(cursor)
		nextError.value = errorFromException(error)
	} finally {
		loadingNext.value = false
	}
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
.show-more {
	justify-self: start;
	min-block-size: 44px;
	border: 0;
	border-radius: var(--radius-sm);
	padding-inline: var(--space-5);
	color: var(--app-accent-contrast);
	background: var(--app-accent);
	font-weight: 750;
	cursor: pointer;
}
</style>
