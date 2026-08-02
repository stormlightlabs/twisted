<template>
	<ion-page
		><page-header back="/infrastructure" title="Knot" /><ion-content :fullscreen="true"
			><main id="page-content" class="service-page page-frame page-frame--narrow">
				<header>
					<p class="section-label">Public knot</p>
					<h1>{{ knot }}</h1>
					<copyable-identifier :value="knot" noun="knot identifier" />
				</header>
				<coverage-notice :coverage="coverageRequest.data.value" /><freshness-notice />
				<div class="service-summary">
					<section aria-labelledby="owner-heading">
						<h2 id="owner-heading">Owner</h2>
						<request-state
							:error="ownerRequest.error.value"
							:loading="ownerRequest.phase.value === 'loading'"
							noun="knot owner"
							@retry="ownerRequest.retry" /><template v-if="ownerRequest.data.value"
							><router-link :to="links.profile(ownerRequest.data.value.owner)">{{
								ownerRequest.data.value.owner
							}}</router-link
							><copyable-identifier :value="ownerRequest.data.value.owner" noun="owner DID"
						/></template>
					</section>
					<section aria-labelledby="version-heading">
						<h2 id="version-heading">Version</h2>
						<request-state
							:error="versionRequest.error.value"
							:loading="versionRequest.phase.value === 'loading'"
							noun="knot version"
							@retry="versionRequest.retry" /><template v-if="versionRequest.data.value"
							><copyable-identifier :value="versionRequest.data.value.version" noun="version" />
							<ul v-if="versionRequest.data.value.capabilities?.length" aria-label="Capabilities">
								<li v-for="capability in versionRequest.data.value.capabilities" :key="capability">{{ capability }}</li>
							</ul>
							<p v-else>No protocol capabilities were reported; this may be a legacy knot.</p></template
						>
					</section>
				</div>
				<section aria-labelledby="members-heading">
					<h2 id="members-heading">Members</h2>
					<request-state
						:empty="membersRequest.phase.value === 'empty'"
						empty-message="No public members are indexed for this knot."
						:error="membersRequest.error.value"
						:loading="membersRequest.phase.value === 'loading'"
						noun="knot members"
						@retry="membersRequest.retry" />
					<ol v-if="members.length" class="member-list">
						<li v-for="member in members" :key="member.uri ?? `${member.subject}:${member.createdAt}`">
							<div>
								<router-link :to="links.profile(member.subject)">{{ member.subject }}</router-link
								><time :datetime="member.createdAt">{{ formatDate(member.createdAt) }}</time>
							</div>
							<span
								>Added by <router-link :to="links.profile(member.addedBy)">{{ member.addedBy }}</router-link></span
							>
						</li>
					</ol>
					<request-state
						:error="memberPages.error.value"
						:has-content="true"
						noun="more knot members"
						@retry="memberPages.loadMore" />
					<button
						v-if="memberPages.cursor.value"
						class="load-more"
						:disabled="memberPages.loading.value"
						type="button"
						@click="memberPages.loadMore">
						{{ memberPages.loading.value ? 'Loading…' : 'Load more members' }}
					</button>
				</section>
				<section aria-labelledby="keys-heading">
					<h2 id="keys-heading">Service keys</h2>
					<request-state
						:empty="keysRequest.phase.value === 'empty'"
						empty-message="This knot did not return public service keys."
						:error="keysRequest.error.value"
						:loading="keysRequest.phase.value === 'loading'"
						noun="service keys"
						@retry="keysRequest.retry" />
					<ul v-if="keys.length" class="key-list">
						<li v-for="key in keys" :key="`${key.did}:${key.createdAt}`">
							<div>
								<router-link :to="links.profile(key.did)">{{ key.did }}</router-link
								><time :datetime="key.createdAt">{{ formatDate(key.createdAt) }}</time>
							</div>
							<copyable-identifier :value="key.key" noun="service key" />
						</li>
					</ul>
					<request-state
						:error="keyPages.error.value"
						:has-content="true"
						noun="more service keys"
						@retry="keyPages.loadMore" />
					<button
						v-if="keyPages.cursor.value"
						class="load-more"
						:disabled="keyPages.loading.value"
						type="button"
						@click="keyPages.loadMore">
						{{ keyPages.loading.value ? 'Loading…' : 'Load more keys' }}
					</button>
				</section>
			</main></ion-content
		></ion-page
	>
</template>

