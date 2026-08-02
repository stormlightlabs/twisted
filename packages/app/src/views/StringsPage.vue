<template>
	<ion-page>
		<page-header back="/" title="Strings" />
		<ion-content :fullscreen="true">
			<main id="page-content" class="strings-page page-frame page-frame--narrow">
				<header>
					<p class="section-label">Tangled strings</p>
					<h1>Public snippets</h1>
					<p>Browse text records attached to a public scope identifier.</p>
				</header>
				<form class="scope-form" @submit.prevent="openScope">
					<label for="string-scope">Scope identifier</label>
					<div>
						<input
							id="string-scope"
							v-model.trim="scopeDraft"
							placeholder="Repository DID, actor DID, or another public scope"
							required /><button type="submit">Browse strings</button>
					</div>
				</form>
				<template v-if="scope">
					<copyable-identifier :value="scope" noun="scope" />
					<coverage-notice :coverage="coverageRequest.data.value" />
					<request-state
						:empty="stringsRequest.phase.value === 'empty'"
						empty-message="No public strings are indexed for this scope."
						:error="stringsRequest.error.value"
						:loading="stringsRequest.phase.value === 'loading'"
						noun="strings"
						@retry="stringsRequest.retry" />
					<ul v-if="strings.length" class="string-list">
						<li v-for="item in strings" :key="item.uri">
							<div>
								<router-link :to="links.string(item.uri)">{{ item.value.filename }}</router-link
								><time :datetime="item.value.createdAt">{{ formatDate(item.value.createdAt) }}</time>
							</div>
							<p v-if="item.value.description">{{ item.value.description }}</p>
							<code>{{ preview(item.value.contents) }}</code>
						</li>
					</ul>
					<request-state
						:error="stringPages.error.value"
						:has-content="true"
						noun="more strings"
						@retry="stringPages.loadMore" />
					<button
						v-if="stringPages.cursor.value"
						class="load-more"
						:disabled="stringPages.loading.value"
						type="button"
						@click="stringPages.loadMore">
						{{ stringPages.loading.value ? 'Loading…' : 'Load more strings' }}
					</button>
				</template>
			</main>
		</ion-content>
	</ion-page>
</template>

<script setup lang="ts">
import CopyableIdentifier from '@/components/CopyableIdentifier.vue'
import CoverageNotice from '@/components/CoverageNotice.vue'
import PageHeader from '@/components/PageHeader.vue'
import RequestState from '@/components/RequestState.vue'
import { useBobbinClientProvider } from '@/lib/api'
import { useCursorPagination, useRouteRequest } from '@/lib/requests'
import { links } from '@/lib/router/links'
import { IonContent, IonPage } from '@ionic/vue'
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()
const getClient = useBobbinClientProvider()
const scope = computed(() => String(route.query.scope ?? ''))
const scopeDraft = ref(scope.value)
watch(scope, (value) => (scopeDraft.value = value))
const stringsRequest = useRouteRequest(
	scope,
	(value, signal, attempt) =>
		value
			? getClient().listStrings(value, { signal, cache: attempt.cache, limit: 100 })
			: Promise.resolve({ items: [] }),
	{ isEmpty: (page) => page.items.length === 0 },
)
const coverageRequest = useRouteRequest(scope, (_value, signal, attempt) =>
	getClient().getCoverage({ signal, cache: attempt.cache }),
)
const stringPages = useCursorPagination(
	scope,
	stringsRequest.data,
	(value, cursor, signal) => getClient().listStrings(value, { cursor, signal, limit: 100 }),
	(item) => item.uri,
)
const strings = stringPages.items

function openScope(): void {
	void router.push(links.strings(scopeDraft.value))
}
function preview(value: string): string {
	const first = value.split('\n')[0] ?? ''
	return first.length > 120 ? `${first.slice(0, 117)}…` : first
}
function formatDate(value: string): string {
	return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value))
}
</script>

<style scoped>
.strings-page {
	display: grid;
	gap: var(--space-6);
}
.strings-page > header h1,
.strings-page > header p {
	margin: 0;
}
.strings-page > header h1 {
	font-size: clamp(var(--text-2xl), 5vw, 2.7rem);
}
.strings-page > header p:last-child {
	margin-block-start: var(--space-2);
	color: var(--app-text-muted);
}
.scope-form {
	display: grid;
	gap: var(--space-2);
}
.scope-form label {
	font-weight: 700;
}
.scope-form div {
	display: grid;
	grid-template-columns: minmax(0, 1fr) auto;
	gap: var(--space-2);
}
.scope-form input,
.scope-form button {
	min-block-size: 44px;
	border: 1px solid var(--app-border);
	border-radius: var(--radius-sm);
	padding-inline: var(--space-4);
}
.scope-form input {
	color: var(--app-text);
	background: var(--app-surface);
}
.scope-form button {
	color: var(--app-accent-contrast);
	background: var(--app-accent);
	font-weight: 750;
	cursor: pointer;
}
.string-list {
	display: grid;
	gap: 0;
	margin: 0;
	padding: 0;
	list-style: none;
}
.string-list li {
	display: grid;
	gap: var(--space-2);
	border-block-start: 1px solid var(--app-border);
	padding-block: var(--space-5);
}
.string-list li > div {
	display: flex;
	justify-content: space-between;
	gap: var(--space-4);
}
.string-list a {
	font-size: var(--text-lg);
	font-weight: 750;
}
.string-list time,
.string-list p {
	color: var(--app-text-muted);
}
.string-list p {
	margin: 0;
}
.string-list code {
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}
@media (max-width: 38rem) {
	.scope-form div {
		grid-template-columns: 1fr;
	}
	.string-list li > div {
		align-items: start;
		flex-direction: column;
	}
}
</style>
