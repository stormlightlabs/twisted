<template>
	<ion-page>
		<page-header :back="listBack" :title="isPull ? 'Pull request' : 'Issue'" />
		<ion-content :fullscreen="true">
			<main id="page-content" class="work-item-page page-frame page-frame--narrow">
				<repository-navigation :repo="repo" />
				<request-state
					:error="recordRequest.error.value"
					:loading="recordRequest.phase.value === 'loading'"
					:noun="isPull ? 'pull request' : 'issue'"
					@retry="recordRequest.retry" />

				<template v-if="record">
					<record-header
						:author="recordAuthor(record.uri)"
						:collection="isPull ? 'Pull request' : 'Issue'"
						:title="record.value.title"
						:uri="record.uri" />

					<div class="work-item-summary">
						<span class="state-badge">{{ currentState }}</span>
						<code>{{ rkey }}</code>
						<time :datetime="record.value.createdAt">{{ formatRecordDate(record.value.createdAt) }}</time>
					</div>

					<markdown-content v-if="record.value.body" :repo="repo" :source="record.value.body" />
					<p v-else class="compact-empty">No description was provided.</p>

					<section v-if="isPull && pullRecord" class="work-item-panel" aria-labelledby="branches-heading">
						<h2 id="branches-heading">Branches</h2>
						<dl>
							<div>
								<dt>Target</dt>
								<dd>
									<router-link :to="links.source(repo, pullRecord.target.branch)">{{
										pullRecord.target.branch
									}}</router-link>
									<span>{{ pullRecord.target.repo }}</span>
								</dd>
							</div>
							<div v-if="pullRecord.source">
								<dt>Source</dt>
								<dd>
									<router-link
										:to="
											pullRecord.source.repo && pullRecord.source.repo !== pullRecord.target.repo
												? links.search(pullRecord.source.repo)
												: links.source(repo, pullRecord.source.branch)
										">
										{{ pullRecord.source.branch }}
									</router-link>
									<span v-if="pullRecord.source.repo">{{ pullRecord.source.repo }}</span>
								</dd>
							</div>
						</dl>
						<router-link
							v-if="pullRecord.source"
							class="compare-link"
							:to="links.compare(repo, pullRecord.target.branch, pullRecord.source.branch)"
							>Compare source and target</router-link
						>
						<p v-if="pullRecord.rounds.length">{{ pullRecord.rounds.length }} published patch round(s)</p>
					</section>

					<section v-if="record.value.mentions?.length || record.value.references?.length" class="work-item-panel">
						<h2>Links from this record</h2>
						<ul>
							<li v-for="mention in record.value.mentions" :key="mention">
								Mention: <router-link :to="links.profile(mention)">{{ mention }}</router-link>
							</li>
							<li v-for="reference in record.value.references" :key="reference">
								Reference: <router-link :to="links.search(reference)">{{ reference }}</router-link>
							</li>
						</ul>
					</section>

					<section class="work-item-panel" aria-labelledby="history-heading">
						<h2 id="history-heading">{{ isPull ? 'Status' : 'State' }} history</h2>
						<request-state
							:empty="historyRequest.phase.value === 'empty'"
							:empty-message="`No ${isPull ? 'status' : 'state'} changes are indexed.`"
							:error="historyRequest.error.value"
							:loading="historyRequest.phase.value === 'loading'"
							:noun="`${isPull ? 'status' : 'state'} changes`"
							@retry="historyRequest.retry" />
						<ol v-if="history.length" class="history-list">
							<li v-for="entry in history" :key="entry.uri">
								<strong>{{ historyState(entry.value) }}</strong>
								<span
									>by
									<router-link :to="links.profile(recordAuthor(entry.uri))">{{
										recordAuthor(entry.uri)
									}}</router-link></span
								>
								<time :datetime="entry.value.createdAt">{{ formatRecordDate(entry.value.createdAt) }}</time>
							</li>
						</ol>
					</section>

					<section class="work-item-panel" aria-labelledby="labels-heading">
						<h2 id="labels-heading">Labels</h2>
						<request-state
							:empty="labelsRequest.phase.value === 'empty'"
							empty-message="No public label changes are indexed."
							:error="labelsRequest.error.value"
							:loading="labelsRequest.phase.value === 'loading'"
							noun="label changes"
							@retry="labelsRequest.retry" />
						<ul v-if="labelChanges.length" class="label-changes">
							<li v-for="change in labelChanges" :key="change.key">
								{{ change.action }} <code>{{ change.key }}</code>
								<span v-if="change.value">({{ change.value }})</span>
							</li>
						</ul>
					</section>

					<discussion-section :repo="repo" :subject="record.uri" />
				</template>
			</main>
		</ion-content>
	</ion-page>
</template>

<script setup lang="ts">
import MarkdownContent from '@/components/MarkdownContent.vue'
import PageHeader from '@/components/PageHeader.vue'
import RecordHeader from '@/components/RecordHeader.vue'
import RequestState from '@/components/RequestState.vue'
import DiscussionSection from '@/features/collaboration/DiscussionSection.vue'
import { formatRecordDate, recordAuthor, shortState } from '@/features/collaboration/records'
import RepositoryNavigation from '@/features/repositories/RepositoryNavigation.vue'
import { useRepositoryRoute } from '@/features/repositories/useRepositoryRoute'
import type { CursorPage, ValidatedRecordView } from '@/lib/api'
import { useRouteRequest } from '@/lib/requests'
import { links } from '@/lib/router/links'
import type {
	ShTangledRepoIssue,
	ShTangledRepoIssueState,
	ShTangledRepoPull,
	ShTangledRepoPullStatus,
} from '@atcute/tangled'
import { IonContent, IonPage } from '@ionic/vue'
import { computed } from 'vue'
import { useRouter } from 'vue-router'

