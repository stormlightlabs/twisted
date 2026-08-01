<template>
	<ion-page>
		<page-header title="Search" />
		<ion-content :fullscreen="true">
			<main id="page-content" class="search-page page-frame page-frame--narrow">
				<header class="search-page__heading">
					<p class="section-label">Explore Tangled</p>
					<h1>Find public work</h1>
					<p>Search by topic, person, repository, or paste a public Tangled link.</p>
				</header>

				<form class="search-form" role="search" @submit.prevent="submit">
					<label for="search-query">What are you looking for?</label>
					<div class="search-form__query">
						<input
							id="search-query"
							v-model="form.q"
							autocapitalize="off"
							autocomplete="off"
							placeholder="A topic, handle, repository, or link"
							spellcheck="false" />
						<button type="submit">Search</button>
					</div>

					<details class="search-form__filters" :open="hasFilters">
						<summary>Refine results</summary>
						<div>
							<label>Type <input v-model="form.nsid" placeholder="sh.tangled.repo" /></label>
							<label>Author DID <input v-model="form.author" placeholder="did:plc:…" /></label>
							<label>Repository DID <input v-model="form.repo" placeholder="did:plc:…" /></label>
							<label>From <input v-model="form.since" type="date" /></label>
							<label>Until <input v-model="form.until" type="date" /></label>
						</div>
					</details>
					<p v-if="filterError" class="search-form__error" role="alert">{{ filterError }}</p>
				</form>

				<coverage-notice :coverage="coverageRequest.data.value" />
				<request-state
					:error="searchRequest.error.value"
					:has-content="searchRequest.hasContent.value"
					:loading="searchRequest.phase.value === 'loading'"
					:retry-in-ms="searchRequest.retryInMs.value"
					noun="results"
					@retry="searchRequest.retry" />

				<section v-if="searched && searchRequest.phase.value === 'empty'" class="search-empty">
					<h2>No matches yet</h2>
					<p>Try fewer words, remove a filter, or check the identifier you entered.</p>
				</section>

				<section v-if="allHits.length" aria-labelledby="results-heading" class="search-results">
					<div class="search-results__heading">
						<h2 id="results-heading">Results</h2>
						<span>{{ allHits.length }} shown</span>
					</div>
					<ol>
						<li v-for="hit in allHits" :key="hit.uri">
							<router-link v-if="resultLink(hit.uri)" :to="resultLink(hit.uri)!">
								<span>{{ collectionName(hit.nsid) }}</span>
								<strong>{{ recordTitle(hit.value, collectionName(hit.nsid)) }}</strong>
								<p v-if="recordExcerpt(hit.value)">{{ recordExcerpt(hit.value) }}</p>
								<code>{{ hit.uri }}</code>
							</router-link>
							<div v-else>
								<span>{{ collectionName(hit.nsid) }}</span>
								<strong>{{ recordTitle(hit.value, collectionName(hit.nsid)) }}</strong>
								<p v-if="recordExcerpt(hit.value)">{{ recordExcerpt(hit.value) }}</p>
								<code>{{ hit.uri }}</code>
							</div>
						</li>
					</ol>

					<request-state
						:error="nextError"
						:has-content="true"
						:loading="loadingNext"
						noun="more results"
						@retry="loadNext" />
					<button v-if="nextCursor && !loadingNext" class="search-results__more" type="button" @click="loadNext">
						Show more
					</button>
				</section>
			</main>
		</ion-content>
	</ion-page>
</template>

