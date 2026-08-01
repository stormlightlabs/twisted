<template>
	<ion-page>
		<page-header back="/repositories" title="Repository" />
		<ion-content :fullscreen="true">
			<main id="page-content" class="repository-page page-frame page-frame--narrow">
				<request-state
					:error="repositoryRequest.error.value"
					:loading="repositoryRequest.phase.value === 'loading'"
					noun="repository"
					@retry="repositoryRequest.retry" />

				<template v-if="repository">
					<record-header
						:author="ownerDid"
						:canonical-url="canonicalUrl"
						collection="Repository"
						:title="repositoryName"
						:uri="repository.uri" />

					<section class="repository-intro" aria-labelledby="repository-about-heading">
						<div>
							<h2 id="repository-about-heading" class="sr-only">About this repository</h2>
							<p v-if="repository.value.description" class="repository-intro__description">
								{{ repository.value.description }}
							</p>
							<ul v-if="repository.value.topics?.length" class="repository-topics" aria-label="Topics">
								<li v-for="topic in repository.value.topics" :key="topic">{{ topic }}</li>
							</ul>
							<dl class="repository-facts">
								<div v-if="repository.value.repoDid">
									<dt>Repository DID</dt>
									<dd>
										<code>{{ repository.value.repoDid }}</code>
									</dd>
								</div>
								<div>
									<dt>Knot</dt>
									<dd>
										<router-link :to="links.knot(repository.value.knot)">{{ repository.value.knot }}</router-link>
									</dd>
								</div>
								<div v-if="repository.value.spindle">
									<dt>Spindle</dt>
									<dd>
										<router-link :to="links.spindle(repository.value.spindle)">{{
											repository.value.spindle
										}}</router-link>
									</dd>
								</div>
							</dl>
						</div>

						<div class="repository-actions" aria-label="Repository actions">
							<button v-if="repository.value.repoDid" type="button" @click="copyRepoDid">{{ didCopyLabel }}</button>
							<button v-if="cloneUrl" type="button" @click="copyCloneUrl">{{ cloneCopyLabel }}</button>
							<a v-if="websiteUrl" :href="websiteUrl" rel="noopener noreferrer" target="_blank">Visit website</a>
							<a v-if="sourceUrl" :href="sourceUrl" rel="noopener noreferrer" target="_blank">View source</a>
							<a :href="archiveTarUrl" download>Download tar.gz</a>
							<a :href="archiveZipUrl" download>Download zip</a>
						</div>
					</section>

					<section class="repository-counts" aria-label="Repository totals">
						<request-state
							:error="countsRequest.error.value"
							:loading="countsRequest.phase.value === 'loading'"
							noun="repository totals"
							@retry="countsRequest.retry" />
						<template v-if="countsRequest.data.value">
							<router-link :to="links.issues(repository.uri)"
								><strong>{{ countsRequest.data.value.issues }}</strong> Issues</router-link
							>
							<router-link :to="links.pulls(repository.uri)"
								><strong>{{ countsRequest.data.value.pulls }}</strong> Pull requests</router-link
							>
							<div>
								<strong>{{ countsRequest.data.value.stars }}</strong> Stars
							</div>
						</template>
					</section>

					<div class="repository-overview-grid">
						<section class="overview-panel" aria-labelledby="languages-heading">
							<header>
								<h2 id="languages-heading">Languages</h2>
								<router-link :to="links.source(repository.uri)">Browse source</router-link>
							</header>
							<request-state
								:empty="languagesRequest.phase.value === 'empty'"
								empty-message="No language summary is available for the current source."
								:error="languagesRequest.error.value"
								:loading="languagesRequest.phase.value === 'loading'"
								noun="languages"
								@retry="languagesRequest.retry" />
							<ul v-if="languagesRequest.data.value?.languages.length" class="language-list">
								<li v-for="language in languagesRequest.data.value.languages" :key="language.name">
									<span>{{ language.name }}</span
									><strong>{{ language.percentage }}%</strong>
								</li>
							</ul>
						</section>

						<section class="overview-panel" aria-labelledby="collaborators-heading">
							<header><h2 id="collaborators-heading">Collaborators</h2></header>
							<request-state
								:empty="collaboratorsRequest.phase.value === 'empty'"
								empty-message="No public collaborators are listed."
								:error="collaboratorsRequest.error.value"
								:loading="collaboratorsRequest.phase.value === 'loading'"
								noun="collaborators"
								@retry="collaboratorsRequest.retry" />
							<ul v-if="collaboratorsRequest.data.value?.items.length" class="simple-list">
								<li v-for="collaborator in collaboratorsRequest.data.value.items" :key="collaborator.subject">
									<router-link :to="links.profile(collaborator.subject)">{{ collaborator.subject }}</router-link>
								</li>
							</ul>
						</section>

						<section class="overview-panel" aria-labelledby="labels-heading">
							<header>
								<h2 id="labels-heading">Labels</h2>
								<router-link :to="links.labels(repositoryDid)">View labels</router-link>
							</header>
							<request-state
								:empty="labelsRequest.phase.value === 'empty'"
								empty-message="No public labels are defined for this repository."
								:error="labelsRequest.error.value"
								:loading="labelsRequest.phase.value === 'loading'"
								noun="labels"
								@retry="labelsRequest.retry" />
							<ul v-if="labelsRequest.data.value?.length" class="label-list">
								<li v-for="label in labelsRequest.data.value" :key="label.uri">{{ label.value.name }}</li>
							</ul>
						</section>
					</div>

					<section class="overview-panel overview-panel--wide" aria-labelledby="readme-heading">
						<header>
							<h2 id="readme-heading">README</h2>
							<router-link :to="links.source(repository.uri)">Open files</router-link>
						</header>
						<request-state
							:error="treeRequest.error.value"
							:loading="treeRequest.phase.value === 'loading'"
							noun="README"
							@retry="treeRequest.retry" />
						<markdown-content
							v-if="treeRequest.data.value?.readme"
							:repo="repository.uri"
							:source="treeRequest.data.value.readme.contents" />
						<div v-else-if="treeRequest.phase.value === 'ready'" class="compact-empty">
							No README has been added yet.
						</div>
					</section>

					<section class="overview-panel overview-panel--wide" aria-labelledby="updates-heading">
						<header>
							<h2 id="updates-heading">Recent code updates</h2>
							<router-link :to="links.commits(repository.uri)">View history</router-link>
						</header>
						<request-state
							:empty="updatesRequest.phase.value === 'empty'"
							empty-message="No recent code updates are indexed."
							:error="updatesRequest.error.value"
							:loading="updatesRequest.phase.value === 'loading'"
							noun="code updates"
							@retry="updatesRequest.retry" />
						<ol v-if="updatesRequest.data.value?.length" class="updates-list">
							<li v-for="update in updatesRequest.data.value" :key="update.uri">
								<strong>{{ update.value.ref }}</strong>
								<code>{{ update.value.newSha.slice(0, 10) }}</code>
								<router-link :to="links.profile(update.value.committerDid)">{{
									update.value.committerDid
								}}</router-link>
							</li>
						</ol>
					</section>
				</template>
			</main>
		</ion-content>
	</ion-page>
