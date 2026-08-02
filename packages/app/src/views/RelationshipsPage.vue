<template>
	<ion-page>
		<page-header :back="back" title="Relationships" />
		<ion-content :fullscreen="true">
			<main id="page-content" class="relationships-page page-frame page-frame--narrow">
				<request-state
					:error="subjectRequest.error.value"
					:loading="subjectRequest.phase.value === 'loading'"
					noun="relationship subject"
					@retry="subjectRequest.retry" />
				<header>
					<p class="section-label">{{ isRepository ? 'Repository relationships' : 'Actor relationships' }}</p>
					<h1>{{ heading }}</h1>
					<p v-if="countRequest.data.value">
						{{ countRequest.data.value.count }} records from {{ countRequest.data.value.distinctAuthors }} distinct
						authors
					</p>
				</header>

				<nav class="relationship-tabs" aria-label="Relationship type">
					<router-link v-for="definition in definitions" :key="definition.kind" :to="relationshipLink(definition.kind)">
						{{ definition.label }}
					</router-link>
				</nav>

				<p class="direction-note">{{ description }}</p>
				<request-state
					:empty="listRequest.phase.value === 'empty'"
					empty-message="No public relationship records are indexed in this direction."
					:error="listRequest.error.value || countRequest.error.value || moreError"
					:has-content="items.length > 0"
					:loading="listRequest.phase.value === 'loading'"
					noun="relationships"
					@retry="moreError ? loadMore() : listRequest.retry()" />
				<ul v-if="items.length" class="relationship-list">
					<li v-for="item in items" :key="item.key">
						<span>{{ item.label }}</span>
						<router-link :to="links.profile(item.actor)">{{ item.actor }}</router-link>
						<span aria-hidden="true">→</span>
						<router-link v-if="item.targetKind === 'actor'" :to="links.profile(item.target)">{{
							item.target
						}}</router-link>
						<router-link v-else-if="item.targetKind === 'repo'" :to="links.search(item.target)">{{
							item.target
						}}</router-link>
						<code v-else>{{ item.target }}</code>
					</li>
				</ul>
				<button v-if="cursor" class="load-more" :disabled="loadingMore" type="button" @click="loadMore">
					{{ loadingMore ? 'Loading…' : 'Load more relationships' }}
				</button>
			</main>
		</ion-content>
	</ion-page>
</template>

<script setup lang="ts">
import PageHeader from '@/components/PageHeader.vue'
import RequestState from '@/components/RequestState.vue'
import { parseAtUri } from '@/content'
import { errorFromException, useBobbinClientProvider } from '@/lib/api'
import type { ActorActivityItem, BobbinError, CursorPage } from '@/lib/api'
import { useRouteRequest } from '@/lib/requests'
import { links } from '@/lib/router/links'
import { IonContent, IonPage } from '@ionic/vue'
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

type RelationshipKind = 'collaborators' | 'followers' | 'follows' | 'stars' | 'vouched-by' | 'vouches'
interface RelationshipItem {
	actor: string
	key: string
	label: string
	target: string
	targetKind: 'actor' | 'repo' | 'record'
}

