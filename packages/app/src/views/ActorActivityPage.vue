<template>
	<ion-page>
		<page-header :back="profileHref" title="Activity" />
		<ion-content :fullscreen="true">
			<main id="page-content" class="activity-page page-frame page-frame--narrow">
				<request-state
					:error="identityRequest.error.value"
					:loading="identityRequest.phase.value === 'loading'"
					noun="person"
					@retry="identityRequest.retry" />

				<template v-if="identityRequest.data.value">
					<header class="activity-page__heading">
						<p class="section-label">Public activity</p>
						<h1>{{ displayHandle }}</h1>
						<p>Browse public work and conversations by this person.</p>
					</header>

					<nav class="activity-nav" aria-label="Activity type">
						<router-link
							v-for="definition in actorActivityDefinitions"
							:key="definition.kind"
							:aria-current="definition.kind === activeKind ? 'page' : undefined"
							:to="activityLink(definition.kind)">
							{{ definition.label }}
						</router-link>
					</nav>

					<section class="activity-section" :aria-labelledby="`${activeKind}-heading`">
						<header>
							<div>
								<h2 :id="`${activeKind}-heading`">{{ activeDefinition.label }}</h2>
								<p>{{ activeDefinition.description }}</p>
							</div>
							<label v-if="activeKind === 'issues'">
								State
								<select :value="issueState" @change="setFilter('state', $event)">
									<option value="">All</option>
									<option value="open">Open</option>
									<option value="closed">Closed</option>
								</select>
							</label>
							<label v-if="activeKind === 'pulls'">
								Status
								<select :value="pullStatus" @change="setFilter('status', $event)">
									<option value="">All</option>
									<option value="open">Open</option>
									<option value="merged">Merged</option>
									<option value="closed">Closed</option>
								</select>
							</label>
						</header>

						<request-state
							:empty="activityRequest.phase.value === 'empty'"
							empty-message="There is no public activity in this section yet."
							:error="activityRequest.error.value"
							:has-content="activityRequest.hasContent.value"
							:loading="activityRequest.phase.value === 'loading'"
							:noun="activeDefinition.label.toLowerCase()"
							@retry="activityRequest.retry" />

						<ol v-if="items.length" class="activity-list">
							<li v-for="(item, index) in items" :key="item.uri ?? `${activeKind}-${index}`">
								<router-link v-if="itemLink(item.uri)" :to="itemLink(item.uri)!" class="activity-list__record">
									<strong>{{ activityTitle(item.value) }}</strong>
									<p v-if="recordExcerpt(item.value)">{{ recordExcerpt(item.value) }}</p>
									<code v-if="item.uri">{{ item.uri }}</code>
								</router-link>
								<div v-else class="activity-list__record">
									<strong>{{ activityTitle(item.value) }}</strong>
									<p v-if="recordExcerpt(item.value)">{{ recordExcerpt(item.value) }}</p>
									<code v-if="item.uri">{{ item.uri }}</code>
								</div>
								<div class="activity-list__meta">
									<router-link v-if="subjectLink(item.value)" :to="subjectLink(item.value)!">View subject</router-link>
									<time v-if="activityDate(item.value)" :datetime="activityDate(item.value)">{{
										formatDate(activityDate(item.value)!)
									}}</time>
								</div>
							</li>
						</ol>

						<request-state
							:error="nextError"
							:has-content="true"
							:loading="loadingNext"
							noun="more activity"
							@retry="loadNext" />
						<button v-if="nextCursor && !loadingNext" class="activity-section__more" type="button" @click="loadNext">
							Show more
						</button>
					</section>
				</template>
			</main>
		</ion-content>
	</ion-page>
</template>