</template>

<script setup lang="ts">
import { useBobbinClientProvider } from '@/lib/api'
import MarkdownContent from '@/components/MarkdownContent.vue'
import PageHeader from '@/components/PageHeader.vue'
import RecordHeader from '@/components/RecordHeader.vue'
import RequestState from '@/components/RequestState.vue'
import { parseAtUri } from '@/content/links'
import { useRouteRequest } from '@/lib/requests'
import { links } from '@/lib/router/links'
import { IonContent, IonPage } from '@ionic/vue'
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const getClient = useBobbinClientProvider()
const repo = computed(() => String(route.params.repo ?? ''))
const repositoryRequest = useRouteRequest(repo, (identifier, signal, attempt) =>
	getClient().getRepo(identifier as Parameters<ReturnType<typeof getClient>['getRepo']>[0], {
		signal,
		cache: attempt.cache,
	}),
)
const repository = computed(() => repositoryRequest.data.value)
const ownerDid = computed(() => parseAtUri(repo.value)?.authority)
const repositoryDid = computed(() => repository.value?.value.repoDid ?? '')
const repositoryUri = computed(() => repository.value?.uri ?? '')
const repositoryName = computed(() => {
	const name = repository.value?.value.name?.trim()
	return name || parseAtUri(repo.value)?.rkey || 'Repository'
})
const canonicalUrl = computed(() => (repositoryDid.value ? `https://tangled.org/${repositoryDid.value}` : undefined))
const cloneUrl = canonicalUrl
const websiteUrl = computed(() => safeWebUrl(repository.value?.value.website))
const sourceUrl = computed(() => safeWebUrl(repository.value?.value.source))
const archiveTarUrl = computed(() => getClient().repositoryArchiveUrl(repositoryUri.value, 'tar.gz'))
const archiveZipUrl = computed(() => getClient().repositoryArchiveUrl(repositoryUri.value, 'zip'))
const didCopyLabel = ref('Copy repository DID')
const cloneCopyLabel = ref('Copy HTTPS clone URL')

