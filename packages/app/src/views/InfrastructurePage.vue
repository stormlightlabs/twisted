<template>
	<ion-page>
		<page-header back="/" title="Infrastructure" />
		<ion-content :fullscreen="true">
			<main id="page-content" class="infrastructure-page page-frame page-frame--narrow">
				<header>
					<p class="section-label">Public services</p>
					<h1>Knots & spindles</h1>
					<p>Find services owned by a Tangled account. Membership data is public and read-only here.</p>
				</header>
				<form class="owner-form" @submit.prevent="openOwner">
					<label for="owner-did">Owner DID</label>
					<div>
						<input
							id="owner-did"
							v-model.trim="ownerDraft"
							pattern="did:[a-z0-9]+:.+"
							placeholder="did:plc:…"
							required /><button type="submit">Browse services</button>
					</div>
				</form>
				<template v-if="owner">
					<nav class="owner-links" aria-label="Owner infrastructure">
						<router-link :to="links.profile(owner)">Open profile</router-link
						><router-link :to="links.publicKeys(owner)">Public keys</router-link>
					</nav>
					<coverage-notice :coverage="coverageRequest.data.value" />
					<freshness-notice />
					<div class="service-columns">
						<section aria-labelledby="knots-heading">
							<h2 id="knots-heading">Owned knots</h2>
							<request-state
								:empty="knotsRequest.phase.value === 'empty'"
								empty-message="No public knot records are indexed for this owner."
								:error="knotsRequest.error.value"
								:loading="knotsRequest.phase.value === 'loading'"
								noun="knots"
								@retry="knotsRequest.retry" />
							<ul v-if="knots.length">
								<li v-for="item in knots" :key="item.uri">
									<router-link :to="links.knot(recordKey(item.uri))">{{ recordKey(item.uri) }}</router-link
									><time :datetime="item.value.createdAt">{{ formatDate(item.value.createdAt) }}</time>
								</li>
							</ul>
							<request-state
								:error="knotPages.error.value"
								:has-content="true"
								noun="more knots"
								@retry="knotPages.loadMore" />
							<button
								v-if="knotPages.cursor.value"
								class="load-more"
								:disabled="knotPages.loading.value"
								type="button"
								@click="knotPages.loadMore">
								{{ knotPages.loading.value ? 'Loading…' : 'Load more knots' }}
							</button>
						</section>
						<section aria-labelledby="spindles-heading">
							<h2 id="spindles-heading">Owned spindles</h2>
							<request-state
								:empty="spindlesRequest.phase.value === 'empty'"
								empty-message="No public spindle records are indexed for this owner."
								:error="spindlesRequest.error.value"
								:loading="spindlesRequest.phase.value === 'loading'"
								noun="spindles"
								@retry="spindlesRequest.retry" />
							<ul v-if="spindles.length">
								<li v-for="item in spindles" :key="item.uri">
									<router-link :to="links.spindle(recordKey(item.uri), owner)">{{ recordKey(item.uri) }}</router-link
									><time :datetime="item.value.createdAt">{{ formatDate(item.value.createdAt) }}</time>
								</li>
							</ul>
							<request-state
								:error="spindlePages.error.value"
								:has-content="true"
								noun="more spindles"
								@retry="spindlePages.loadMore" />
							<button
								v-if="spindlePages.cursor.value"
								class="load-more"
								:disabled="spindlePages.loading.value"
								type="button"
								@click="spindlePages.loadMore">
								{{ spindlePages.loading.value ? 'Loading…' : 'Load more spindles' }}
							</button>
						</section>
					</div>
				</template>
			</main>
		</ion-content>
	</ion-page>
</template>

