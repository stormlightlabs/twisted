<template>
	<ion-page
		><page-header back="/infrastructure" title="Public keys" /><ion-content :fullscreen="true"
			><main id="page-content" class="keys-page page-frame page-frame--narrow">
				<header>
					<p class="section-label">Actor diagnostics</p>
					<h1>Public keys</h1>
					<p>Inspect keys an actor has intentionally published. Secret and management endpoints are never used.</p>
				</header>
				<form @submit.prevent="openActor">
					<label for="keys-actor">Actor DID</label>
					<div>
						<input
							id="keys-actor"
							v-model.trim="actorDraft"
							pattern="did:[a-z0-9]+:.+"
							placeholder="did:plc:…"
							required /><button type="submit">Show public keys</button>
					</div>
				</form>
				<template v-if="actor"
					><coverage-notice :coverage="coverageRequest.data.value" /><request-state
						:empty="request.phase.value === 'empty'"
						empty-message="This actor has no indexed public keys."
						:error="request.error.value"
						:loading="request.phase.value === 'loading'"
						noun="public keys"
						@retry="request.retry" />
					<ul v-if="keys.length">
						<li v-for="item in keys" :key="item.uri">
							<div>
								<strong>{{ item.value.name }}</strong
								><time :datetime="item.value.createdAt">{{ formatDate(item.value.createdAt) }}</time>
							</div>
							<copyable-identifier :value="item.value.key" noun="public key" /><copyable-identifier
								:value="item.uri"
								noun="record identifier" />
						</li>
					</ul>
					<request-state
						:error="keyPages.error.value"
						:has-content="true"
						noun="more public keys"
						@retry="keyPages.loadMore" />
					<button
						v-if="keyPages.cursor.value"
						class="load-more"
						:disabled="keyPages.loading.value"
						type="button"
						@click="keyPages.loadMore">
						{{ keyPages.loading.value ? 'Loading…' : 'Load more keys' }}
					</button></template
				>
			</main></ion-content
		></ion-page
	>
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
const actor = computed(() => String(route.query.actor ?? ''))
const actorDraft = ref(actor.value)
watch(actor, (value) => (actorDraft.value = value))
const request = useRouteRequest(
	actor,
	(value, signal, attempt) =>
		value
			? getClient().listPublicKeys(value as Parameters<ReturnType<typeof getClient>['listPublicKeys']>[0], {
					signal,
					cache: attempt.cache,
					limit: 100,
				})
			: Promise.resolve({ items: [] }),
	{ isEmpty: (page) => page.items.length === 0 },
)
const coverageRequest = useRouteRequest(actor, (_value, signal, attempt) =>
	getClient().getCatalogCoverage({ signal, cache: attempt.cache }),
)
const keyPages = useCursorPagination(
	actor,
	request.data,
	(value, cursor, signal) =>
		getClient().listPublicKeys(value as Parameters<ReturnType<typeof getClient>['listPublicKeys']>[0], {
			cursor,
			signal,
			limit: 100,
		}),
	(item) => item.uri,
)
const keys = keyPages.items
function openActor(): void {
	void router.push(links.publicKeys(actorDraft.value))
}
function formatDate(value: string): string {
	return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value))
}
</script>

<style scoped>
.keys-page {
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
form {
	display: grid;
	gap: var(--space-2);
}
form label {
	font-weight: 700;
}
form div {
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
ul {
	display: grid;
	gap: var(--space-5);
	margin: 0;
	padding: 0;
	list-style: none;
}
li {
	display: grid;
	gap: var(--space-3);
	border-block-start: 1px solid var(--app-border);
	padding-block-start: var(--space-5);
}
li > div:first-child {
	display: flex;
	justify-content: space-between;
	gap: var(--space-4);
}
time {
	color: var(--app-text-muted);
}
@media (max-width: 38rem) {
	form div {
		grid-template-columns: 1fr;
	}
	li > div:first-child {
		align-items: start;
		flex-direction: column;
	}
}
</style>
