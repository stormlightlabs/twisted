<template>
	<ion-page>
		<page-header :back="repositoryBack" title="Source" />
		<ion-content :fullscreen="true">
			<main id="page-content" class="source-page page-frame">
				<repository-navigation :current-ref="currentRef" :repo="repo" />

				<request-state
					:error="repositoryRequest.error.value"
					:loading="repositoryRequest.phase.value === 'loading'"
					noun="repository"
					@retry="repositoryRequest.retry" />

				<template v-if="repository">
					<header class="source-page__header">
						<div>
							<p class="section-label">{{ repository.value.name || 'Repository' }}</p>
							<h1>{{ path ? fileName : 'Source' }}</h1>
						</div>
						<label class="ref-picker">
							<span>Branch or tag</span>
							<select :value="currentRef" @change="selectRef">
								<option v-if="currentRef" :value="currentRef">{{ currentRef }}</option>
								<optgroup v-if="branches.length" label="Branches">
									<option v-for="branch in branches" :key="`branch-${branch.name}`" :value="branch.name">
										{{ branch.name }}
									</option>
								</optgroup>
								<optgroup v-if="tags.length" label="Tags">
									<option v-for="tag in tags" :key="`tag-${tag.name}`" :value="tag.name">{{ tag.name }}</option>
								</optgroup>
							</select>
						</label>
					</header>

					<nav class="breadcrumbs" aria-label="Source path">
						<router-link :to="links.source(repo, currentRef)">Root</router-link>
						<template v-for="crumb in breadcrumbs" :key="crumb.path">
							<span aria-hidden="true">/</span>
							<router-link :to="links.source(repo, currentRef, crumb.path, crumb.isFile ? 'blob' : undefined)">
								{{ crumb.name }}
							</router-link>
						</template>
					</nav>

					<request-state
						:error="contentRequest.error.value"
						:loading="contentRequest.phase.value === 'loading'"
						noun="source"
						@retry="contentRequest.retry" />

					<section v-if="content?.kind === 'tree'" class="source-panel" aria-label="Directory contents">
						<ul v-if="content.data.files.length" class="tree-list">
							<li v-for="entry in sortedFiles" :key="entry.name">
								<span aria-hidden="true">{{ isDirectory(entry.mode) ? '↳' : '·' }}</span>
								<router-link
									:to="
										links.source(repo, currentRef, childPath(entry.name), isDirectory(entry.mode) ? undefined : 'blob')
									">
									{{ entry.name }}
								</router-link>
								<span>{{ isDirectory(entry.mode) ? 'Directory' : formatBytes(entry.size) }}</span>
							</li>
						</ul>
						<div v-else class="source-empty">
							<strong>This directory is empty</strong>
							<p>There are no files at this path and ref.</p>
						</div>
					</section>

					<section v-else-if="content?.kind === 'blob'" class="source-panel source-panel--blob">
						<header class="blob-toolbar">
							<div>
								<strong>{{ content.data.path }}</strong>
								<span v-if="content.data.size !== undefined">{{ formatBytes(content.data.size) }}</span>
							</div>
							<div>
								<button v-if="blobText.kind === 'text'" type="button" @click="wrapLines = !wrapLines">
									{{ wrapLines ? 'Don’t wrap lines' : 'Wrap lines' }}
								</button>
								<a :href="rawUrl" download>Download</a>
								<a :href="canonicalUrl" rel="noopener noreferrer" target="_blank">Open on Tangled</a>
							</div>
						</header>

						<div v-if="content.data.submodule" class="source-empty">
							<strong>{{ content.data.submodule.name }}</strong>
							<p>This path points to another repository.</p>
							<a v-if="submoduleUrl" :href="submoduleUrl" rel="noopener noreferrer" target="_blank">Open repository</a>
						</div>
						<highlighted-code
							v-else-if="blobText.kind === 'text'"
							:lines="blobText.lines"
							:path="content.data.path"
							:wrap="wrapLines" />
						<div v-else class="source-empty">
							<strong>{{ downloadMessage }}</strong>
							<p>Download the file to view it with an app on your device.</p>
						</div>
					</section>
				</template>
			</main>
		</ion-content>
	</ion-page>
</template>

