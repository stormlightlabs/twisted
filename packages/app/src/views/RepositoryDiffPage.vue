<template>
	<ion-page>
		<page-header :back="repositoryBack" :title="isCompare ? 'Compare' : 'Changes'" />
		<ion-content :fullscreen="true">
			<main id="page-content" class="diff-page page-frame">
				<repository-navigation :current-ref="head || singleRef" :repo="repo" />
				<request-state
					:error="repositoryRequest.error.value"
					:loading="repositoryRequest.phase.value === 'loading'"
					noun="repository"
					@retry="repositoryRequest.retry" />

				<header v-if="repository" class="diff-page__header">
					<div>
						<p class="section-label">{{ repository.value.name || 'Repository' }}</p>
						<h1>{{ isCompare ? 'Compare revisions' : 'Changes in this revision' }}</h1>
						<p v-if="isCompare && base && head">
							Changes needed to move from <code>{{ base }}</code> to <code>{{ head }}</code
							>.
						</p>
						<p v-else-if="singleRef">
							Changes introduced by <code>{{ singleRef }}</code
							>.
						</p>
					</div>
				</header>

				<form v-if="isCompare" class="compare-form" @submit.prevent="compare">
					<label>
						<span>Base</span>
						<input v-model="baseDraft" list="repository-refs" placeholder="main or a commit hash" required />
					</label>
					<button class="swap-button" type="button" aria-label="Swap base and head" @click="swap">⇄</button>
					<label>
						<span>Head</span>
						<input v-model="headDraft" list="repository-refs" placeholder="feature branch or a commit hash" required />
					</label>
					<button type="submit">Compare</button>
					<datalist id="repository-refs">
						<option v-for="option in refOptions" :key="option" :value="option" />
					</datalist>
				</form>

				<request-state
					:empty="patchRequest.phase.value === 'empty'"
					empty-message="These revisions do not have any changes to show."
					:error="patchRequest.error.value"
					:loading="patchRequest.phase.value === 'loading'"
					noun="changes"
					@retry="patchRequest.retry" />

				<section v-if="patch?.kind === 'too-large'" class="large-patch" aria-labelledby="large-patch-heading">
					<h2 id="large-patch-heading">This patch is too large to display safely</h2>
					<p>
						Open the repository on Tangled to continue<span v-if="patch.bytes"> ({{ formatBytes(patch.bytes) }})</span>.
					</p>
					<a v-if="canonicalUrl" class="primary-action" :href="canonicalUrl" rel="noopener noreferrer" target="_blank"
						>Open repository on Tangled</a
					>
				</section>
				<patch-viewer v-else-if="patch?.kind === 'patch' && patch.text" :patch="patch.text" />
			</main>
		</ion-content>
	</ion-page>
</template>

<script setup lang="ts">
import PageHeader from '@/components/PageHeader.vue'
import RequestState from '@/components/RequestState.vue'
import PatchViewer from '@/features/repositories/PatchViewer.vue'
import RepositoryNavigation from '@/features/repositories/RepositoryNavigation.vue'
import { useRepositoryRoute } from '@/features/repositories/useRepositoryRoute'
import type { RepositoryPatch } from '@/lib/api'
import { useRouteRequest } from '@/lib/requests'
import { links } from '@/lib/router/links'
import { IonContent, IonPage } from '@ionic/vue'
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

const { getClient, repo, repoDid, repository, repositoryLocation, repositoryRequest, route } = useRepositoryRoute()
const router = useRouter()
const isCompare = computed(() => route.name === 'repository-compare')
const singleRef = computed(() => String(route.params.ref ?? ''))
const base = computed(() => String(route.query.base ?? ''))
const head = computed(() => String(route.query.head ?? ''))
const baseDraft = ref(base.value)
const headDraft = ref(head.value)
watch([base, head], ([nextBase, nextHead]) => {
	baseDraft.value = nextBase
	headDraft.value = nextHead
})
const repositoryBack = computed(() => router.resolve(links.repository(repo.value)).href)

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
const refOptions = computed(() => [
	...(branchesRequest.data.value?.items.map((item) => item.name) ?? []),
	...(tagsRequest.data.value?.items.map((item) => item.name) ?? []),
])