<script setup lang="ts">
import type { BobbinError, SearchParams, ValidatedSearchHit } from '@/lib/api'
import { errorFromException, useBobbinClientProvider } from '@/lib/api'
import CoverageNotice from '@/components/CoverageNotice.vue'
import PageHeader from '@/components/PageHeader.vue'
import RequestState from '@/components/RequestState.vue'
import { localRecordLink } from '@/content/links'
import { classifyIdentifier } from '@/features/discovery/identifiers'
import { collectionName, recordExcerpt, recordTitle, searchableRecordSchemas } from '@/features/discovery/records'
import { useRouteRequest } from '@/lib/requests'
import { links } from '@/lib/router/links'
import { IonContent, IonPage } from '@ionic/vue'
import { computed, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

interface SearchForm {
	q: string
	nsid: string
	author: string
	repo: string
	since: string
	until: string
}

interface DisplayHit extends Omit<ValidatedSearchHit<Record<string, unknown>>, 'value'> {
	value: Record<string, unknown>
}

interface SearchData {
	items: DisplayHit[]
	cursor?: string
}

const route = useRoute()
const router = useRouter()
const getClient = useBobbinClientProvider()
const form = reactive<SearchForm>({ q: '', nsid: '', author: '', repo: '', since: '', until: '' })
const filterError = ref('')
const appended = ref<DisplayHit[]>([])
const nextCursor = ref<string>()
const requestedCursors = new Set<string>()
const loadingNext = ref(false)
const nextError = ref<BobbinError>()

const searchKey = computed(() => JSON.stringify(normalizedRouteQuery()))
const searched = computed(() => normalizedRouteQuery().q.length > 0)
const hasFilters = computed(() => Boolean(form.nsid || form.author || form.repo || form.since || form.until))
const allHits = computed(() => [...(searchRequest.data.value?.items ?? []), ...appended.value])

const coverageRequest = useRouteRequest(
	() => getClient().service,
	(_service, signal, attempt) => getClient().getCoverage({ signal, cache: attempt.cache }),
)

const searchRequest = useRouteRequest(
	searchKey,
	async (_key, signal, attempt): Promise<SearchData> => {
		appended.value = []
		nextCursor.value = undefined
		nextError.value = undefined
		requestedCursors.clear()
		const query = normalizedRouteQuery()
		if (!query.q) return { items: [] }

		const direct = classifyIdentifier(query.q)
		if (!hasSearchFilters(query)) {
			const destination = await directDestination(direct, signal)
			if (destination) {
				await router.replace(destination)
				return { items: [] }
			}
		}

		const page = await getClient().search(toSearchParams(query), searchableRecordSchemas, {
			signal,
			cache: attempt.cache,
		})
		nextCursor.value = page.cursor
		return { items: page.items as DisplayHit[], cursor: page.cursor }
	},
	{ isEmpty: (data) => data.items.length === 0 },
)

watch(
	() => route.query,
	() => Object.assign(form, normalizedRouteQuery()),
	{ immediate: true },
)

function normalizedRouteQuery(): SearchForm {
	const value = (key: keyof SearchForm) => (typeof route.query[key] === 'string' ? route.query[key].trim() : '')
	return {
		q: value('q'),
		nsid: value('nsid'),
		author: value('author'),
		repo: value('repo'),
		since: value('since'),
		until: value('until'),
	}
}

function submit(): void {
	filterError.value = validateFilters(form)
	if (filterError.value) return
	const query = Object.fromEntries(
		Object.entries(form)
			.map(([key, value]) => [key, value.trim()])
			.filter(([, value]) => value),
	)
	void router.replace({ name: 'search', query })
}

function validateFilters(value: SearchForm): string {
	if (!value.q.trim()) return 'Enter a word, handle, identifier, or link.'
	if (value.nsid && !/^[a-z][a-z0-9]*(?:\.[a-z][a-z0-9-]*)+$/.test(value.nsid)) return 'Enter a complete record type.'
	if (value.author && !/^did:[a-z0-9]+:[^\s/]+$/i.test(value.author)) return 'The author must be a complete DID.'
	if (value.repo && !/^did:[a-z0-9]+:[^\s/]+$/i.test(value.repo)) return 'The repository must be a complete DID.'
	if (value.since && value.until && value.since > value.until) return 'The start date must be before the end date.'
	return ''
}

function hasSearchFilters(value: SearchForm): boolean {
	return Boolean(value.nsid || value.author || value.repo || value.since || value.until)
}

function toSearchParams(value: SearchForm, cursor?: string): SearchParams {
	return {
		q: value.q,
		limit: 25,
		cursor,
		nsid: (value.nsid || undefined) as SearchParams['nsid'],
		author: (value.author || undefined) as SearchParams['author'],
		repo: (value.repo || undefined) as SearchParams['repo'],
		since: value.since ? new Date(`${value.since}T00:00:00.000Z`).toISOString() : undefined,
		until: value.until ? new Date(`${value.until}T23:59:59.999Z`).toISOString() : undefined,
	}
}

async function directDestination(input: ReturnType<typeof classifyIdentifier>, signal: AbortSignal) {
	if (input.kind === 'actor') return links.profile(input.actor)
	if (input.kind === 'at-uri') return localRecordLink(input.uri)
	if (input.kind === 'did') {
		try {
			await getClient().resolveIdentity(input.did as Parameters<ReturnType<typeof getClient>['resolveIdentity']>[0], {
				signal,
			})
			return links.profile(input.did)
		} catch (identityError) {
			try {
				const repo = await getClient().getRepoByRepoDid(
					input.did as Parameters<ReturnType<typeof getClient>['getRepoByRepoDid']>[0],
					{ signal },
				)
				return links.repository(repo.uri)
			} catch {
				throw identityError
			}
		}
	}
	if (input.kind === 'repo-url') {
		const identity = await getClient().resolveIdentity(
			input.owner as Parameters<ReturnType<typeof getClient>['resolveIdentity']>[0],
			{ signal },
		)
		const page = await getClient().search(
			{ q: input.repo, nsid: 'sh.tangled.repo', author: identity.did, limit: 25 },
			{ 'sh.tangled.repo': searchableRecordSchemas['sh.tangled.repo'] },
			{ signal },
		)
		const exact = page.items.find((hit) => hit.value.name?.toLowerCase() === input.repo.toLowerCase())
		return exact ? links.repository(exact.uri) : undefined
	}
	return undefined
}

async function loadNext(): Promise<void> {
	const cursor = nextCursor.value
	if (!cursor || requestedCursors.has(cursor) || loadingNext.value) return
	requestedCursors.add(cursor)
	loadingNext.value = true
	nextError.value = undefined
	try {
		const page = await getClient().search(toSearchParams(normalizedRouteQuery(), cursor), searchableRecordSchemas)
		appended.value.push(...(page.items as DisplayHit[]))
		nextCursor.value = page.cursor
	} catch (error) {
		requestedCursors.delete(cursor)
		nextError.value = errorFromException(error)
	} finally {
		loadingNext.value = false
	}
}

function resultLink(uri: string) {
	return localRecordLink(uri)
}
</script>

<style scoped>
.search-page {
	display: grid;
	gap: var(--space-6);
}
.search-page__heading h1 {
	margin: 0;
	font-family: var(--font-display);
	font-size: clamp(2.75rem, 8vw, 5rem);
	letter-spacing: -0.055em;
}
.search-page__heading > p:last-child {
	max-inline-size: 40rem;
	color: var(--app-text-muted);
	font-size: var(--text-lg);
	line-height: 1.6;
}
.search-form {
	display: grid;
	gap: var(--space-3);
}
.search-form > label,
.search-form__filters label {
	font-size: var(--text-sm);
	font-weight: 700;
}
.search-form__query {
	display: flex;
	gap: var(--space-3);
}
.search-form input {
	inline-size: 100%;
	min-block-size: 3rem;
	border: 1px solid var(--app-border);
	border-radius: var(--radius-sm);
	padding-inline: var(--space-4);
	color: var(--app-text);
	background: var(--app-surface);
}
.search-form button,
.search-results__more {
	min-block-size: 44px;
	border: 0;
	border-radius: var(--radius-sm);
	padding-inline: var(--space-5);
	color: var(--app-accent-contrast);
	background: var(--app-accent);
	font-weight: 750;
	cursor: pointer;
}
.search-form__filters {
	border-block-start: 1px solid var(--app-border);
	padding-block-start: var(--space-3);
}
.search-form__filters summary {
	min-block-size: 44px;
	color: var(--app-accent);
	cursor: pointer;
}
.search-form__filters > div {
	display: grid;
	grid-template-columns: repeat(2, minmax(0, 1fr));
	gap: var(--space-4);
}
.search-form__filters label {
	display: grid;
	gap: var(--space-2);
}
.search-form__error {
	margin: 0;
	color: var(--app-danger);
}
.search-empty {
	border-inline-start: 3px solid var(--app-accent);
	padding-inline-start: var(--space-5);
}
.search-empty h2,
.search-empty p {
	margin: 0;
}
.search-empty p {
	margin-block-start: var(--space-2);
	color: var(--app-text-muted);
}
.search-results__heading {
	display: flex;
	align-items: baseline;
	justify-content: space-between;
	border-block-end: 1px solid var(--app-border);
}
.search-results__heading h2 {
	font-size: var(--text-2xl);
}
.search-results__heading span {
	color: var(--app-text-muted);
}
.search-results ol {
	display: grid;
	gap: var(--space-3);
	margin: var(--space-4) 0;
	padding: 0;
	list-style: none;
}
.search-results li > a,
.search-results li > div {
	display: grid;
	gap: var(--space-2);
	border: 1px solid var(--app-border);
	border-radius: var(--radius-md);
	padding: var(--space-5);
	color: var(--app-text);
	background: var(--app-surface);
	text-decoration: none;
}
.search-results li span {
	color: var(--app-accent);
	font-family: var(--font-mono);
	font-size: var(--text-xs);
	font-weight: 700;
	text-transform: uppercase;
}
.search-results li strong {
	font-size: var(--text-lg);
}
.search-results li p {
	display: -webkit-box;
	margin: 0;
	color: var(--app-text-muted);
	line-height: 1.5;
	overflow: hidden;
	-webkit-box-orient: vertical;
	-webkit-line-clamp: 3;
}
.search-results li code {
	color: var(--app-text-muted);
	font-size: var(--text-xs);
	overflow-wrap: anywhere;
}
@media (max-width: 600px) {
	.search-form__query {
		flex-direction: column;
	}
	.search-form__filters > div {
		grid-template-columns: 1fr;
	}
}
</style>