<script setup lang="ts">
import PageHeader from '@/components/PageHeader.vue'
import RequestState from '@/components/RequestState.vue'
import { presentBlobText } from '@/features/repositories/blobText'
import HighlightedCode from '@/features/repositories/HighlightedCode.vue'
import RepositoryNavigation from '@/features/repositories/RepositoryNavigation.vue'
import { useRepositoryRoute } from '@/features/repositories/useRepositoryRoute'
import { useRouteRequest } from '@/lib/requests'
import { links } from '@/lib/router/links'
import { IonContent, IonPage } from '@ionic/vue'
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'

const { getClient, repo, repoDid, repository, repositoryLocation, repositoryRequest, route } = useRepositoryRoute()
const router = useRouter()
const path = computed(() => String(route.query.path ?? '').replace(/^\/+|\/+$/g, ''))
const requestedRef = computed(() => String(route.query.ref ?? ''))
const requestedView = computed(() => (route.query.view === 'blob' ? 'blob' : 'tree'))
const repositoryBack = computed(() => router.resolve(links.repository(repo.value)).href)
const defaultBranchRequest = useRouteRequest(repositoryLocation, (location, signal, attempt) =>
	location
		? getClient().getRepositoryDefaultBranch(location, { signal, cache: attempt.cache })
		: Promise.resolve(undefined),
)
const currentRef = computed(() => requestedRef.value || defaultBranchRequest.data.value?.name || 'HEAD')
const branchesRequest = useRouteRequest(repositoryLocation, (location, signal, attempt) =>
	location
		? getClient().listRepositoryBranches(location, { signal, cache: attempt.cache, limit: 99 })
		: Promise.resolve({ items: [] }),
)
const tagsRequest = useRouteRequest(repositoryLocation, (location, signal, attempt) =>
	location
		? getClient().listRepositoryTags(location, { signal, cache: attempt.cache, limit: 99 })
		: Promise.resolve({ items: [] }),
)
const branches = computed(() => branchesRequest.data.value?.items ?? [])
const tags = computed(() => tagsRequest.data.value?.items ?? [])
const contentSource = computed(() => ({
	location: repositoryLocation.value,
	path: path.value,
	ref: currentRef.value,
	view: requestedView.value,
}))
const contentRequest = useRouteRequest(contentSource, async (source, signal, attempt) => {
	if (!source.location) return undefined
	if (source.view === 'blob') {
		return {
			kind: 'blob' as const,
			data: await getClient().getRepositoryBlob(source.location, source.ref, source.path, {
				signal,
				cache: attempt.cache,
			}),
		}
	}
	const tree = await getClient().getRepositoryTree(
		source.location,
		{ path: source.path, ref: source.ref },
		{ signal, cache: attempt.cache },
	)
	if (source.path && tree.files.length === 0 && tree.parent === source.path) {
		return {
			kind: 'blob' as const,
			data: await getClient().getRepositoryBlob(source.location, source.ref, source.path, {
				signal,
				cache: attempt.cache,
			}),
		}
	}
	return { kind: 'tree' as const, data: tree }
})
const content = computed(() => contentRequest.data.value)
const sortedFiles = computed(() =>
	content.value?.kind === 'tree'
		? [...content.value.data.files].sort(
				(a, b) => Number(isDirectory(b.mode)) - Number(isDirectory(a.mode)) || a.name.localeCompare(b.name),
			)
		: [],
)
const blobText = computed(() =>
	content.value?.kind === 'blob'
		? presentBlobText(content.value.data)
		: { kind: 'download' as const, reason: 'unavailable' as const },
)
const wrapLines = ref(false)
const fileName = computed(() => path.value.split('/').at(-1) || 'Source')
const breadcrumbs = computed(() => {
	const parts = path.value.split('/').filter(Boolean)
	return parts.map((name, index) => ({
		name,
		path: parts.slice(0, index + 1).join('/'),
		isFile: index === parts.length - 1 && content.value?.kind === 'blob',
	}))
})
const rawUrl = computed(() =>
	repositoryLocation.value
		? getClient().repositoryBlobUrl(repositoryLocation.value, currentRef.value, path.value)
		: undefined,
)
const canonicalUrl = computed(() => {
	const url = new URL(`https://tangled.org/${repoDid.value}`)
	url.pathname += `/tree/${encodeURIComponent(currentRef.value)}/${path.value.split('/').map(encodeURIComponent).join('/')}`
	return url.href
})
const submoduleUrl = computed(() =>
	safeUrl(content.value?.kind === 'blob' ? content.value.data.submodule?.url : undefined),
)
const downloadMessage = computed(() =>
	blobText.value.kind === 'text'
		? ''
		: blobText.value.reason === 'binary'
			? 'This file cannot be shown as text'
			: blobText.value.reason === 'large'
				? 'This file is too large to display here'
				: 'A preview is not available',
)