const route = useRoute()
const router = useRouter()
const getClient = useBobbinClientProvider()
const isRepository = computed(() => route.name === 'repository-relationships')
const identifier = computed(() => String(isRepository.value ? route.params.repo : (route.params.actor ?? '')))
const definitions = computed(() =>
	isRepository.value
		? [
				{ kind: 'stars' as const, label: 'Stars' },
				{ kind: 'collaborators' as const, label: 'Collaborators' },
			]
		: [
				{ kind: 'follows' as const, label: 'Following' },
				{ kind: 'followers' as const, label: 'Followers' },
				{ kind: 'vouches' as const, label: 'Vouches written' },
				{ kind: 'vouched-by' as const, label: 'Vouches received' },
				{ kind: 'stars' as const, label: 'Stars given' },
			],
)
const requestedKind = computed(() => String(route.params.relationship ?? ''))
const kind = computed<RelationshipKind>(() => {
	const allowed = definitions.value.map((item) => item.kind)
	return allowed.includes(requestedKind.value as RelationshipKind)
		? (requestedKind.value as RelationshipKind)
		: allowed[0]
})
const subjectRequest = useRouteRequest(identifier, async (value, signal, attempt) => {
	if (isRepository.value) {
		const repository = await getClient().getRepo(value as Parameters<ReturnType<typeof getClient>['getRepo']>[0], {
			signal,
			cache: attempt.cache,
		})
		return { did: repository.value.repoDid, label: repository.value.name || 'Repository' }
	}
	const identity = await getClient().resolveIdentity(
		value as Parameters<ReturnType<typeof getClient>['resolveIdentity']>[0],
		{ signal, cache: attempt.cache },
	)
	return { did: identity.did, label: identity.handle === 'handle.invalid' ? identity.did : `@${identity.handle}` }
})
const subjectDid = computed(() => subjectRequest.data.value?.did ?? '')
const heading = computed(() => subjectRequest.data.value?.label ?? 'Public relationships')
const back = computed(
	() => router.resolve(isRepository.value ? links.repository(identifier.value) : links.profile(identifier.value)).href,
)
const description = computed(() => {
	if (kind.value === 'followers' || kind.value === 'vouched-by') return 'Inbound records authored by other people.'
	if (kind.value === 'collaborators')
		return 'Repository access records link the person granted access and the person who granted it.'
	if (isRepository.value) return 'Inbound records authored by people who starred this repository.'
	return 'Actor-authored records link this person to the public subject.'
})
const listSource = computed(() => JSON.stringify([subjectDid.value, kind.value]))
const listRequest = useRouteRequest(
	listSource,
	async (_source, signal, attempt) => {
		if (!subjectDid.value) return { items: [] as RelationshipItem[] }
		return loadPage(undefined, signal, attempt.cache)
	},
	{ isEmpty: (page) => page.items.length === 0 },
)
const countRequest = useRouteRequest(listSource, async (_source, signal, attempt) => {
	if (!subjectDid.value) return undefined
	const options = { signal, cache: attempt.cache }
	const did = subjectDid.value as `did:${string}:${string}`
	switch (kind.value) {
		case 'followers':
			return getClient().countFollows(did, options)
		case 'vouched-by':
			return getClient().countVouches(did, options)
		case 'collaborators':
			return getClient().countCollaborators(did, options)
		case 'stars':
			return isRepository.value
				? getClient().countStars(did, options)
				: getClient().countAuthoredRelationships('stars', did, options)
		case 'follows':
			return getClient().countAuthoredRelationships('follows', did, options)
		case 'vouches':
			return getClient().countAuthoredRelationships('vouches', did, options)
	}
})
const items = ref<RelationshipItem[]>([])
const cursor = ref<string>()
const loadingMore = ref(false)
const moreError = ref<BobbinError>()
watch(listRequest.data, (page) => {
	items.value = [...(page?.items ?? [])]
	cursor.value = page?.cursor
	moreError.value = undefined
})

async function loadPage(
	cursorValue?: string,
	signal?: AbortSignal,
	cache?: 'default' | 'reload',
): Promise<CursorPage<RelationshipItem>> {
	const options = { cursor: cursorValue, limit: 25, signal, cache }
	const did = subjectDid.value as `did:${string}:${string}`
	if (kind.value === 'followers')
		return mapInbound(await getClient().listFollows(did, options), 'follows', did, 'actor')
	if (kind.value === 'vouched-by')
		return mapInbound(await getClient().listVouches(did, options), 'vouches for', did, 'actor')
	if (kind.value === 'collaborators') {
		const page = await getClient().listRepositoryCollaborators(did, options)
		return {
			items: page.items.map((item, index) => ({
				key: item.uri ?? `${item.subject}:${index}`,
				actor: item.addedBy,
				label: 'granted access to',
				target: item.subject,
				targetKind: 'actor',
			})),
			cursor: page.cursor,
		}
	}
	if (kind.value === 'stars' && isRepository.value)
		return mapInbound(await getClient().listStars(did, options), 'starred', did, 'repo')
	const authoredKind = kind.value as 'follows' | 'stars' | 'vouches'
	const page = await getClient().listActorActivity(authoredKind, did, options)
	return { items: page.items.map((item, index) => mapAuthored(item, index, authoredKind, did)), cursor: page.cursor }
}

