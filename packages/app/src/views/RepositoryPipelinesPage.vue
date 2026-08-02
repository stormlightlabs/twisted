<template>
	<ion-page>
		<page-header back="/repositories" title="Pipelines" />
		<ion-content :fullscreen="true">
			<main id="page-content" class="automation-page page-frame page-frame--narrow">
				<repository-navigation :repo="repo" />
				<request-state
					:error="repositoryRequest.error.value"
					:loading="repositoryRequest.phase.value === 'loading'"
					noun="repository"
					@retry="repositoryRequest.retry" />

				<template v-if="repository">
					<header class="automation-heading">
						<div>
							<p class="section-label">{{ repository.value.name || 'Repository' }}</p>
							<h1>{{ selectedPipelineUri ? 'Pipeline run' : 'Automation' }}</h1>
							<p>Public runs, status updates, and downloadable build artifacts.</p>
						</div>
						<router-link v-if="selectedPipelineUri" :to="links.pipelines(repo)">All runs</router-link>
					</header>
					<coverage-notice :coverage="coverageRequest.data.value" />

					<template v-if="selectedPipelineUri">
						<request-state
							:error="pipelineRequest.error.value"
							:loading="pipelineRequest.phase.value === 'loading'"
							noun="pipeline"
							@retry="pipelineRequest.retry" />
						<section v-if="pipeline" class="automation-panel" aria-labelledby="run-heading">
							<header>
								<div>
									<p class="section-label">{{ pipeline.value.triggerMetadata.kind.replace('_', ' ') }}</p>
									<h2 id="run-heading">{{ pipelineTitle }}</h2>
								</div>
							</header>
							<copyable-identifier :value="pipeline.uri" noun="pipeline identifier" />
							<dl class="facts">
								<div>
									<dt>Repository DID</dt>
									<dd>
										<router-link :to="links.repository(repo)">{{
											pipeline.value.triggerMetadata.repo.did
										}}</router-link>
									</dd>
								</div>
								<div>
									<dt>Default branch</dt>
									<dd>{{ pipeline.value.triggerMetadata.repo.defaultBranch }}</dd>
								</div>
								<div>
									<dt>Knot</dt>
									<dd>
										<router-link :to="links.knot(pipeline.value.triggerMetadata.repo.knot)">{{
											pipeline.value.triggerMetadata.repo.knot
										}}</router-link>
									</dd>
								</div>
								<div v-if="triggerRef">
									<dt>Revision</dt>
									<dd>
										<code>{{ triggerRef }}</code>
									</dd>
								</div>
							</dl>
							<ul class="workflow-list" aria-label="Workflows">
								<li v-for="workflow in pipeline.value.workflows" :key="workflow.name">
									<strong>{{ workflow.name }}</strong
									><span>{{ workflow.engine }}</span>
								</li>
							</ul>
						</section>

						<section class="automation-panel" aria-labelledby="status-heading">
							<h2 id="status-heading">Status history</h2>
							<request-state
								:empty="statusesRequest.phase.value === 'empty'"
								empty-message="This run has no indexed status updates yet. It may still be waiting to start."
								:error="statusesRequest.error.value"
								:loading="statusesRequest.phase.value === 'loading'"
								noun="status updates"
								@retry="statusesRequest.retry" />
							<ol v-if="statuses.length" class="status-history">
								<li v-for="status in statuses" :key="status.uri">
									<span :class="`status-badge status-badge--${status.value.status}`">{{ status.value.status }}</span>
									<div>
										<router-link :to="localRecordLink(status.value.workflow) ?? links.search(status.value.workflow)">
											<strong>{{ workflowName(status.value.workflow) }}</strong>
										</router-link>
										<p v-if="status.value.error">{{ status.value.error }}</p>
										<small
											>{{ formatDate(status.value.createdAt) }} · by
											<router-link :to="links.profile(recordAuthor(status.uri))">{{
												recordAuthor(status.uri)
											}}</router-link></small
										>
									</div>
								</li>
							</ol>
							<request-state
								:error="statusPages.error.value"
								:has-content="true"
								noun="more status updates"
								@retry="statusPages.loadMore" />
							<button
								v-if="statusPages.cursor.value"
								class="load-more"
								:disabled="statusPages.loading.value"
								type="button"
								@click="statusPages.loadMore">
								{{ statusPages.loading.value ? 'Loading…' : 'Load more status updates' }}
							</button>
						</section>
					</template>

					<template v-else>
						<section class="automation-panel" aria-labelledby="runs-heading">
							<h2 id="runs-heading">Pipeline runs</h2>
							<request-state
								:empty="pipelinesRequest.phase.value === 'empty'"
								empty-message="No public runs are indexed for this repository."
								:error="pipelinesRequest.error.value"
								:loading="pipelinesRequest.phase.value === 'loading'"
								noun="pipeline runs"
								@retry="pipelinesRequest.retry" />
							<ul v-if="pipelines.length" class="record-list">
								<li v-for="run in pipelines" :key="run.uri">
									<router-link :to="links.pipelines(repo, run.uri)">{{
										run.value.workflows.map((workflow) => workflow.name).join(', ') || 'Pipeline run'
									}}</router-link>
									<span>{{ run.value.triggerMetadata.kind.replace('_', ' ') }} · {{ recordAuthor(run.uri) }}</span>
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

						<section class="automation-panel" aria-labelledby="artifacts-heading">
							<h2 id="artifacts-heading">Artifacts</h2>
							<request-state
								:empty="artifactsRequest.phase.value === 'empty'"
								empty-message="No public build artifacts are indexed for this repository."
								:error="artifactsRequest.error.value"
								:loading="artifactsRequest.phase.value === 'loading'"
								noun="artifacts"
								@retry="artifactsRequest.retry" />
							<ul v-if="artifacts.length" class="record-list">
								<li v-for="artifact in artifacts" :key="artifact.uri">
									<router-link :to="links.artifact(repo, artifact.uri)">{{ artifact.value.name }}</router-link>
									<span
										>{{ artifact.value.artifact.mimeType }} ·
										{{ formatBytes(artifactSize(artifact.value.artifact)) }}</span
									>
								</li>
							</ul>
							<request-state
								:error="artifactPages.error.value"
								:has-content="true"
								noun="more artifacts"
								@retry="artifactPages.loadMore" />
							<button
								v-if="artifactPages.cursor.value"
								class="load-more"
								:disabled="artifactPages.loading.value"
								type="button"
								@click="artifactPages.loadMore">
								{{ artifactPages.loading.value ? 'Loading…' : 'Load more artifacts' }}
							</button>
						</section>
					</template>
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
import { localRecordLink, parseAtUri } from '@/content'
import RepositoryNavigation from '@/features/repositories/RepositoryNavigation.vue'
import { useBobbinClientProvider } from '@/lib/api'
import { useCursorPagination, useRouteRequest } from '@/lib/requests'
import { links } from '@/lib/router/links'
import { IonContent, IonPage } from '@ionic/vue'
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const getClient = useBobbinClientProvider()
const repo = computed(() => String(route.params.repo ?? ''))
const selectedPipelineUri = computed(() => String(route.params.pipeline ?? ''))
const repositoryRequest = useRouteRequest(repo, (identifier, signal, attempt) =>
	getClient().getRepo(identifier as Parameters<ReturnType<typeof getClient>['getRepo']>[0], {
		signal,
		cache: attempt.cache,
	}),
)
const repository = computed(() => repositoryRequest.data.value)
const subject = computed(() => repository.value?.value.repoDid ?? '')
const coverageRequest = useRouteRequest(repo, (_value, signal, attempt) =>
	getClient().getCatalogCoverage({ signal, cache: attempt.cache }),
)
const pipelinesRequest = useRouteRequest(
	subject,
	(value, signal, attempt) =>
		value
			? getClient().listPipelines(value, { signal, cache: attempt.cache, limit: 50 })
			: Promise.resolve({ items: [] }),
	{ isEmpty: (page) => page.items.length === 0 },
)
const artifactsRequest = useRouteRequest(
	subject,
	(value, signal, attempt) =>
		value
			? getClient().listArtifacts(value, { signal, cache: attempt.cache, limit: 50 })
			: Promise.resolve({ items: [] }),
	{ isEmpty: (page) => page.items.length === 0 },
)
const pipelineRequest = useRouteRequest(selectedPipelineUri, (uri, signal, attempt) =>
	uri ? getClient().getPipeline(uri, { signal, cache: attempt.cache }) : Promise.resolve(undefined),
)
const statusesRequest = useRouteRequest(
	selectedPipelineUri,
	(uri, signal, attempt) =>
		uri
			? getClient().listPipelineStatuses(uri as Parameters<ReturnType<typeof getClient>['listPipelineStatuses']>[0], {
					signal,
					cache: attempt.cache,
					limit: 100,
				})
			: Promise.resolve({ items: [] }),
	{ isEmpty: (page) => page.items.length === 0 },
)

