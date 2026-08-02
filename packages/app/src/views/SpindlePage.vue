<template>
	<ion-page
		><page-header back="/infrastructure" title="Spindle" /><ion-content :fullscreen="true"
			><main id="page-content" class="spindle-page page-frame page-frame--narrow">
				<header>
					<p class="section-label">Public spindle</p>
					<h1>{{ spindle }}</h1>
					<copyable-identifier :value="spindle" noun="spindle identifier" />
					<p v-if="owner">
						Owned by <router-link :to="links.profile(owner)">{{ owner }}</router-link>
					</p>
					<copyable-identifier v-if="owner" :value="owner" noun="owner DID" />
				</header>
				<coverage-notice :coverage="coverageRequest.data.value" /><freshness-notice />
				<section aria-labelledby="members-heading">
					<h2 id="members-heading">Members</h2>
					<request-state
						:empty="membersRequest.phase.value === 'empty'"
						empty-message="No public membership records are indexed for this spindle."
						:error="membersRequest.error.value"
						:loading="membersRequest.phase.value === 'loading'"
						noun="spindle members"
						@retry="membersRequest.retry" />
					<ol v-if="members.length">
						<li v-for="member in members" :key="member.uri">
							<div>
								<router-link :to="links.profile(member.value.subject)">{{ member.value.subject }}</router-link
								><time :datetime="member.value.createdAt">{{ formatDate(member.value.createdAt) }}</time>
							</div>
							<span
								>Membership published by
								<router-link :to="links.profile(recordAuthor(member.uri))">{{
									recordAuthor(member.uri)
								}}</router-link></span
							>
						</li>
					</ol>
					<request-state
						:error="memberPages.error.value"
						:has-content="true"
						noun="more spindle members"
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
				<section aria-labelledby="pipelines-heading">
					<h2 id="pipelines-heading">Pipeline runs</h2>
					<request-state
						:empty="pipelinesRequest.phase.value === 'empty'"
						empty-message="No public pipeline runs are indexed for this spindle."
						:error="pipelinesRequest.error.value"
						:loading="pipelinesRequest.phase.value === 'loading'"
						noun="pipeline runs"
						@retry="pipelinesRequest.retry" />
					<ul v-if="pipelines.length">
						<li v-for="pipeline in pipelines" :key="pipeline.uri">
							<div>
								<strong>{{
									pipeline.value.workflows.map((workflow) => workflow.name).join(', ') || 'Pipeline run'
								}}</strong
								><span>{{ pipeline.value.triggerMetadata.kind.replace('_', ' ') }}</span>
							</div>
							<copyable-identifier :value="pipeline.uri" noun="pipeline identifier" />
						</li>
					</ul>
					<request-state
						:error="pipelinePages.error.value"
						:has-content="true"
						noun="more pipeline runs"
						@retry="pipelinePages.loadMore" />
					<button
						v-if="pipelinePages.cursor.value"
						class="load-more"
						:disabled="pipelinePages.loading.value"
						type="button"
						@click="pipelinePages.loadMore">
						{{ pipelinePages.loading.value ? 'Loading…' : 'Load more runs' }}
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
import { parseAtUri } from '@/content'
import { useBobbinClientProvider } from '@/lib/api'
import { useCursorPagination, useRouteRequest } from '@/lib/requests'
import { links } from '@/lib/router/links'
import { IonContent, IonPage } from '@ionic/vue'
import { computed } from 'vue'
import { useRoute } from 'vue-router'
const route = useRoute()
const getClient = useBobbinClientProvider()
const spindle = computed(() => String(route.params.spindle ?? ''))
const owner = computed(() => String(route.query.owner ?? ''))
const membersRequest = useRouteRequest(
	spindle,
	(value, signal, attempt) => getClient().listSpindleMembers(value, { signal, cache: attempt.cache, limit: 100 }),
	{ isEmpty: (page) => page.items.length === 0 },
)
const pipelinesRequest = useRouteRequest(
	spindle,
	(value, signal, attempt) => getClient().listPipelines(value, { signal, cache: attempt.cache, limit: 100 }),
	{ isEmpty: (page) => page.items.length === 0 },
)
const coverageRequest = useRouteRequest(spindle, (_value, signal, attempt) =>
	getClient().getCatalogCoverage({ signal, cache: attempt.cache }),
)
const memberPages = useCursorPagination(
	spindle,
	membersRequest.data,
	(value, cursor, signal) => getClient().listSpindleMembers(value, { cursor, signal, limit: 100 }),
	(item) => item.uri,
)
const pipelinePages = useCursorPagination(
	spindle,
	pipelinesRequest.data,
	(value, cursor, signal) => getClient().listPipelines(value, { cursor, signal, limit: 100 }),
	(item) => item.uri,
)
const members = memberPages.items
const pipelines = pipelinePages.items
function recordAuthor(uri: string): string {
	return parseAtUri(uri)?.authority ?? 'Unknown actor'
}
function formatDate(value: string): string {
	return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}
</script>

<style scoped>
.spindle-page {
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
header > p:last-child {
	color: var(--app-text-muted);
}
section {
	display: grid;
	gap: var(--space-4);
}
section h2 {
	margin: 0;
}
section ol,
section ul {
	margin: 0;
	padding: 0;
	list-style: none;
}
section li {
	display: grid;
	gap: var(--space-3);
	border-block-start: 1px solid var(--app-border);
	padding-block: var(--space-4);
}
section li > div {
	display: flex;
	justify-content: space-between;
	gap: var(--space-4);
}
section time,
section span {
	color: var(--app-text-muted);
}
@media (max-width: 38rem) {
	section li > div {
		align-items: start;
		flex-direction: column;
	}
}
</style>