<script setup lang="ts">
import CoverageNotice from '@/components/CoverageNotice.vue'
import FreshnessNotice from '@/components/FreshnessNotice.vue'
import PageHeader from '@/components/PageHeader.vue'
import RequestState from '@/components/RequestState.vue'
import { parseAtUri } from '@/content'
import { useBobbinClientProvider } from '@/lib/api'
import { useCursorPagination, useRouteRequest } from '@/lib/requests'
import { links } from '@/lib/router/links'
import { IonContent, IonPage } from '@ionic/vue'
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()
const getClient = useBobbinClientProvider()
const owner = computed(() => String(route.query.owner ?? ''))
const ownerDraft = ref(owner.value)
watch(owner, (value) => (ownerDraft.value = value))
const knotsRequest = useRouteRequest(
	owner,
	(value, signal, attempt) =>
		value
			? getClient().listKnots(value as Parameters<ReturnType<typeof getClient>['listKnots']>[0], {
					signal,
					cache: attempt.cache,
					limit: 100,
				})
			: Promise.resolve({ items: [] }),
	{ isEmpty: (page) => page.items.length === 0 },
)
const spindlesRequest = useRouteRequest(
	owner,
	(value, signal, attempt) =>
		value
			? getClient().listSpindles(value as Parameters<ReturnType<typeof getClient>['listSpindles']>[0], {
					signal,
					cache: attempt.cache,
					limit: 100,
				})
			: Promise.resolve({ items: [] }),
	{ isEmpty: (page) => page.items.length === 0 },
)
const coverageRequest = useRouteRequest(owner, (_value, signal, attempt) =>
	getClient().getCoverage({ signal, cache: attempt.cache }),
)
const knotPages = useCursorPagination(
	owner,
	knotsRequest.data,
	(value, cursor, signal) =>
		getClient().listKnots(value as Parameters<ReturnType<typeof getClient>['listKnots']>[0], {
			cursor,
			signal,
			limit: 100,
		}),
	(item) => item.uri,
)
const spindlePages = useCursorPagination(
	owner,
	spindlesRequest.data,
	(value, cursor, signal) =>
		getClient().listSpindles(value as Parameters<ReturnType<typeof getClient>['listSpindles']>[0], {
			cursor,
			signal,
			limit: 100,
		}),
	(item) => item.uri,
)
const knots = knotPages.items
const spindles = spindlePages.items
function openOwner(): void {
	void router.push(links.infrastructureFor(ownerDraft.value))
}
function recordKey(uri: string): string {
	return parseAtUri(uri)?.rkey ?? uri
}
function formatDate(value: string): string {
	return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value))
}
</script>

<style scoped>
.infrastructure-page {
	display: grid;
	gap: var(--space-6);
}
header h1,
header p {
	margin: 0;
}
header h1 {
	font-size: clamp(var(--text-2xl), 5vw, 2.7rem);
}
header p:last-child {
	margin-block-start: var(--space-2);
	color: var(--app-text-muted);
}
.owner-form {
	display: grid;
	gap: var(--space-2);
}
.owner-form label {
	font-weight: 700;
}
.owner-form div {
	display: grid;
	grid-template-columns: minmax(0, 1fr) auto;
	gap: var(--space-2);
}
input,
button {
	min-block-size: 44px;
	border: 1px solid var(--app-border);
	border-radius: var(--radius-sm);
	padding-inline: var(--space-4);
}
input {
	color: var(--app-text);
	background: var(--app-surface);
}
button {
	color: var(--app-accent-contrast);
	background: var(--app-accent);
	font-weight: 750;
	cursor: pointer;
}
.owner-links {
	display: flex;
	flex-wrap: wrap;
	gap: var(--space-4);
}
.service-columns {
	display: grid;
	grid-template-columns: repeat(2, minmax(0, 1fr));
	gap: var(--space-8);
}
section h2 {
	margin-block-start: 0;
}
section ul {
	margin: 0;
	padding: 0;
	list-style: none;
}
section li {
	display: grid;
	gap: var(--space-1);
	border-block-start: 1px solid var(--app-border);
	padding-block: var(--space-4);
}
section time {
	color: var(--app-text-muted);
	font-size: var(--text-sm);
}
@media (max-width: 42rem) {
	.owner-form div,
	.service-columns {
		grid-template-columns: 1fr;
	}
}
</style>