const pipelinePages = useCursorPagination(
	subject,
	pipelinesRequest.data,
	(value, cursor, signal) => getClient().listPipelines(value, { cursor, signal, limit: 50 }),
	(item) => item.uri,
)
const artifactPages = useCursorPagination(
	subject,
	artifactsRequest.data,
	(value, cursor, signal) => getClient().listArtifacts(value, { cursor, signal, limit: 50 }),
	(item) => item.uri,
)
const statusPages = useCursorPagination(
	selectedPipelineUri,
	statusesRequest.data,
	(value, cursor, signal) =>
		getClient().listPipelineStatuses(value as Parameters<ReturnType<typeof getClient>['listPipelineStatuses']>[0], {
			cursor,
			signal,
			limit: 100,
		}),
	(item) => item.uri,
)
const pipelines = pipelinePages.items
const artifacts = artifactPages.items
const pipeline = computed(() => pipelineRequest.data.value)
const statuses = statusPages.items
const pipelineTitle = computed(
	() => pipeline.value?.value.workflows.map((workflow) => workflow.name).join(', ') || 'Pipeline run',
)
const triggerRef = computed(() => {
	const trigger = pipeline.value?.value.triggerMetadata
	return trigger?.manual?.ref ?? trigger?.push?.ref ?? trigger?.pullRequest?.sourceBranch
})

