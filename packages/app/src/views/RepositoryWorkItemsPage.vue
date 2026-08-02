<template>
	<ion-page>
		<page-header :back="repositoryBack" :title="isPulls ? 'Pull requests' : 'Issues'" />
		<ion-content :fullscreen="true">
			<main id="page-content" class="work-items-page page-frame page-frame--narrow">
				<repository-navigation :repo="repo" />
				<request-state
					:error="repositoryRequest.error.value"
					:loading="repositoryRequest.phase.value === 'loading'"
					noun="repository"
					@retry="repositoryRequest.retry" />
				<header v-if="repository">
					<p class="section-label">{{ repository.value.name || 'Repository' }}</p>
					<h1>{{ isPulls ? 'Pull requests' : 'Issues' }}</h1>
				</header>

				<form class="work-filters" @submit.prevent="applyFilters">
					<label
						><span>Status</span
						><select v-model="statusDraft">
							<option value="">All</option>
							<option value="open">Open</option>
							<option value="closed">Closed</option>
							<option v-if="isPulls" value="merged">Merged</option>
						</select></label
					>
					<label><span>Author DID</span><input v-model.trim="authorDraft" placeholder="did:plc:…" /></label>
					<button type="submit">Apply filters</button>
				</form>

				<request-state
					:empty="itemsRequest.phase.value === 'empty'"
					:empty-message="`No ${isPulls ? 'pull requests' : 'issues'} match these filters.`"
					:error="itemsRequest.error.value || moreError"
					:has-content="items.length > 0"
					:loading="itemsRequest.phase.value === 'loading'"
					:noun="isPulls ? 'pull requests' : 'issues'"
					@retry="moreError ? loadMore() : itemsRequest.retry()" />
				<ol v-if="items.length" class="work-list">
					<li v-for="item in items" :key="item.uri">
						<div class="work-list__state">{{ item.state }}</div>
						<div>
							<router-link :to="itemLink(item)">{{ item.title }}</router-link>
							<p>
								<code>{{ recordKey(item.uri) }}</code> opened by
								<router-link :to="links.profile(recordAuthor(item.uri))">{{ recordAuthor(item.uri) }}</router-link>
							</p>
						</div>
						<span>{{ item.commentCount }} comments</span>
					</li>
				</ol>
				<button v-if="cursor" class="load-more" :disabled="loadingMore" type="button" @click="loadMore">
					{{ loadingMore ? 'Loading…' : `Load more ${isPulls ? 'pull requests' : 'issues'}` }}
				</button>
			</main>
		</ion-content>
	</ion-page>
</template>

<script setup lang="ts">
import PageHeader from '@/components/PageHeader.vue'
import RequestState from '@/components/RequestState.vue'
import RepositoryNavigation from '@/features/repositories/RepositoryNavigation.vue'
import { recordAuthor, recordKey } from '@/features/collaboration/records'
import { useRepositoryRoute } from '@/features/repositories/useRepositoryRoute'
import { errorFromException } from '@/lib/api'
import type { BobbinError } from '@/lib/api'
import { useRouteRequest } from '@/lib/requests'
import { links } from '@/lib/router/links'
import { IonContent, IonPage } from '@ionic/vue'
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

interface WorkItem {
	commentCount: number
	state: string
	title: string
	uri: string
}

const { getClient, repo, repoDid, repository, repositoryRequest, route } = useRepositoryRoute()
const router = useRouter()
const isPulls = computed(() => route.name === 'pulls')
const status = computed(() => String(route.query[isPulls.value ? 'status' : 'state'] ?? ''))
const author = computed(() => String(route.query.author ?? ''))
const statusDraft = ref(status.value)
const authorDraft = ref(author.value)
watch([status, author], ([nextStatus, nextAuthor]) => {
	statusDraft.value = nextStatus
	authorDraft.value = nextAuthor
})
const repositoryBack = computed(() => router.resolve(links.repository(repo.value)).href)
const requestSource = computed(() => JSON.stringify([repoDid.value, isPulls.value, status.value, author.value]))
const itemsRequest = useRouteRequest(
	requestSource,
	async (_source, signal, attempt) => {
		if (!repoDid.value) return { items: [] as WorkItem[] }
		if (isPulls.value) {
			const page = await getClient().listPulls(repoDid.value, {
				signal,
				cache: attempt.cache,
				limit: 20,
				status: validPullStatus(status.value),
				author: validDid(author.value),
			})
			return { items: page.items.map((item) => mapItem(item)), cursor: page.cursor }
		}
		const page = await getClient().listIssues(repoDid.value, {
			signal,
			cache: attempt.cache,
			limit: 20,
			state: validIssueState(status.value),
			author: validDid(author.value),
		})
		return { items: page.items.map((item) => mapItem(item)), cursor: page.cursor }
	},
	{ isEmpty: (page) => page.items.length === 0 },
)
const items = ref<WorkItem[]>([])
const cursor = ref<string>()
const loadingMore = ref(false)
const moreError = ref<BobbinError>()
watch(itemsRequest.data, (page) => {
	items.value = [...(page?.items ?? [])]
	cursor.value = page?.cursor
	moreError.value = undefined
})

