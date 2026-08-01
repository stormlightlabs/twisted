<template>
	<ion-page>
		<page-header :back="historyBack" title="Commit" />
		<ion-content :fullscreen="true">
			<main id="page-content" class="commit-page page-frame page-frame--narrow">
				<repository-navigation :repo="repo" />
				<request-state
					:error="repositoryRequest.error.value"
					:loading="repositoryRequest.phase.value === 'loading'"
					noun="repository"
					@retry="repositoryRequest.retry" />
				<request-state
					:empty="commitRequest.phase.value === 'empty'"
					empty-message="This commit was not found in the repository."
					:error="commitRequest.error.value"
					:loading="commitRequest.phase.value === 'loading'"
					noun="commit"
					@retry="commitRequest.retry" />
				<article v-if="commit" class="commit-card">
					<p class="section-label">Commit</p>
					<h1>{{ firstLine(commit.message) || 'Commit without a message' }}</h1>
					<pre v-if="commit.message.includes('\n')">{{ commit.message }}</pre>
					<dl>
						<div>
							<dt>Hash</dt>
							<dd>
								<code>{{ commit.hash }}</code>
							</dd>
						</div>
						<div v-if="commit.author">
							<dt>Author</dt>
							<dd>
								{{ commit.author.name }}<span v-if="commit.author.email"> · {{ commit.author.email }}</span>
							</dd>
						</div>
						<div v-if="commit.author?.when">
							<dt>Authored</dt>
							<dd>
								<time :datetime="commit.author.when">{{ formatDate(commit.author.when) }}</time>
							</dd>
						</div>
						<div v-if="commit.committer">
							<dt>Committer</dt>
							<dd>{{ commit.committer.name }}</dd>
						</div>
						<div v-if="commit.tree">
							<dt>Tree</dt>
							<dd>
								<code>{{ commit.tree }}</code>
							</dd>
						</div>
					</dl>
					<section v-if="commit.parents.length">
						<h2>Parents</h2>
						<ul>
							<li v-for="parent in commit.parents" :key="parent">
								<router-link :to="links.commit(repo, parent)"
									><code>{{ parent }}</code></router-link
								>
								<span> · </span>
								<router-link :to="links.compare(repo, parent, commit.hash)">View changes</router-link>
							</li>
						</ul>
					</section>
					<div class="commit-card__actions">
						<router-link :to="links.diff(repo, commit.hash)">View this patch</router-link>
						<router-link :to="links.source(repo, commit.hash)">Browse files at this commit</router-link>
					</div>
				</article>
			</main>
		</ion-content>
	</ion-page>
</template>

<script setup lang="ts">
import PageHeader from '@/components/PageHeader.vue'
import RequestState from '@/components/RequestState.vue'
import RepositoryNavigation from '@/features/repositories/RepositoryNavigation.vue'
import { useRepositoryRoute } from '@/features/repositories/useRepositoryRoute'
import { useRouteRequest } from '@/lib/requests'
import { links } from '@/lib/router/links'
import { IonContent, IonPage } from '@ionic/vue'
import { computed } from 'vue'
import { useRouter } from 'vue-router'

const { getClient, repo, repoUri, repositoryRequest, route } = useRepositoryRoute()
const router = useRouter()
const hash = computed(() => String(route.params.hash ?? ''))
const source = computed(() => ({ uri: repoUri.value, hash: hash.value }))
const commitRequest = useRouteRequest(
	source,
	async ({ uri, hash: requestedHash }, signal, attempt) => {
		if (!uri || !requestedHash) return undefined
		const page = await getClient().getRepositoryLog(uri, { ref: requestedHash, signal, cache: attempt.cache, limit: 1 })
		return page.items.find((item) => item.hash === requestedHash) ?? page.items[0]
	},
	{ isEmpty: (commit) => commit === undefined },
)
const commit = computed(() => commitRequest.data.value)
const historyBack = computed(() => router.resolve(links.commits(repo.value)).href)
function firstLine(message: string) {
	return message.split('\n')[0]
}
function formatDate(value: string) {
	return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'long' }).format(new Date(value))
}
</script>

<style scoped>
.commit-page {
	display: grid;
	gap: var(--space-6);
}
.commit-card {
	display: grid;
	gap: var(--space-5);
	border: 1px solid var(--app-border);
	border-radius: var(--radius-md);
	padding: var(--space-6);
	background: var(--app-surface);
}
.commit-card h1,
.commit-card h2,
.commit-card p,
.commit-card pre {
	margin: 0;
}
.commit-card h1,
.commit-card code {
	overflow-wrap: anywhere;
}
.commit-card pre {
	overflow-x: auto;
	white-space: pre-wrap;
	font-family: var(--font-body);
}
.commit-card dl {
	display: grid;
	gap: var(--space-4);
	margin: 0;
}
.commit-card dl div {
	display: grid;
	grid-template-columns: 7rem minmax(0, 1fr);
	gap: var(--space-3);
}
.commit-card dt {
	color: var(--app-text-muted);
	font-weight: 700;
}
.commit-card dd {
	margin: 0;
	overflow-wrap: anywhere;
}
.commit-card ul {
	display: grid;
	gap: var(--space-2);
	padding-inline-start: var(--space-5);
}
.commit-card__actions {
	display: flex;
	flex-wrap: wrap;
	gap: var(--space-4);
}
@media (max-width: 520px) {
	.commit-card dl div {
		grid-template-columns: 1fr;
		gap: var(--space-1);
	}
}
</style>