<script setup lang="ts">
import type { ActorActivityItem, ActorActivityKind, BobbinError } from '@/lib/api'
import { actorActivityKinds, errorFromException, useBobbinClientProvider } from '@/lib/api'
import PageHeader from '@/components/PageHeader.vue'
import RequestState from '@/components/RequestState.vue'
import { localRecordLink } from '@/content/links'
import { actorActivityDefinition, actorActivityDefinitions } from '@/features/activity/actor'
import { recordExcerpt, recordTitle } from '@/features/discovery/records'
import { useRouteRequest } from '@/lib/requests'
import { announce } from '@/lib/browser'
import { links } from '@/lib/router/links'
import { IonContent, IonPage } from '@ionic/vue'
import { computed, ref } from 'vue'
import type { LocationQueryRaw, RouteLocationRaw } from 'vue-router'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()
const getClient = useBobbinClientProvider()
const actor = computed(() => String(route.params.actor ?? ''))
const activeKind = computed<ActorActivityKind>(() => {
	const value = String(route.params.activity ?? '') as ActorActivityKind
	return actorActivityKinds.includes(value) ? value : 'comments'
})
const activeDefinition = computed(() => actorActivityDefinition(activeKind.value))
const issueState = computed(() =>
	route.query.state === 'open' || route.query.state === 'closed' ? route.query.state : '',
)
const pullStatus = computed(() =>
	route.query.status === 'open' || route.query.status === 'closed' || route.query.status === 'merged'
		? route.query.status
		: '',
)
const appended = ref<ActorActivityItem[]>([])
const nextCursor = ref<string>()
const loadingNext = ref(false)
const nextError = ref<BobbinError>()
const requestedCursors = new Set<string>()

const identityRequest = useRouteRequest(actor, (identifier, signal, attempt) =>
	getClient().resolveIdentity(identifier as Parameters<ReturnType<typeof getClient>['resolveIdentity']>[0], {
		signal,
		cache: attempt.cache,
	}),
)
const displayHandle = computed(() => {
	const identity = identityRequest.data.value
	return identity?.handle && identity.handle !== 'handle.invalid' ? `@${identity.handle}` : 'Tangled account'
})
const profileHref = computed(() => router.resolve(links.profile(actor.value)).href)
const requestKey = computed(() =>
	JSON.stringify([identityRequest.data.value?.did, activeKind.value, issueState.value, pullStatus.value]),
)
const activityRequest = useRouteRequest(
	requestKey,
	async (_key, signal, attempt) => {
		appended.value = []
		nextCursor.value = undefined
		nextError.value = undefined
		requestedCursors.clear()
		const did = identityRequest.data.value?.did
		if (!did) return { items: [] as ActorActivityItem[] }
		const page = await getClient().listActorActivity(activeKind.value, did, {
			limit: 10,
			state: issueState.value || undefined,
			status: pullStatus.value || undefined,
			signal,
			cache: attempt.cache,
		})
		nextCursor.value = page.cursor
		return page
	},
	{ isEmpty: (page) => page.items.length === 0 },
)
const items = computed(() => [...(activityRequest.data.value?.items ?? []), ...appended.value])

function activityLink(kind: ActorActivityKind): RouteLocationRaw {
	return { name: 'actor-activity', params: { actor: actor.value, activity: kind } }
}

function setFilter(key: 'state' | 'status', event: Event): void {
	const value = (event.target as HTMLSelectElement).value
	const query: LocationQueryRaw = value ? { [key]: value } : {}
	void router.replace({ name: 'actor-activity', params: { actor: actor.value, activity: activeKind.value }, query })
}

async function loadNext(): Promise<void> {
	const cursor = nextCursor.value
	const did = identityRequest.data.value?.did
	if (!cursor || !did || loadingNext.value || requestedCursors.has(cursor)) return
	requestedCursors.add(cursor)
	loadingNext.value = true
	nextError.value = undefined
	try {
		const page = await getClient().listActorActivity(activeKind.value, did, {
			cursor,
			limit: 10,
			state: issueState.value || undefined,
			status: pullStatus.value || undefined,
		})
		appended.value.push(...page.items)
		nextCursor.value = page.cursor
		announce(
			page.items.length === 1 ? '1 more activity item loaded.' : `${page.items.length} more activity items loaded.`,
		)
	} catch (error) {
		requestedCursors.delete(cursor)
		nextError.value = errorFromException(error)
	} finally {
		loadingNext.value = false
	}
}

function itemLink(uri: string | undefined): RouteLocationRaw | undefined {
	return uri ? localRecordLink(uri) : undefined
}

function subjectLink(value: Record<string, unknown>): RouteLocationRaw | undefined {
	const subject = value.subject
	if (typeof subject === 'string') {
		if (subject.startsWith('at://')) return localRecordLink(subject)
		if (['follows', 'collaborators', 'knot-memberships', 'spindle-memberships'].includes(activeKind.value))
			return links.profile(subject)
	}
	if (typeof subject === 'object' && subject !== null && 'uri' in subject && typeof subject.uri === 'string')
		return localRecordLink(subject.uri)
	for (const field of ['issue', 'pull', 'pipeline', 'workflow', 'repo'] as const) {
		if (typeof value[field] !== 'string') continue
		return value[field].startsWith('at://') ? localRecordLink(value[field]) : links.search(value[field])
	}
	for (const field of ['repoDid', 'sourceRepo'] as const) {
		if (typeof value[field] === 'string') return links.search(value[field])
	}
	return undefined
}