<script setup lang="ts">
import CopyableIdentifier from '@/components/CopyableIdentifier.vue'
import CoverageNotice from '@/components/CoverageNotice.vue'
import FreshnessNotice from '@/components/FreshnessNotice.vue'
import PageHeader from '@/components/PageHeader.vue'
import RequestState from '@/components/RequestState.vue'
import { useBobbinClientProvider } from '@/lib/api'
import { useCursorPagination, useRouteRequest } from '@/lib/requests'
import { links } from '@/lib/router/links'
import { IonContent, IonPage } from '@ionic/vue'
import { computed } from 'vue'
import { useRoute } from 'vue-router'
const route = useRoute()
const getClient = useBobbinClientProvider()
const knot = computed(() => String(route.params.knot ?? ''))
const ownerRequest = useRouteRequest(knot, (value, signal, attempt) =>
	getClient().getKnotOwner(value, { signal, cache: attempt.cache }),
)
const versionRequest = useRouteRequest(knot, (value, signal, attempt) =>
	getClient().getKnotVersion(value, { signal, cache: attempt.cache }),
)
const membersRequest = useRouteRequest(
	knot,
	(value, signal, attempt) => getClient().listKnotMembers(value, { signal, cache: attempt.cache, limit: 100 }),
	{ isEmpty: (page) => page.items.length === 0 },
)
const keysRequest = useRouteRequest(
	knot,
	(value, signal, attempt) => getClient().listKnotKeys(value, { limit: 100 }, { signal, cache: attempt.cache }),
	{ isEmpty: (page) => page.keys.length === 0 },
)
const coverageRequest = useRouteRequest(knot, (_value, signal, attempt) =>
	getClient().getCoverage({ signal, cache: attempt.cache }),
)
const memberPages = useCursorPagination(
	knot,
	membersRequest.data,
	(value, cursor, signal) => getClient().listKnotMembers(value, { cursor, signal, limit: 100 }),
	(item) => item.uri ?? `${item.subject}:${item.createdAt}`,
)
const firstKeyPage = computed(() => {
	const page = keysRequest.data.value
	return page ? { items: [...page.keys], cursor: page.cursor } : undefined
})
const keyPages = useCursorPagination(
	knot,
	firstKeyPage,
	async (value, cursor, signal) => {
		const page = await getClient().listKnotKeys(value, { cursor, limit: 100 }, { signal })
		return { items: [...page.keys], cursor: page.cursor }
	},
	(item) => `${item.did}:${item.createdAt}:${item.key}`,
)
const members = memberPages.items
const keys = keyPages.items
function formatDate(value: string): string {
	return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}
</script>

<style scoped>
.service-page {
	display: grid;
	gap: var(--space-8);
}
header {
	display: grid;
	gap: var(--space-3);
}
header h1,
header p {
	margin: 0;
}
header h1 {
	font-size: clamp(var(--text-2xl), 5vw, 2.7rem);
	overflow-wrap: anywhere;
}
.service-summary {
	display: grid;
	grid-template-columns: repeat(2, minmax(0, 1fr));
	gap: var(--space-8);
}
section {
	display: grid;
	align-content: start;
	gap: var(--space-4);
}
section h2 {
	margin: 0;
}
section > p {
	margin: 0;
	color: var(--app-text-muted);
}
.service-summary section {
	border-block-start: 1px solid var(--app-border);
	padding-block-start: var(--space-5);
}
.service-summary ul {
	display: flex;
	flex-wrap: wrap;
	gap: var(--space-2);
	margin: 0;
	padding: 0;
	list-style: none;
}
.service-summary li {
	border-radius: 999px;
	padding: var(--space-1) var(--space-3);
	background: var(--app-surface-raised);
}
.member-list,
.key-list {
	margin: 0;
	padding: 0;
	list-style: none;
}
.member-list li,
.key-list li {
	display: grid;
	gap: var(--space-2);
	border-block-start: 1px solid var(--app-border);
	padding-block: var(--space-4);
}
.member-list li > div,
.key-list li > div {
	display: flex;
	justify-content: space-between;
	gap: var(--space-4);
}
time,
.member-list span {
	color: var(--app-text-muted);
}
@media (max-width: 42rem) {
	.service-summary {
		grid-template-columns: 1fr;
	}
	.member-list li > div,
	.key-list li > div {
		align-items: start;
		flex-direction: column;
	}
}
</style>