const countsRequest = useRouteRequest(repositoryDid, (did, signal, attempt) =>
	did
		? getClient().getRepositoryCounts(did as Parameters<ReturnType<typeof getClient>['getRepositoryCounts']>[0], {
				signal,
				cache: attempt.cache,
			})
		: Promise.resolve(undefined),
)
const languagesRequest = useRouteRequest(
	repositoryUri,
	(uri, signal, attempt) =>
		uri ? getClient().getRepositoryLanguages(uri, { signal, cache: attempt.cache }) : Promise.resolve(undefined),
	{ isEmpty: (data) => !data?.languages.length },
)
const treeRequest = useRouteRequest(repositoryUri, (uri, signal, attempt) =>
	uri
		? getClient().getRepositoryTree(uri, { ref: 'HEAD' }, { signal, cache: attempt.cache })
		: Promise.resolve(undefined),
)
const collaboratorsRequest = useRouteRequest(
	repositoryDid,
	(did, signal, attempt) =>
		did
			? getClient().listRepositoryCollaborators(
					did as Parameters<ReturnType<typeof getClient>['listRepositoryCollaborators']>[0],
					{ signal, cache: attempt.cache },
				)
			: Promise.resolve(undefined),
	{ isEmpty: (data) => !data?.items.length },
)
const labelsRequest = useRouteRequest(
	repositoryDid,
	(did, signal, attempt) =>
		did ? getClient().listRepositoryLabels(did, { signal, cache: attempt.cache }) : Promise.resolve(undefined),
	{ isEmpty: (data) => !data?.length },
)
const updatesRequest = useRouteRequest(
	repositoryDid,
	(did, signal, attempt) =>
		did
			? getClient().listRepositoryRefUpdates(
					did as Parameters<ReturnType<typeof getClient>['listRepositoryRefUpdates']>[0],
					{ signal, cache: attempt.cache },
				)
			: Promise.resolve(undefined),
	{ isEmpty: (data) => !data?.length },
)

async function copyRepoDid(): Promise<void> {
	if (!repositoryDid.value) return
	didCopyLabel.value = (await copyText(repositoryDid.value)) ? 'Repository DID copied' : 'Copy failed'
}

async function copyCloneUrl(): Promise<void> {
	if (!cloneUrl.value) return
	cloneCopyLabel.value = (await copyText(cloneUrl.value)) ? 'Clone URL copied' : 'Copy failed'
}

async function copyText(value: string): Promise<boolean> {
	try {
		await navigator.clipboard.writeText(value)
		return true
	} catch {
		return false
	}
}

