<template>
	<ion-page>
		<page-header :back="repositoryBack" title="History" />
		<ion-content :fullscreen="true">
			<main id="page-content" class="history-page page-frame page-frame--narrow">
				<repository-navigation :current-ref="currentRef" :repo="repo" />
				<request-state
					:error="repositoryRequest.error.value"
					:loading="repositoryRequest.phase.value === 'loading'"
					noun="repository"
					@retry="repositoryRequest.retry" />
				<header v-if="repository">
					<p class="section-label">{{ repository.value.name || 'Repository' }}</p>
					<h1>Commit history</h1>
				</header>

				<form class="history-filters" @submit.prevent="applyPath">
					<label
						><span>Branch or tag</span
						><select :value="currentRef" @change="selectRef">
							<option v-if="currentRef" :value="currentRef">{{ currentRef }}</option>
							<optgroup v-if="branches.length" label="Branches">
								<option v-for="branch in branches" :key="branch.name" :value="branch.name">{{ branch.name }}</option>
							</optgroup>
							<optgroup v-if="tags.length" label="Tags">
								<option v-for="tag in tags" :key="tag.name" :value="tag.name">{{ tag.name }}</option>
							</optgroup>
						</select></label
					>
					<label><span>Path (optional)</span><input v-model="pathDraft" placeholder="src/main.ts" /></label>
					<button type="submit">Show history</button>
				</form>

				<section v-if="updates.length" class="ref-updates" aria-labelledby="updates-heading">
					<h2 id="updates-heading">Recent ref updates</h2>
					<ul>
						<li v-for="update in updates" :key="update.uri">
							<router-link :to="links.source(repo, update.value.ref)">{{ update.value.ref }}</router-link>
							<code>{{ update.value.newSha.slice(0, 10) }}</code>
							<router-link :to="links.profile(update.value.committerDid)">{{ update.value.committerDid }}</router-link>
						</li>
					</ul>
				</section>

				<request-state
					:empty="logRequest.phase.value === 'empty'"
					empty-message="No commits were found for this ref and path."
					:error="logRequest.error.value || moreError"
					:has-content="commits.length > 0"
					:loading="logRequest.phase.value === 'loading'"
					noun="commits"
					@retry="retry" />
				<ol v-if="commits.length" class="commit-list">
					<li v-for="commit in commits" :key="commit.hash">
						<router-link class="commit-list__message" :to="links.commit(repo, commit.hash)">{{
							firstLine(commit.message) || 'Commit without a message'
						}}</router-link>
						<div>
							<span v-if="commit.author">{{ commit.author.name }}</span>
							<time v-if="commit.author?.when" :datetime="commit.author.when">{{
								formatDate(commit.author.when)
							}}</time>
							<router-link :to="links.commit(repo, commit.hash)"
								><code>{{ commit.hash.slice(0, 10) }}</code></router-link
							>
							<router-link :to="links.diff(repo, commit.hash)">Changes</router-link>
						</div>
					</li>
				</ol>
				<button v-if="cursor" class="load-more" :disabled="loadingMore" type="button" @click="loadMore">
					{{ loadingMore ? 'Loading…' : 'Load more commits' }}
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
import type { BobbinError, RepositoryCommit } from '@/lib/api'
import { errorFromException } from '@/lib/api'
import { useRouteRequest } from '@/lib/requests'
import { links } from '@/lib/router/links'
import { IonContent, IonPage } from '@ionic/vue'
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

const { getClient, repo, repoDid, repoUri, repository, repositoryRequest, route } = useRepositoryRoute()
const router = useRouter()
const requestedRef = computed(() => String(route.query.ref ?? ''))
const path = computed(() => String(route.query.path ?? '').replace(/^\/+|\/+$/g, ''))
const pathDraft = ref(path.value)
watch(path, (value) => {
	pathDraft.value = value
})
const repositoryBack = computed(() => router.resolve(links.repository(repo.value)).href)
const defaultBranchRequest = useRouteRequest(repoUri, (uri, signal, attempt) =>
	uri ? getClient().getRepositoryDefaultBranch(uri, { signal, cache: attempt.cache }) : Promise.resolve(undefined),
)
const currentRef = computed(() => requestedRef.value || defaultBranchRequest.data.value?.name || 'HEAD')
const branchesRequest = useRouteRequest(repoUri, (uri, signal, attempt) =>
	uri
		? getClient().listRepositoryBranches(uri, { signal, cache: attempt.cache, limit: 99 })
		: Promise.resolve({ items: [] }),
)
const tagsRequest = useRouteRequest(repoUri, (uri, signal, attempt) =>
	uri
		? getClient().listRepositoryTags(uri, { signal, cache: attempt.cache, limit: 99 })
		: Promise.resolve({ items: [] }),
)
const updatesRequest = useRouteRequest(repoDid, (did, signal, attempt) =>
	did ? getClient().listRepositoryRefUpdates(did, { signal, cache: attempt.cache }) : Promise.resolve([]),
)
const branches = computed(() => branchesRequest.data.value?.items ?? [])
const tags = computed(() => tagsRequest.data.value?.items ?? [])
const updates = computed(() => updatesRequest.data.value ?? [])
const logSource = computed(() => ({ uri: repoUri.value, ref: currentRef.value, path: path.value }))
const logRequest = useRouteRequest(
	logSource,
	({ uri, ref: selectedRef, path: selectedPath }, signal, attempt) =>
		uri
			? getClient().getRepositoryLog(uri, {
					ref: selectedRef,
					path: selectedPath,
					signal,
					cache: attempt.cache,
					limit: 20,
				})
			: Promise.resolve({ items: [], ref: selectedRef }),
	{ isEmpty: (page) => page.items.length === 0 },
)
const commits = ref<RepositoryCommit[]>([])
const cursor = ref<string>()
const loadingMore = ref(false)
const moreError = ref<BobbinError>()
const consumedCursors = new Set<string>()
watch(
	logRequest.data,
	(page) => {
		commits.value = [...(page?.items ?? [])]
		cursor.value = page?.cursor
		moreError.value = undefined
		consumedCursors.clear()
	},
	{ immediate: true },
)

