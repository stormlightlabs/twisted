<template>
	<ion-page>
		<page-header title="Repositories" />
		<ion-content :fullscreen="true">
			<main id="page-content" class="repositories-page page-frame page-frame--narrow">
				<header>
					<div>
						<p class="section-label">Public code</p>
						<h1>Repositories</h1>
					</div>
					<p>Browse repositories by owner, or paste a repository’s complete AT-URI to open it directly.</p>
				</header>

				<form role="search" @submit.prevent="browse">
					<label for="repository-owner">Owner handle, DID, or repository AT-URI</label>
					<div>
						<input
							id="repository-owner"
							v-model.trim="queryDraft"
							autocomplete="off"
							placeholder="desertthunder.dev"
							required
							spellcheck="false" />
						<button type="submit">Browse</button>
					</div>
				</form>

				<template v-if="owner">
					<div v-if="identity" class="repositories-page__owner">
						<div>
							<span>Repositories owned by</span>
							<strong>{{ identity.handle === 'handle.invalid' ? identity.did : `@${identity.handle}` }}</strong>
						</div>
						<router-link :to="links.profile(identity.did)">View profile</router-link>
					</div>
					<request-state
						:empty="request.phase.value === 'empty'"
						empty-message="This owner has no public repositories."
						:error="request.error.value"
						:loading="request.phase.value === 'loading'"
						:retry-in-ms="request.retryInMs.value"
						noun="repositories"
						@retry="request.retry" />
					<div v-if="repositories.length" class="repository-list">
						<repository-card v-for="repository in repositories" :key="repository.uri" :repository="repository" />
					</div>
					<request-state
						:error="repositoryPages.error.value"
						:has-content="true"
						noun="more repositories"
						@retry="repositoryPages.loadMore" />
					<button
						v-if="repositoryPages.cursor.value"
						class="load-more"
						:disabled="repositoryPages.loading.value"
						type="button"
						@click="repositoryPages.loadMore">
						{{ repositoryPages.loading.value ? 'Loading…' : 'Load more repositories' }}
					</button>
				</template>
			</main>
		</ion-content>
	</ion-page>
</template>

<script setup lang="ts">
import PageHeader from '@/components/PageHeader.vue'
import RequestState from '@/components/RequestState.vue'
import RepositoryCard from '@/features/profiles/RepositoryCard.vue'
import { useBobbinClientProvider } from '@/lib/api'
import { useCursorPagination, useRouteRequest } from '@/lib/requests'
import { links } from '@/lib/router/links'
import { IonContent, IonPage } from '@ionic/vue'
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()
const getClient = useBobbinClientProvider()
const owner = computed(() => (typeof route.query.owner === 'string' ? route.query.owner.trim() : ''))
const queryDraft = ref(owner.value)
watch(owner, (value) => (queryDraft.value = value))

const request = useRouteRequest(
	owner,
	async (identifier, signal, attempt) => {
		if (!identifier) return undefined
		const identity = await getClient().resolveIdentity(
			identifier as Parameters<ReturnType<typeof getClient>['resolveIdentity']>[0],
			{ signal, cache: attempt.cache },
		)
		const repositories = await getClient().listPdsRepos(identity.did, identity.pds, {
			signal,
			cache: attempt.cache,
			limit: 30,
		})
		return { identity, repositories }
	},
	{ isEmpty: (result) => result !== undefined && result.repositories.items.length === 0 },
)
const identity = computed(() => request.data.value?.identity)
const firstPage = computed(() => request.data.value?.repositories)
const repositoryPages = useCursorPagination(
	owner,
	firstPage,
	async (identifier, cursor, signal) => {
		const currentIdentity =
			identity.value ??
			(await getClient().resolveIdentity(identifier as Parameters<ReturnType<typeof getClient>['resolveIdentity']>[0], {
				signal,
			}))
		return getClient().listPdsRepos(currentIdentity.did, currentIdentity.pds, { cursor, signal, limit: 30 })
	},
	(item) => item.uri,
)
const repositories = repositoryPages.items

function browse(): void {
	const value = queryDraft.value.trim()
	if (value.startsWith('at://')) {
		void router.push(links.repository(value))
		return
	}
	void router.push(links.repositoriesFor(value))
}
</script>

<style scoped>
.repositories-page {
	display: grid;
	align-content: start;
	gap: var(--space-6);
}
.repositories-page > header {
	display: grid;
	grid-template-columns: minmax(12rem, 0.7fr) minmax(20rem, 1.3fr);
	align-items: end;
	gap: var(--space-6);
	border-block-end: 1px solid var(--app-border);
	padding-block-end: var(--space-5);
}
.repositories-page h1,
.repositories-page header p {
	margin: 0;
}
.repositories-page h1 {
	font-size: clamp(var(--text-2xl), 4vw, 2.5rem);
	line-height: 1.1;
}
.repositories-page header > p {
	color: var(--app-text-muted);
	line-height: 1.5;
}
.repositories-page form {
	display: grid;
	gap: var(--space-2);
}
.repositories-page form label {
	font-size: var(--text-sm);
	font-weight: 700;
}
.repositories-page form > div {
	display: grid;
	grid-template-columns: minmax(0, 1fr) auto;
}
.repositories-page input,
.repositories-page form button {
	min-block-size: 44px;
	border: 1px solid var(--app-border);
	border-radius: 0;
	padding-inline: var(--space-4);
}
.repositories-page input {
	border-start-start-radius: var(--radius-sm);
	border-end-start-radius: var(--radius-sm);
	color: var(--app-text);
	background: var(--app-surface);
}
.repositories-page form button {
	border-inline-start: 0;
	border-start-end-radius: var(--radius-sm);
	border-end-end-radius: var(--radius-sm);
	color: var(--app-accent-contrast);
	background: var(--app-accent);
	font-weight: 750;
	cursor: pointer;
}
.repositories-page__owner {
	display: flex;
	align-items: end;
	justify-content: space-between;
	gap: var(--space-4);
}
.repositories-page__owner > div {
	display: grid;
	gap: var(--space-1);
}
.repositories-page__owner span {
	color: var(--app-text-muted);
	font-size: var(--text-sm);
}
.repositories-page__owner strong {
	font-size: var(--text-xl);
}
.repository-list {
	display: grid;
	border-block-start: 1px solid var(--app-border);
}
@media (max-width: 42rem) {
	.repositories-page > header {
		grid-template-columns: 1fr;
		gap: var(--space-2);
	}
}
@media (max-width: 30rem) {
	.repositories-page form > div {
		grid-template-columns: 1fr;
		gap: var(--space-2);
	}
	.repositories-page input,
	.repositories-page form button {
		border: 1px solid var(--app-border);
		border-radius: var(--radius-sm);
	}
	.repositories-page__owner {
		align-items: start;
		flex-direction: column;
	}
}
</style>