function recordAuthor(uri: string): string {
	return parseAtUri(uri)?.authority ?? 'Unknown actor'
}
function workflowName(uri: string): string {
	return parseAtUri(uri)?.rkey ?? uri
}
function formatDate(value: string): string {
	return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}
function artifactSize(blob: { size: number } | { cid: string }): number | undefined {
	return 'size' in blob ? blob.size : undefined
}
function formatBytes(value: number | undefined): string {
	if (value === undefined || value < 0) return 'size unavailable'
	if (value < 1024) return `${value} B`
	if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
	return `${(value / (1024 * 1024)).toFixed(1)} MB`
}
</script>

<style scoped>
.automation-page {
	display: grid;
	gap: var(--space-6);
}
.automation-heading {
	display: flex;
	justify-content: space-between;
	gap: var(--space-5);
	align-items: end;
}
.automation-heading h1,
.automation-heading p {
	margin: 0;
}
.automation-heading h1 {
	font-family: var(--font-display);
	font-size: clamp(var(--text-2xl), 5vw, 2.7rem);
}
.automation-heading > div > p:last-child {
	margin-block-start: var(--space-2);
	color: var(--app-text-muted);
}
.automation-heading > a {
	min-block-size: 44px;
	padding: var(--space-3);
}
.automation-panel {
	display: grid;
	gap: var(--space-4);
	border-block-start: 1px solid var(--app-border);
	padding-block-start: var(--space-5);
}
.automation-panel h2 {
	margin: 0;
	font-size: var(--text-xl);
}
.facts {
	display: grid;
	grid-template-columns: repeat(2, minmax(0, 1fr));
	gap: var(--space-4);
	margin: 0;
}
.facts div {
	min-inline-size: 0;
}
.facts dt {
	color: var(--app-text-muted);
	font-size: var(--text-sm);
}
.facts dd {
	margin: var(--space-1) 0 0;
	overflow-wrap: anywhere;
}
.workflow-list,
.record-list,
.status-history {
	display: grid;
	gap: 0;
	margin: 0;
	padding: 0;
	list-style: none;
}
.workflow-list li,
.record-list li {
	display: flex;
	justify-content: space-between;
	gap: var(--space-4);
	padding-block: var(--space-4);
	border-block-start: 1px solid var(--app-border);
}
.workflow-list span,
.record-list span,
.status-history small {
	color: var(--app-text-muted);
}
.status-history li {
	display: grid;
	grid-template-columns: 7rem minmax(0, 1fr);
	gap: var(--space-4);
	padding-block: var(--space-4);
	border-block-start: 1px solid var(--app-border);
}
.status-history p {
	margin: var(--space-1) 0;
	color: var(--app-danger);
}
.status-badge {
	align-self: start;
	border: 1px solid currentColor;
	border-radius: 999px;
	padding: var(--space-1) var(--space-3);
	text-align: center;
}
.status-badge--success {
	color: var(--app-success);
}
.status-badge--failed,
.status-badge--cancelled,
.status-badge--timeout {
	color: var(--app-danger);
}
.status-badge--running,
.status-badge--pending {
	color: var(--app-warning);
}
@media (max-width: 38rem) {
	.automation-heading,
	.workflow-list li,
	.record-list li {
		align-items: start;
		flex-direction: column;
	}
	.facts {
		grid-template-columns: 1fr;
	}
	.status-history li {
		grid-template-columns: 1fr;
	}
	.status-badge {
		justify-self: start;
	}
}
</style>