function safeWebUrl(value: string | undefined): string | undefined {
	if (!value) return undefined
	try {
		const url = new URL(value)
		return url.protocol === 'https:' ? url.href : undefined
	} catch {
		return undefined
	}
}
</script>

<style scoped>
.repository-page {
	display: grid;
	gap: var(--space-8);
}

.repository-intro {
	display: grid;
	grid-template-columns: minmax(0, 1fr) auto;
	gap: var(--space-6);
}

.repository-intro__description {
	max-inline-size: 48rem;
	margin: 0;
	font-size: var(--text-lg);
	line-height: 1.6;
}

.repository-topics,
.label-list {
	display: flex;
	flex-wrap: wrap;
	gap: var(--space-2);
	margin: var(--space-4) 0 0;
	padding: 0;
	list-style: none;
}

.repository-topics li,
.label-list li {
	border: 1px solid var(--app-border);
	border-radius: 999px;
	padding: var(--space-1) var(--space-3);
	color: var(--app-text-muted);
	font-size: var(--text-xs);
}

.repository-facts {
	display: flex;
	flex-wrap: wrap;
	gap: var(--space-5);
	margin-block-start: var(--space-5);
}

.repository-facts div {
	display: grid;
	gap: var(--space-1);
}

.repository-facts dt {
	color: var(--app-text-muted);
	font-size: var(--text-xs);
	font-weight: 700;
}

.repository-facts dd {
	margin: 0;
	overflow-wrap: anywhere;
}

.repository-actions {
	display: grid;
	align-content: start;
	gap: var(--space-2);
}

.repository-actions button,
.repository-actions a {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	min-block-size: 44px;
	border: 1px solid var(--app-border);
	border-radius: var(--radius-sm);
	padding-inline: var(--space-4);
	color: var(--app-text);
	background: var(--app-surface);
	font: inherit;
	font-weight: 650;
	text-decoration: none;
	cursor: pointer;
}

.repository-counts {
	display: grid;
	grid-template-columns: repeat(3, minmax(0, 1fr));
	gap: var(--space-3);
}

.repository-counts > a,
.repository-counts > div {
	display: grid;
	gap: var(--space-1);
	border-block: 1px solid var(--app-border);
	padding-block: var(--space-4);
	color: var(--app-text-muted);
	text-decoration: none;
}

.repository-counts strong {
	color: var(--app-text);
	font-family: var(--font-display);
	font-size: var(--text-2xl);
}

.repository-overview-grid {
	display: grid;
	grid-template-columns: repeat(3, minmax(0, 1fr));
	gap: var(--space-4);
}

.overview-panel {
	display: grid;
	align-content: start;
	gap: var(--space-4);
	border: 1px solid var(--app-border);
	border-radius: var(--radius-md);
	padding: var(--space-5);
	background: var(--app-surface);
}

.overview-panel--wide {
	background: transparent;
}

.overview-panel > header {
	display: flex;
	align-items: baseline;
	justify-content: space-between;
	gap: var(--space-4);
}

.overview-panel h2 {
	margin: 0;
	font-family: var(--font-display);
	font-size: var(--text-2xl);
}

.language-list,
.simple-list,
.updates-list {
	display: grid;
	gap: var(--space-3);
	margin: 0;
	padding: 0;
	list-style: none;
}

.language-list li,
.updates-list li {
	display: flex;
	justify-content: space-between;
	gap: var(--space-3);
}

.simple-list a,
.updates-list a,
.updates-list code {
	overflow-wrap: anywhere;
}

.compact-empty {
	border-inline-start: 3px solid var(--app-border);
	padding: var(--space-3) var(--space-4);
	color: var(--app-text-muted);
}

@media (max-width: 820px) {
	.repository-intro,
	.repository-overview-grid {
		grid-template-columns: 1fr;
	}

	.repository-actions {
		grid-template-columns: repeat(2, minmax(0, 1fr));
	}
}

@media (max-width: 520px) {
	.repository-actions,
	.repository-counts {
		grid-template-columns: 1fr;
	}
}
</style>