function applyFilters() {
	const filters = isPulls.value
		? { status: statusDraft.value || undefined, author: authorDraft.value || undefined }
		: { state: statusDraft.value || undefined, author: authorDraft.value || undefined }
	void router.replace(isPulls.value ? links.pulls(repo.value, filters) : links.issues(repo.value, filters))
}

async function loadMore() {
	const next = cursor.value
	if (!next || loadingMore.value || !repoDid.value) return
	loadingMore.value = true
	moreError.value = undefined
	try {
		const page = isPulls.value
			? await getClient().listPulls(repoDid.value, {
					cursor: next,
					limit: 20,
					status: validPullStatus(status.value),
					author: validDid(author.value),
				})
			: await getClient().listIssues(repoDid.value, {
					cursor: next,
					limit: 20,
					state: validIssueState(status.value),
					author: validDid(author.value),
				})
		const seen = new Set(items.value.map((item) => item.uri))
		items.value.push(...page.items.filter((item) => !seen.has(item.uri)).map((item) => mapItem(item)))
		cursor.value = page.cursor
	} catch (error) {
		moreError.value = errorFromException(error)
	} finally {
		loadingMore.value = false
	}
}

function mapItem(item: { commentCount: number; state: string; uri: string; value: { title: string } }): WorkItem {
	return { commentCount: item.commentCount, state: item.state, title: item.value.title, uri: item.uri }
}

function itemLink(item: WorkItem) {
	const authorDid = recordAuthor(item.uri)
	return isPulls.value
		? links.pull(repo.value, recordKey(item.uri), authorDid)
		: links.issue(repo.value, recordKey(item.uri), authorDid)
}

function validDid(value: string) {
	return (/^did:[a-z0-9]+:.+$/i.test(value) ? value : undefined) as `did:${string}:${string}` | undefined
}
function validIssueState(value: string) {
	return value === 'open' || value === 'closed' ? value : undefined
}
function validPullStatus(value: string) {
	return value === 'open' || value === 'closed' || value === 'merged' ? value : undefined
}
</script>

<style scoped>
.work-items-page {
	display: grid;
	gap: var(--space-6);
}
.work-items-page header h1 {
	margin: 0;
}
.work-filters {
	display: grid;
	grid-template-columns: minmax(8rem, 0.5fr) minmax(14rem, 1fr) auto;
	align-items: end;
	gap: var(--space-3);
}
.work-filters label {
	display: grid;
	gap: var(--space-2);
	color: var(--app-text-muted);
	font-size: var(--text-sm);
	font-weight: 700;
}
.work-filters input,
.work-filters select,
.work-filters button,
.load-more {
	min-block-size: 44px;
	border: 1px solid var(--app-border);
	border-radius: var(--radius-sm);
	padding-inline: var(--space-3);
	color: var(--app-text);
	background: var(--app-surface);
}
.work-filters button,
.load-more {
	border-color: var(--app-accent);
	color: var(--app-accent-contrast);
	background: var(--app-accent);
	font-weight: 700;
}
.work-list {
	display: grid;
	margin: 0;
	padding: 0;
	border: 1px solid var(--app-border);
	border-radius: var(--radius-md);
	background: var(--app-surface);
	list-style: none;
}
.work-list li {
	display: grid;
	grid-template-columns: auto minmax(0, 1fr) auto;
	gap: var(--space-4);
	align-items: start;
	padding: var(--space-4);
	border-block-end: 1px solid var(--app-border);
}
.work-list li:last-child {
	border-block-end: 0;
}
.work-list__state {
	border-radius: 999px;
	padding: var(--space-1) var(--space-3);
	color: var(--app-accent-contrast);
	background: var(--app-accent);
	font-size: var(--text-xs);
	font-weight: 800;
	text-transform: capitalize;
}
.work-list a {
	font-weight: 700;
	text-decoration: none;
}
.work-list p,
.work-list > li > span {
	margin: var(--space-2) 0 0;
	color: var(--app-text-muted);
	font-size: var(--text-sm);
}
.load-more {
	justify-self: start;
}
@media (max-width: 700px) {
	.work-filters,
	.work-list li {
		grid-template-columns: 1fr;
	}
}
</style>