function mapInbound(
	page: CursorPage<{ uri: string }>,
	label: string,
	target: string,
	targetKind: RelationshipItem['targetKind'],
): CursorPage<RelationshipItem> {
	return {
		items: page.items.map((item) => ({
			key: item.uri,
			actor: parseAtUri(item.uri)?.authority ?? 'Unknown actor',
			label,
			target,
			targetKind,
		})),
		cursor: page.cursor,
	}
}

function mapAuthored(
	item: ActorActivityItem,
	index: number,
	relationship: 'follows' | 'stars' | 'vouches',
	did: string,
): RelationshipItem {
	const uri = item.uri ?? `${relationship}:${index}`
	const subject = item.value.subject
	let target = typeof subject === 'string' ? subject : ''
	let targetKind: RelationshipItem['targetKind'] = 'record'
	if (relationship === 'follows') targetKind = 'actor'
	if (relationship === 'stars' && typeof subject === 'object' && subject !== null) {
		const record = subject as Record<string, unknown>
		target = typeof record.did === 'string' ? record.did : typeof record.uri === 'string' ? record.uri : ''
		targetKind = typeof record.did === 'string' ? 'repo' : 'record'
	}
	if (relationship === 'vouches' && !target) {
		const rkey = parseAtUri(uri)?.rkey
		target = rkey?.startsWith('did:') ? rkey : uri
		targetKind = rkey?.startsWith('did:') ? 'actor' : 'record'
	}
	return {
		key: uri,
		actor: did,
		label: relationship === 'follows' ? 'follows' : relationship === 'stars' ? 'starred' : 'vouched for',
		target,
		targetKind,
	}
}

async function loadMore() {
	const next = cursor.value
	if (!next || loadingMore.value) return
	loadingMore.value = true
	moreError.value = undefined
	try {
		const page = await loadPage(next)
		const seen = new Set(items.value.map((item) => item.key))
		items.value.push(...page.items.filter((item) => !seen.has(item.key)))
		cursor.value = page.cursor
	} catch (error) {
		moreError.value = errorFromException(error)
	} finally {
		loadingMore.value = false
	}
}

function relationshipLink(value: RelationshipKind) {
	return isRepository.value
		? links.repositoryRelationships(identifier.value, value)
		: links.actorRelationships(identifier.value, value)
}
</script>

<style scoped>
.relationships-page {
	display: grid;
	gap: var(--space-6);
}
.relationships-page header h1,
.relationships-page header p {
	margin-block: var(--space-2);
}
.relationship-tabs {
	display: flex;
	gap: var(--space-2);
	overflow-x: auto;
}
.relationship-tabs a {
	flex: 0 0 auto;
	min-block-size: 44px;
	border: 1px solid var(--app-border);
	border-radius: var(--radius-sm);
	padding: var(--space-3) var(--space-4);
	text-decoration: none;
}
.relationship-tabs a.router-link-active {
	border-color: var(--app-accent);
	background: var(--app-surface-raised);
}
.direction-note {
	margin: 0;
	color: var(--app-text-muted);
}
.relationship-list {
	display: grid;
	gap: var(--space-3);
	margin: 0;
	padding: 0;
	list-style: none;
}
.relationship-list li {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: var(--space-3);
	border: 1px solid var(--app-border);
	border-radius: var(--radius-sm);
	padding: var(--space-4);
	background: var(--app-surface);
}
.relationship-list li > span:first-child {
	color: var(--app-text-muted);
}
.load-more {
	justify-self: start;
	min-block-size: 44px;
	border: 1px solid var(--app-accent);
	border-radius: var(--radius-sm);
	padding-inline: var(--space-4);
	color: var(--app-accent-contrast);
	background: var(--app-accent);
	font-weight: 700;
}
</style>