function activityDate(value: Record<string, unknown>): string | undefined {
	for (const field of ['createdAt', 'performedAt'] as const) {
		if (typeof value[field] === 'string') return value[field]
	}
	return undefined
}

function activityTitle(value: Record<string, unknown>): string {
	if (typeof value.reaction === 'string' && value.reaction) return value.reaction
	for (const field of ['status', 'state'] as const) {
		if (typeof value[field] === 'string' && value[field]) return humanizeValue(value[field])
	}
	if (typeof value.ref === 'string' && value.ref) return value.ref
	return recordTitle(value, activeDefinition.value.label)
}

function humanizeValue(value: string): string {
	const label = value.split('.').at(-1)?.replaceAll(/[-_]/g, ' ') ?? value
	return label.charAt(0).toUpperCase() + label.slice(1)
}

function formatDate(value: string): string {
	return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value))
}
</script>

<style scoped>
.activity-page {
	display: grid;
	gap: var(--space-6);
}

.activity-page__heading h1 {
	margin: 0;
	font-family: var(--font-display);
	font-size: clamp(2.5rem, 8vw, 4.5rem);
	letter-spacing: -0.055em;
}

.activity-page__heading > p:last-child,
.activity-section header p {
	color: var(--app-text-muted);
	line-height: 1.5;
}

.activity-nav {
	display: flex;
	gap: var(--space-2);
	padding-block-end: var(--space-2);
	overflow-x: auto;
}

.activity-nav a {
	flex: 0 0 auto;
	min-block-size: 44px;
	border: 1px solid var(--app-border);
	border-radius: 999px;
	padding: var(--space-3) var(--space-4);
	color: var(--app-text-muted);
	text-decoration: none;
}

.activity-nav a[aria-current='page'] {
	border-color: var(--app-accent);
	color: var(--app-accent-contrast);
	background: var(--app-accent);
}

.activity-section {
	display: grid;
	gap: var(--space-4);
}

.activity-section > header {
	display: flex;
	align-items: end;
	justify-content: space-between;
	gap: var(--space-5);
}

.activity-section h2,
.activity-section header p {
	margin: 0;
}

.activity-section h2 {
	font-family: var(--font-display);
	font-size: var(--text-2xl);
}

.activity-section label {
	display: grid;
	gap: var(--space-1);
	font-size: var(--text-sm);
	font-weight: 700;
}

.activity-section select {
	min-block-size: 44px;
	border: 1px solid var(--app-border);
	border-radius: var(--radius-sm);
	padding-inline: var(--space-3);
	color: var(--app-text);
	background: var(--app-surface);
	font: inherit;
}

.activity-list {
	display: grid;
	gap: var(--space-3);
	margin: 0;
	padding: 0;
	list-style: none;
}

.activity-list li {
	border: 1px solid var(--app-border);
	border-radius: var(--radius-md);
	padding: var(--space-5);
	background: var(--app-surface);
}

.activity-list__record {
	display: grid;
	gap: var(--space-2);
	color: var(--app-text);
	text-decoration: none;
}

.activity-list__record strong {
	font-family: var(--font-display);
	font-size: var(--text-lg);
}

.activity-list__record p,
.activity-list__record code {
	margin: 0;
	color: var(--app-text-muted);
	overflow-wrap: anywhere;
}

.activity-list__meta {
	display: flex;
	justify-content: space-between;
	gap: var(--space-4);
	margin-block-start: var(--space-4);
	font-size: var(--text-sm);
}

.activity-list__meta time {
	color: var(--app-text-muted);
}

.activity-section__more {
	justify-self: start;
	min-block-size: 44px;
	border: 0;
	border-radius: var(--radius-sm);
	padding-inline: var(--space-5);
	color: var(--app-accent-contrast);
	background: var(--app-accent);
	font-weight: 750;
}

@media (max-width: 560px) {
	.activity-section > header {
		align-items: stretch;
		flex-direction: column;
	}
}
</style>