const patchSource = computed(() => ({
	location: repositoryLocation.value,
	compare: isCompare.value,
	base: base.value,
	head: head.value,
	ref: singleRef.value,
}))
const patchRequest = useRouteRequest(
	patchSource,
	(source, signal, attempt): Promise<RepositoryPatch | undefined> => {
		if (!source.location) return Promise.resolve(undefined)
		if (source.compare) {
			if (!source.base || !source.head) return Promise.resolve(undefined)
			return getClient().getRepositoryCompare(source.location, source.base, source.head, {
				signal,
				cache: attempt.cache,
			})
		}
		if (!source.ref) return Promise.resolve(undefined)
		return getClient().getRepositoryDiff(source.location, source.ref, { signal, cache: attempt.cache })
	},
	{ isEmpty: (value) => value === undefined || (value.kind === 'patch' && value.text.trim().length === 0) },
)
const patch = computed(() => patchRequest.data.value)
const canonicalUrl = computed(() => (repoDid.value ? `https://tangled.org/${repoDid.value}` : ''))

function compare() {
	const nextBase = baseDraft.value.trim()
	const nextHead = headDraft.value.trim()
	if (nextBase && nextHead) void router.replace(links.compare(repo.value, nextBase, nextHead))
}

function swap() {
	const previousBase = baseDraft.value
	baseDraft.value = headDraft.value
	headDraft.value = previousBase
	compare()
}

function formatBytes(bytes: number) {
	return new Intl.NumberFormat(undefined, { style: 'unit', unit: 'kilobyte', maximumFractionDigits: 0 }).format(
		bytes / 1024,
	)
}
</script>

<style scoped>
.diff-page {
	display: grid;
	gap: var(--space-6);
}

.diff-page__header {
	display: flex;
	align-items: end;
	justify-content: space-between;
	gap: var(--space-5);
}

.diff-page__header h1,
.diff-page__header p,
.large-patch h2,
.large-patch p {
	margin: 0;
}

.diff-page__header div > p:last-child {
	margin-block-start: var(--space-2);
	color: var(--app-text-muted);
}

.compare-form {
	display: grid;
	grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr) auto;
	align-items: end;
	gap: var(--space-3);
	border: 1px solid var(--app-border);
	border-radius: var(--radius-md);
	padding: var(--space-4);
	background: var(--app-surface);
}

.compare-form label {
	display: grid;
	gap: var(--space-2);
	color: var(--app-text-muted);
	font-size: var(--text-sm);
	font-weight: 700;
}

.compare-form input,
.compare-form button,
.primary-action {
	min-block-size: 44px;
	border: 1px solid var(--app-border);
	border-radius: var(--radius-sm);
	padding-inline: var(--space-4);
	color: var(--app-text);
	background: var(--app-background);
}

.compare-form button,
.primary-action {
	border-color: var(--app-accent);
	color: var(--app-accent-contrast);
	background: var(--app-accent);
	font-weight: 800;
	cursor: pointer;
}

.compare-form .swap-button {
	inline-size: 44px;
	padding: 0;
	border-color: var(--app-border);
	color: var(--app-text);
	background: transparent;
	font-size: var(--text-lg);
}

.primary-action {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	text-decoration: none;
}

.large-patch {
	display: grid;
	justify-items: start;
	gap: var(--space-3);
	border: 1px solid var(--app-warning);
	border-radius: var(--radius-md);
	padding: var(--space-6);
	background: var(--app-surface);
}

.large-patch p {
	color: var(--app-text-muted);
}

@media (max-width: 760px) {
	.diff-page__header {
		align-items: start;
		flex-direction: column;
	}
	.compare-form {
		grid-template-columns: 1fr;
	}
	.compare-form label {
		grid-column: auto;
	}
	.compare-form .swap-button {
		justify-self: start;
	}
	.compare-form button[type='submit'] {
		grid-column: auto;
	}
}
</style>
