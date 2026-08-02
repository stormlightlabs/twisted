<template>
	<ion-page>
		<page-header :back="repositoryBack" :title="title" />
		<ion-content :fullscreen="true">
			<main id="page-content" class="refs-page page-frame page-frame--narrow">
				<repository-navigation :repo="repo" />
				<request-state
					:error="repositoryRequest.error.value"
					:loading="repositoryRequest.phase.value === 'loading'"
					noun="repository"
					@retry="repositoryRequest.retry" />
				<header v-if="repository">
					<p class="section-label">{{ repository.value.name || 'Repository' }}</p>
					<h1>{{ title }}</h1>
					<p>{{ description }}</p>
				</header>
				<request-state
					:empty="pageRequest.phase.value === 'empty'"
					:empty-message="emptyMessage"
					:error="pageRequest.error.value || moreError"
					:has-content="items.length > 0"
					:loading="pageRequest.phase.value === 'loading'"
					:noun="kind"
					@retry="retry" />
				<ul v-if="items.length" class="ref-list">
					<li v-for="item in items" :key="`${item.name}-${item.hash}`">
						<div>
							<router-link :to="links.source(repo, item.name)"
								><strong>{{ item.name }}</strong></router-link
							>
							<span v-if="'isDefault' in item && item.isDefault">Default branch</span>
						</div>
						<p v-if="item.message">{{ firstLine(item.message) }}</p>
						<div class="ref-list__meta">
							<code>{{ item.hash.slice(0, 10) }}</code>
							<span v-if="refAuthor(item)">{{ refAuthor(item)?.name }}</span>
							<time v-if="refWhen(item)" :datetime="refWhen(item)">
								{{ formatDate(refWhen(item)) }}
							</time>
							<router-link :to="links.commits(repo, item.name)">History</router-link>
							<router-link :to="links.compare(repo, defaultRef, item.name)">Compare</router-link>
						</div>
					</li>
				</ul>
				<button v-if="cursor" class="load-more" :disabled="loadingMore" type="button" @click="loadMore">
					{{ loadingMore ? 'Loading…' : `Load more ${kind}` }}
				</button>
			</main>
		</ion-content>
	</ion-page>
</template>

<script setup lang="ts">
import PageHeader from '@/components/PageHeader.vue'
import RequestState from '@/components/RequestState.vue'
import RepositoryNavigation from '@/features/repositories/RepositoryNavigation.vue'
import { useRepositoryRoute } from '@/features/repositories/useRepositoryRoute'
import type { BobbinError, RepositoryBranch, RepositoryTag } from '@/lib/api'
import { errorFromException } from '@/lib/api'
import { useRouteRequest } from '@/lib/requests'
import { links } from '@/lib/router/links'
import { IonContent, IonPage } from '@ionic/vue'
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

const { getClient, repo, repository, repositoryLocation, repositoryRequest, route } = useRepositoryRoute()
const router = useRouter()
const isBranches = computed(() => route.name === 'repository-branches')
const kind = computed(() => (isBranches.value ? 'branches' : 'tags'))
const title = computed(() => (isBranches.value ? 'Branches' : 'Tags'))
const description = computed(() =>
	isBranches.value
		? 'Choose a branch to browse its files or history.'
		: 'Open a named point in this repository’s history.',
)
const emptyMessage = computed(() =>
	isBranches.value ? 'This repository does not have any branches yet.' : 'This repository does not have any tags yet.',
)
const repositoryBack = computed(() => router.resolve(links.repository(repo.value)).href)
const defaultRef = computed(
	() => items.value.find((item): item is RepositoryBranch => 'isDefault' in item && item.isDefault)?.name ?? 'HEAD',
)
const source = computed(() => ({ location: repositoryLocation.value, kind: kind.value }))
const pageRequest = useRouteRequest(
	source,
	async ({ location, kind: currentKind }, signal, attempt) => {
		if (!location) return { items: [] as (RepositoryBranch | RepositoryTag)[], cursor: undefined }
		return currentKind === 'branches'
			? getClient().listRepositoryBranches(location, { signal, cache: attempt.cache, limit: 20 })
			: getClient().listRepositoryTags(location, { signal, cache: attempt.cache, limit: 20 })
	},
	{ isEmpty: (page) => page.items.length === 0 },
)
const items = ref<(RepositoryBranch | RepositoryTag)[]>([])
const cursor = ref<string>()
const loadingMore = ref(false)
const moreError = ref<BobbinError>()
const consumedCursors = new Set<string>()

watch(
	pageRequest.data,
	(page) => {
		items.value = [...(page?.items ?? [])]
		cursor.value = page?.cursor
		moreError.value = undefined
		consumedCursors.clear()
	},
	{ immediate: true },
)

async function loadMore() {
	const next = cursor.value
	if (!next || loadingMore.value || consumedCursors.has(next) || !repositoryLocation.value) return
	loadingMore.value = true
	moreError.value = undefined
	try {
		const page = isBranches.value
			? await getClient().listRepositoryBranches(repositoryLocation.value, { cursor: next, limit: 20 })
			: await getClient().listRepositoryTags(repositoryLocation.value, { cursor: next, limit: 20 })
		consumedCursors.add(next)
		const seen = new Set(items.value.map((item) => `${item.name}:${item.hash}`))
		items.value.push(...page.items.filter((item) => !seen.has(`${item.name}:${item.hash}`)))
		cursor.value = page.cursor
	} catch (error) {
		moreError.value = errorFromException(error)
	} finally {
		loadingMore.value = false
	}
}

function retry() {
	if (moreError.value) void loadMore()
	else pageRequest.retry()
}
function firstLine(message: string) {
	return message.split('\n')[0]
}
function refAuthor(item: RepositoryBranch | RepositoryTag) {
	return 'isDefault' in item ? item.author : item.tagger
}
function refWhen(item: RepositoryBranch | RepositoryTag) {
	return 'isDefault' in item ? item.when : item.tagger?.when
}
function formatDate(value: string | undefined) {
	return value ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value)) : ''
}
</script>

<style scoped>
.refs-page {
	display: grid;
	gap: var(--space-6);
}
.refs-page header h1,
.refs-page header p {
	margin: 0;
}
.refs-page header > p:last-child {
	margin-block-start: var(--space-2);
	color: var(--app-text-muted);
}
.ref-list {
	display: grid;
	gap: var(--space-3);
	margin: 0;
	padding: 0;
	list-style: none;
}
.ref-list li {
	display: grid;
	gap: var(--space-3);
	border: 1px solid var(--app-border);
	border-radius: var(--radius-md);
	padding: var(--space-5);
	background: var(--app-surface);
}
.ref-list li > div:first-child,
.ref-list__meta {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: var(--space-3);
}
.ref-list li > div:first-child span {
	border-radius: 999px;
	padding: var(--space-1) var(--space-3);
	color: var(--app-accent-contrast);
	background: var(--app-accent);
	font-size: var(--text-xs);
	font-weight: 700;
}
.ref-list p {
	margin: 0;
}
.ref-list__meta {
	color: var(--app-text-muted);
	font-size: var(--text-sm);
}
.load-more {
	min-block-size: 44px;
	justify-self: start;
	border: 1px solid var(--app-accent);
	border-radius: var(--radius-sm);
	padding-inline: var(--space-5);
	color: var(--app-accent-contrast);
	background: var(--app-accent);
	font-weight: 700;
	cursor: pointer;
}
.load-more:disabled {
	opacity: 0.65;
	cursor: wait;
}
</style>