function childPath(name: string) {
	return path.value ? `${path.value}/${name}` : name
}
function isDirectory(mode: string) {
	return mode === '040000' || mode === '40000' || mode.startsWith('04')
}
function formatBytes(bytes: number) {
	return bytes < 1024
		? `${bytes} B`
		: bytes < 1024 * 1024
			? `${(bytes / 1024).toFixed(1)} KB`
			: `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
function selectRef(event: Event) {
	const refValue = (event.target as HTMLSelectElement).value
	void router.replace(
		links.source(repo.value, refValue, path.value || undefined, requestedView.value === 'blob' ? 'blob' : undefined),
	)
}
function safeUrl(value: string | undefined) {
	if (!value) return undefined
	try {
		const url = new URL(value)
		return url.protocol === 'https:' ? url.href : undefined
	} catch {
		/* Invalid external URLs are omitted from source metadata. */
		return undefined
	}
}
</script>

<style scoped>
.source-page {
	display: grid;
	gap: var(--space-6);
}
.source-page__header {
	display: flex;
	align-items: end;
	justify-content: space-between;
	gap: var(--space-5);
}
.source-page__header h1 {
	margin: 0;
	overflow-wrap: anywhere;
}
.ref-picker {
	display: grid;
	gap: var(--space-2);
	color: var(--app-text-muted);
	font-size: var(--text-sm);
	font-weight: 700;
}
.ref-picker select {
	min-block-size: 44px;
	min-inline-size: min(18rem, 70vw);
	border: 1px solid var(--app-border);
	border-radius: var(--radius-sm);
	padding-inline: var(--space-3);
	color: var(--app-text);
	background: var(--app-surface);
}
.breadcrumbs {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: var(--space-2);
	min-block-size: 44px;
}
.breadcrumbs a {
	overflow-wrap: anywhere;
}
.source-panel {
	overflow: hidden;
	border: 1px solid var(--app-border);
	border-radius: var(--radius-md);
	background: var(--app-surface);
}
.tree-list {
	margin: 0;
	padding: 0;
	list-style: none;
}
.tree-list li {
	display: grid;
	grid-template-columns: auto minmax(0, 1fr) auto;
	align-items: center;
	gap: var(--space-3);
	min-block-size: 52px;
	border-block-end: 1px solid var(--app-border);
	padding: var(--space-2) var(--space-4);
}
.tree-list li:last-child {
	border-block-end: 0;
}
.tree-list li > span:last-child {
	color: var(--app-text-muted);
	font-size: var(--text-sm);
}
.blob-toolbar {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: var(--space-4);
	border-block-end: 1px solid var(--app-border);
	padding: var(--space-3) var(--space-4);
}
.blob-toolbar > div {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: var(--space-3);
}
.blob-toolbar span {
	color: var(--app-text-muted);
}
.blob-toolbar button,
.blob-toolbar a {
	min-block-size: 44px;
	padding: var(--space-3);
}
.blob-toolbar button {
	border: 1px solid var(--app-border);
	border-radius: var(--radius-sm);
	color: var(--app-text);
	background: transparent;
	cursor: pointer;
}
.source-empty {
	padding: var(--space-6);
}
.source-empty p {
	margin: var(--space-2) 0 var(--space-4);
	color: var(--app-text-muted);
}
@media (max-width: 640px) {
	.source-page__header,
	.blob-toolbar {
		align-items: stretch;
		flex-direction: column;
	}
	.ref-picker select {
		inline-size: 100%;
	}
	.tree-list li {
		grid-template-columns: auto minmax(0, 1fr);
	}
	.tree-list li > span:last-child {
		grid-column: 2;
	}
}
</style>
