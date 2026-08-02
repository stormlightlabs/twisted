<template>
	<ion-page>
		<page-header back="/infrastructure" title="Labels" />
		<ion-content :fullscreen="true">
			<main id="page-content" class="labels-page page-frame page-frame--narrow">
				<header>
					<p class="section-label">Public metadata</p>
					<h1>Labels</h1>
					<p>Definitions and recorded changes for this exact scope.</p>
					<copyable-identifier :value="scope" noun="scope" />
				</header>
				<coverage-notice :coverage="coverageRequest.data.value" />

				<section aria-labelledby="definitions-heading">
					<h2 id="definitions-heading">Definitions</h2>
					<request-state
						:empty="definitionsRequest.phase.value === 'empty'"
						empty-message="No label definitions are indexed for this scope."
						:error="definitionsRequest.error.value"
						:loading="definitionsRequest.phase.value === 'loading'"
						noun="label definitions"
						@retry="definitionsRequest.retry" />
					<ul v-if="definitions.length" class="definition-list">
						<li
							v-for="definition in definitions"
							:id="definitionAnchor(definition.uri)"
							:key="definition.uri"
							:class="{ 'is-selected': definition.uri === selectedDefinition }">
							<header>
								<div>
									<span
										v-if="safeColor(definition.value.color)"
										:style="{ backgroundColor: safeColor(definition.value.color) }"
										aria-hidden="true"></span>
									<h3>{{ definition.value.name }}</h3>
								</div>
								<router-link :to="links.labels(scope, definition.uri)">Inspect</router-link>
							</header>
							<dl>
								<div>
									<dt>Author</dt>
									<dd>
										<router-link :to="links.profile(recordAuthor(definition.uri))">{{
											recordAuthor(definition.uri)
										}}</router-link>
									</dd>
								</div>
								<div>
									<dt>Value</dt>
									<dd>{{ definition.value.valueType.type }} · {{ definition.value.valueType.format }}</dd>
								</div>
								<div>
									<dt>Applies to</dt>
									<dd>{{ definition.value.scope.join(', ') || 'Any record type' }}</dd>
								</div>
								<div>
									<dt>Repeatable</dt>
									<dd>{{ definition.value.multiple ? 'Yes' : 'No' }}</dd>
								</div>
							</dl>
							<copyable-identifier :value="definition.uri" noun="definition identifier" />
						</li>
					</ul>
					<request-state
						:error="definitionPages.error.value"
						:has-content="true"
						noun="more label definitions"
						@retry="definitionPages.loadMore" />
					<button
						v-if="definitionPages.cursor.value"
						class="load-more"
						:disabled="definitionPages.loading.value"
						type="button"
						@click="definitionPages.loadMore">
						{{ definitionPages.loading.value ? 'Loading…' : 'Load more definitions' }}
					</button>
				</section>

				<section aria-labelledby="history-heading">
					<h2 id="history-heading">Operation history</h2>
					<p v-if="selectedDefinition" class="history-filter">
						Showing changes that reference the selected definition.
						<router-link :to="links.labels(scope)">Clear filter</router-link>
					</p>
					<request-state
						:empty="operationsRequest.phase.value === 'empty' || visibleOperations.length === 0"
						empty-message="No public label changes match this scope and definition."
						:error="operationsRequest.error.value"
						:loading="operationsRequest.phase.value === 'loading'"
						noun="label operations"
						@retry="operationsRequest.retry" />
					<ol v-if="visibleOperations.length" class="operation-list">
						<li v-for="operation in visibleOperations" :key="operation.uri">
							<div>
								<strong>{{ operation.value.add.length ? 'Added' : 'Removed' }} labels</strong>
								<time :datetime="operation.value.performedAt">{{ formatDate(operation.value.performedAt) }}</time>
							</div>
							<p>
								By
								<router-link :to="links.profile(recordAuthor(operation.uri))">{{
									recordAuthor(operation.uri)
								}}</router-link>
							</p>
							<p>
								Target:
								<router-link
									v-if="localRecordLink(operation.value.subject)"
									:to="localRecordLink(operation.value.subject)!"
									><code>{{ operation.value.subject }}</code></router-link
								><code v-else>{{ operation.value.subject }}</code>
							</p>
							<ul>
								<li v-for="operand in operation.value.add" :key="`add:${operand.key}:${operand.value}`">
									+ <router-link :to="links.labels(scope, operand.key)">{{ definitionName(operand.key) }}</router-link
									>: {{ operand.value }}
								</li>
								<li v-for="operand in operation.value.delete" :key="`delete:${operand.key}:${operand.value}`">
									− <router-link :to="links.labels(scope, operand.key)">{{ definitionName(operand.key) }}</router-link
									>: {{ operand.value }}
								</li>
							</ul>
						</li>
					</ol>
					<request-state
						:error="operationPages.error.value"
						:has-content="true"
						noun="more label operations"
						@retry="operationPages.loadMore" />
					<button
						v-if="operationPages.cursor.value"
						class="load-more"
						:disabled="operationPages.loading.value"
						type="button"
						@click="operationPages.loadMore">
						{{ operationPages.loading.value ? 'Loading…' : 'Load more history' }}
					</button>
				</section>
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
import { useBobbinClientProvider } from '@/lib/api'
import { useCursorPagination, useRouteRequest } from '@/lib/requests'
import { links } from '@/lib/router/links'
import { IonContent, IonPage } from '@ionic/vue'
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const getClient = useBobbinClientProvider()
const scope = computed(() => String(route.params.scope ?? ''))
const selectedDefinition = computed(() => String(route.query.definition ?? ''))
const definitionsRequest = useRouteRequest(
	scope,
	(value, signal, attempt) =>
		getClient().listLabelDefinitions(value, { signal, cache: attempt.cache, limit: 1000, order: 'asc' }),
	{ isEmpty: (page) => page.items.length === 0 },
)
const operationsRequest = useRouteRequest(
	scope,
	(value, signal, attempt) => getClient().listLabelOperations(value, { signal, cache: attempt.cache, limit: 1000 }),
	{ isEmpty: (page) => page.items.length === 0 },
)
const coverageRequest = useRouteRequest(scope, (_value, signal, attempt) =>
	getClient().getCoverage({ signal, cache: attempt.cache }),
)
const definitionPages = useCursorPagination(
	scope,
	definitionsRequest.data,
	(value, cursor, signal) => getClient().listLabelDefinitions(value, { cursor, signal, limit: 1000, order: 'asc' }),
	(item) => item.uri,
)
const operationPages = useCursorPagination(
	scope,
	operationsRequest.data,
	(value, cursor, signal) => getClient().listLabelOperations(value, { cursor, signal, limit: 1000 }),
	(item) => item.uri,
)
const definitions = definitionPages.items
const visibleOperations = computed(() => {
	const items = operationPages.items.value
	if (!selectedDefinition.value) return items
	return items.filter((item) =>
		[...item.value.add, ...item.value.delete].some((operand) => operand.key === selectedDefinition.value),
	)
})