function selectRef(event: Event) {
	void router.replace(links.commits(repo.value, (event.target as HTMLSelectElement).value, path.value || undefined))
}
function applyPath() {
	void router.replace(links.commits(repo.value, currentRef.value, pathDraft.value.trim() || undefined))
}
async function loadMore() {
	const next = cursor.value
	if (!next || loadingMore.value || consumedCursors.has(next) || !repoUri.value) return
	loadingMore.value = true
	moreError.value = undefined
	try {
		const page = await getClient().getRepositoryLog(repoUri.value, {
			ref: currentRef.value,
			path: path.value,
			cursor: next,
			limit: 20,
		})
		consumedCursors.add(next)
		const seen = new Set(commits.value.map((commit) => commit.hash))
		commits.value.push(...page.items.filter((commit) => !seen.has(commit.hash)))
		cursor.value = page.cursor
	} catch (error) {
		moreError.value = errorFromException(error)
	} finally {
		loadingMore.value = false
	}
}

function retry() {
	if (moreError.value) void loadMore()
	else logRequest.retry()
}

const firstLine = (message: string) => message.split('\n')[0]

function formatDate(value: string) {
	return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}
</script>

<style scoped>
.history-page {
	display: grid;
	gap: var(--space-6);
}
.history-page header h1 {
	margin: 0;
}
.history-filters {
	display: grid;
	grid-template-columns: repeat(2, minmax(0, 1fr)) auto;
	align-items: end;
	gap: var(--space-3);
}
.history-filters label {
	display: grid;
	gap: var(--space-2);
	color: var(--app-text-muted);
	font-size: var(--text-sm);
	font-weight: 700;
}
.history-filters select,
.history-filters input,
.history-filters button,
.load-more {
	min-block-size: 44px;
	border: 1px solid var(--app-border);
	border-radius: var(--radius-sm);
	padding-inline: var(--space-3);
	color: var(--app-text);
	background: var(--app-surface);
}
.history-filters button,
.load-more {
	border-color: var(--app-accent);
	color: var(--app-accent-contrast);
	background: var(--app-accent);
	font-weight: 700;
	cursor: pointer;
}
.ref-updates {
	display: grid;
	gap: var(--space-3);
}
.ref-updates h2 {
	margin: 0;
	font-size: var(--text-lg);
}
.ref-updates ul {
	display: flex;
	gap: var(--space-3);
	overflow-x: auto;
	margin: 0;
	padding: 0 0 var(--space-2);
	list-style: none;
}
.ref-updates li {
	display: grid;
	flex: 0 0 min(22rem, 85vw);
	gap: var(--space-2);
	border: 1px solid var(--app-border);
	border-radius: var(--radius-sm);
	padding: var(--space-4);
	background: var(--app-surface);
}
.commit-list {
	display: grid;
	margin: 0;
	padding: 0;
	border: 1px solid var(--app-border);
	border-radius: var(--radius-md);
	background: var(--app-surface);
	list-style: none;
}
.commit-list li {
	display: grid;
	gap: var(--space-3);
	border-block-end: 1px solid var(--app-border);
	padding: var(--space-4);
}
.commit-list li:last-child {
	border-block-end: 0;
}
.commit-list__message {
	color: var(--app-text);
	font-weight: 700;
	text-decoration: none;
}
.commit-list li > div {
	display: flex;
	flex-wrap: wrap;
	gap: var(--space-3);
	color: var(--app-text-muted);
	font-size: var(--text-sm);
}
.load-more {
	justify-self: start;
}
.load-more:disabled {
	opacity: 0.65;
	cursor: wait;
}
@media (max-width: 700px) {
	.history-filters {
		grid-template-columns: 1fr;
	}
}
</style>