type WorkRecord = ValidatedRecordView<ShTangledRepoIssue.Main | ShTangledRepoPull.Main>
type HistoryRecord = ValidatedRecordView<ShTangledRepoIssueState.Main | ShTangledRepoPullStatus.Main>

const { getClient, repo, route } = useRepositoryRoute()
const router = useRouter()
const isPull = computed(() => route.name === 'pull')
const rkey = computed(() => String(route.params.rkey ?? ''))
const author = computed(() => String(route.query.author ?? ''))
const fallbackAuthor = computed(() => repo.value.match(/^at:\/\/([^/]+)/)?.[1] ?? '')
const recordUri = computed(() => {
	const did = author.value || fallbackAuthor.value
	if (!did || !rkey.value) return ''
	return `at://${did}/${isPull.value ? 'sh.tangled.repo.pull' : 'sh.tangled.repo.issue'}/${rkey.value}`
})
const listBack = computed(() => router.resolve(isPull.value ? links.pulls(repo.value) : links.issues(repo.value)).href)
const recordRequest = useRouteRequest<WorkRecord | undefined, string>(recordUri, async (uri, signal, attempt) => {
	if (!uri) return undefined
	const result = isPull.value
		? await getClient().getPull(uri as Parameters<ReturnType<typeof getClient>['getPull']>[0], {
				signal,
				cache: attempt.cache,
			})
		: await getClient().getIssue(uri as Parameters<ReturnType<typeof getClient>['getIssue']>[0], {
				signal,
				cache: attempt.cache,
			})
	return result as WorkRecord
})
const record = computed(() => recordRequest.data.value)
const pullRecord = computed(() =>
	record.value?.value.$type === 'sh.tangled.repo.pull' ? record.value.value : undefined,
)
const historyRequest = useRouteRequest<CursorPage<HistoryRecord>, string>(
	recordUri,
	async (uri, signal, attempt) => {
		if (!uri) return { items: [] }
		const result = isPull.value
			? await getClient().listPullStatuses(uri as Parameters<ReturnType<typeof getClient>['listPullStatuses']>[0], {
					signal,
					cache: attempt.cache,
					order: 'desc',
				})
			: await getClient().listIssueStates(uri as Parameters<ReturnType<typeof getClient>['listIssueStates']>[0], {
					signal,
					cache: attempt.cache,
					order: 'desc',
				})
		return result as CursorPage<HistoryRecord>
	},
	{ isEmpty: (page) => page.items.length === 0 },
)
const history = computed(() => historyRequest.data.value?.items ?? [])
const currentState = computed(() => historyState(history.value[0]?.value))
const labelsRequest = useRouteRequest(
	recordUri,
	(uri, signal, attempt) =>
		uri
			? getClient().listLabelOperations(uri, { signal, cache: attempt.cache, limit: 100, order: 'asc' })
			: Promise.resolve({ items: [] }),
	{ isEmpty: (page) => page.items.length === 0 },
)
const labelChanges = computed(() =>
	(labelsRequest.data.value?.items ?? []).flatMap((item) => [
		...item.value.add.map((operand) => ({ action: 'Added', key: operand.key, value: operand.value })),
		...item.value.delete.map((operand) => ({ action: 'Removed', key: operand.key, value: operand.value })),
	]),
)

function historyState(value: { readonly state?: string; readonly status?: string } | undefined): string {
	if (!value) return 'open'
	return shortState(
		typeof value.status === 'string' ? value.status : typeof value.state === 'string' ? value.state : undefined,
	)
}
</script>

<style scoped>
.work-item-page,
.work-item-panel {
	display: grid;
	gap: var(--space-5);
}
.work-item-summary {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: var(--space-3);
	color: var(--app-text-muted);
}
.state-badge {
	border-radius: 999px;
	padding: var(--space-1) var(--space-3);
	color: var(--app-accent-contrast);
	background: var(--app-accent);
	font-weight: 800;
	text-transform: capitalize;
}
.work-item-panel {
	border-block-start: 1px solid var(--app-border);
	padding-block-start: var(--space-6);
}
.work-item-panel h2 {
	margin: 0;
}
.work-item-panel dl,
.work-item-panel ul,
.history-list {
	margin: 0;
	padding: 0;
	list-style: none;
}
.work-item-panel dl {
	display: grid;
	grid-template-columns: repeat(2, minmax(0, 1fr));
	gap: var(--space-4);
}
.work-item-panel dt {
	color: var(--app-text-muted);
	font-size: var(--text-xs);
	font-weight: 800;
	text-transform: uppercase;
}
.work-item-panel dd {
	display: grid;
	gap: var(--space-1);
	margin: var(--space-2) 0 0;
}
.history-list,
.label-changes {
	display: grid;
	gap: var(--space-3);
}
.history-list li {
	display: flex;
	flex-wrap: wrap;
	gap: var(--space-3);
	color: var(--app-text-muted);
}
.history-list strong {
	color: var(--app-text);
	text-transform: capitalize;
}
.compare-link {
	justify-self: start;
}
@media (max-width: 600px) {
	.work-item-panel dl {
		grid-template-columns: 1fr;
	}
}
</style>