function recordAuthor(uri: string): string {
	return parseAtUri(uri)?.authority ?? 'Unknown actor'
}
function definitionName(uri: string): string {
	return definitions.value.find((item) => item.uri === uri)?.value.name ?? uri
}
function definitionAnchor(uri: string): string {
	return `definition-${encodeURIComponent(uri).replaceAll('%', '-')}`
}
function safeColor(value: string | undefined): string | undefined {
	return value && /^#[0-9a-f]{6}$/i.test(value) ? value : undefined
}
function formatDate(value: string): string {
	return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}
</script>

<style scoped>
.labels-page {
	display: grid;
	gap: var(--space-8);
}
.labels-page > header {
	display: grid;
	gap: var(--space-3);
}
.labels-page h1,
.labels-page > header p {
	margin: 0;
}
.labels-page h1 {
	font-size: clamp(var(--text-2xl), 5vw, 2.7rem);
}
.labels-page > header > p:not(.section-label),
.history-filter {
	color: var(--app-text-muted);
}
section {
	display: grid;
	gap: var(--space-4);
}
section > h2 {
	margin: 0;
}
.definition-list,
.operation-list {
	display: grid;
	gap: var(--space-4);
	margin: 0;
	padding: 0;
	list-style: none;
}
.definition-list > li {
	display: grid;
	gap: var(--space-4);
	border: 1px solid var(--app-border);
	border-radius: var(--radius-md);
	padding: var(--space-5);
	background: var(--app-surface);
}
.definition-list > li.is-selected {
	border-inline-start: 4px solid var(--app-accent);
}
.definition-list header,
.definition-list header div,
.operation-list > li > div {
	display: flex;
	justify-content: space-between;
	align-items: center;
	gap: var(--space-3);
}
.definition-list header span {
	inline-size: 1rem;
	block-size: 1rem;
	border: 1px solid var(--app-border);
	border-radius: 999px;
}
.definition-list h3 {
	margin: 0;
}
dl {
	display: grid;
	grid-template-columns: repeat(2, minmax(0, 1fr));
	gap: var(--space-4);
	margin: 0;
}
dt {
	color: var(--app-text-muted);
	font-size: var(--text-sm);
}
dd {
	margin: var(--space-1) 0 0;
	overflow-wrap: anywhere;
}
.operation-list > li {
	border-block-start: 1px solid var(--app-border);
	padding-block: var(--space-5);
}
.operation-list p {
	overflow-wrap: anywhere;
}
.operation-list time {
	color: var(--app-text-muted);
}
.operation-list ul {
	padding-inline-start: var(--space-5);
}
@media (max-width: 38rem) {
	dl {
		grid-template-columns: 1fr;
	}
	.definition-list header,
	.operation-list > li > div {
		align-items: start;
		flex-direction: column;
	}
}
</style>
