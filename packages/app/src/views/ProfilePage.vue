<template>
	<ion-page>
		<page-header back="/profiles" title="Profile" />
		<ion-content :fullscreen="true">
			<main id="page-content" class="profile-page page-frame page-frame--narrow">
				<request-state
					:error="identityRequest.error.value"
					:loading="identityRequest.phase.value === 'loading'"
					:retry-in-ms="identityRequest.retryInMs.value"
					noun="profile"
					@retry="identityRequest.retry" />

				<template v-if="identityRequest.data.value">
					<header class="profile-identity">
						<div class="profile-identity__avatar">
							<img v-if="avatarUrl" :alt="`${displayHandle}'s avatar`" :src="avatarUrl" />
							<span v-else aria-hidden="true">{{ initial }}</span>
						</div>
						<div>
							<a
								class="profile-identity__canonical section-label"
								:href="tangledProfileUrl"
								rel="noopener noreferrer"
								target="_blank">
								Open in Tangled
								<ion-icon :icon="openOutline" aria-hidden="true" />
							</a>
							<h1>{{ displayHandle }}</h1>
							<code>{{ identityRequest.data.value.did }}</code>
							<p v-if="identityRequest.data.value.handle === 'handle.invalid'" class="profile-identity__warning">
								This account does not currently have a verified handle.
							</p>
						</div>
					</header>
					<nav class="profile-links" aria-label="Profile views">
						<router-link :to="links.actorActivity(actor, 'comments')">Browse public activity</router-link>
						<router-link :to="links.actorRelationships(actor)">Browse relationships</router-link>
						<router-link :to="links.infrastructureFor(identity.did)">Owned services</router-link>
						<router-link :to="links.publicKeys(identity.did)">Public keys</router-link>
					</nav>

					<section class="profile-section" aria-labelledby="about-heading">
						<p class="section-label">About</p>
						<h2 id="about-heading" class="sr-only">About this person</h2>
						<request-state
							:error="profileRequest.error.value"
							:loading="profileRequest.phase.value === 'loading'"
							:retry-in-ms="profileRequest.retryInMs.value"
							noun="profile details"
							@retry="profileRequest.retry" />
						<div v-if="profile" class="profile-details">
							<div>
								<p v-if="profile.description" class="profile-details__bio">{{ profile.description }}</p>
								<dl v-if="profile.location || profile.pronouns">
									<div v-if="profile.location">
										<dt>Location</dt>
										<dd>{{ profile.location }}</dd>
									</div>
									<div v-if="profile.pronouns">
										<dt>Pronouns</dt>
										<dd>{{ profile.pronouns }}</dd>
									</div>
								</dl>
								<ul
									v-if="safeLinks.length || (profile.bluesky && identity.handle !== 'handle.invalid')"
									class="profile-details__links"
									aria-label="Links">
									<li v-for="link in safeLinks" :key="link">
										<a :href="link" rel="noopener noreferrer" target="_blank">{{ linkLabel(link) }}</a>
									</li>
									<li v-if="profile.bluesky && identity.handle !== 'handle.invalid'">
										<a :href="`https://bsky.app/profile/${identity.did}`" rel="noopener noreferrer" target="_blank">
											Bluesky
										</a>
									</li>
								</ul>
							</div>
						</div>
					</section>

					<pinned-repositories
						v-if="profile?.pinnedRepositories?.length"
						:did="identity.did"
						:pds="identity.pds"
						:repositories="profile.pinnedRepositories" />
					<owned-repositories :did="identity.did" :pds="identity.pds" />
				</template>
			</main>
		</ion-content>
	</ion-page>
</template>

<script setup lang="ts">
import { useBobbinClientProvider } from '@/lib/api'
import PageHeader from '@/components/PageHeader.vue'
import RequestState from '@/components/RequestState.vue'
import OwnedRepositories from '@/features/profiles/OwnedRepositories.vue'
import PinnedRepositories from '@/features/profiles/PinnedRepositories.vue'
import { useRouteRequest } from '@/lib/requests'
import { links } from '@/lib/router/links'
import { useObjectUrl } from '@vueuse/core'
import { IonContent, IonIcon, IonPage } from '@ionic/vue'
import { openOutline } from 'ionicons/icons'
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const getClient = useBobbinClientProvider()
const actor = computed(() => String(route.params.actor ?? ''))
const identityRequest = useRouteRequest(actor, (identifier, signal, attempt) =>
	getClient().resolveIdentity(identifier as Parameters<ReturnType<typeof getClient>['resolveIdentity']>[0], {
		signal,
		cache: attempt.cache,
	}),
)
const identity = computed(() => identityRequest.data.value!)
const profileRequest = useRouteRequest(
	computed(() => identityRequest.data.value?.did),
	async (did, signal, attempt) => {
		if (!did) return undefined
		return getClient().getProfile(`at://${did}/sh.tangled.actor.profile/self`, { signal, cache: attempt.cache })
	},
)
const profile = computed(() => profileRequest.data.value?.value)
const displayHandle = computed(() => {
	const current = identityRequest.data.value
	return current?.handle && current.handle !== 'handle.invalid' ? `@${current.handle}` : 'Tangled account'
})
const tangledProfileUrl = computed(() => {
	const identifier = identity.value.handle !== 'handle.invalid' ? identity.value.handle : identity.value.did
	return `https://tangled.org/@${encodeURIComponent(identifier)}`
})
const initial = computed(() =>
	identityRequest.data.value?.handle === 'handle.invalid' ? '?' : displayHandle.value.slice(1, 2).toUpperCase(),
)
const safeLinks = computed(() => (profile.value?.links ?? []).filter((link) => /^https?:\/\//i.test(link)))
const avatarCid = computed(() => {
	const avatar = profile.value?.avatar
	return avatar && 'ref' in avatar ? avatar.ref.$link : avatar && 'cid' in avatar ? avatar.cid : undefined
})
const avatarRequestKey = computed(() =>
	JSON.stringify([identityRequest.data.value?.pds, identityRequest.data.value?.did, avatarCid.value]),
)
const avatarRequest = useRouteRequest(avatarRequestKey, async (_key, signal) => {
	const currentIdentity = identityRequest.data.value
	const cid = avatarCid.value
	if (!currentIdentity || !cid) return undefined
	return getClient().getProfileAvatar(currentIdentity.pds, currentIdentity.did, cid, { signal })
})
const avatarUrl = useObjectUrl(computed(() => avatarRequest.data.value))

function linkLabel(link: string): string {
	try {
		return new URL(link).hostname
	} catch {
		return link
	}
}
</script>

<style scoped>
.profile-page {
	display: grid;
	gap: var(--space-10);
}
.profile-identity {
	display: grid;
	grid-template-columns: auto minmax(0, 1fr);
	align-items: center;
	gap: var(--space-5);
}
.profile-identity__avatar {
	display: grid;
	place-items: center;
	inline-size: clamp(4.5rem, 15vw, 7rem);
	aspect-ratio: 1;
	border: 2px solid var(--app-accent);
	border-radius: 50%;
	color: var(--app-accent);
	background: var(--app-surface);
	font-family: var(--font-display);
	font-size: clamp(2rem, 7vw, 3.5rem);
	font-weight: 800;
	overflow: hidden;
}
.profile-identity__avatar img {
	inline-size: 100%;
	block-size: 100%;
	object-fit: cover;
}
.profile-identity h1 {
	margin: 0;
	font-family: var(--font-display);
	font-size: clamp(2.5rem, 8vw, 4.5rem);
	letter-spacing: -0.055em;
	overflow-wrap: anywhere;
}
.profile-identity__canonical {
	display: inline-flex;
	align-items: center;
	gap: var(--space-2);
	inline-size: fit-content;
	text-decoration-thickness: 1px;
}
.profile-identity__canonical ion-icon {
	font-size: 1rem;
}
.profile-identity code {
	display: block;
	margin-block-start: var(--space-2);
	color: var(--app-text-muted);
	font-size: var(--text-sm);
	overflow-wrap: anywhere;
}
.profile-identity__warning {
	color: var(--app-warning);
}
.profile-links {
	display: flex;
	flex-wrap: wrap;
	gap: var(--space-3);
}
.profile-links a {
	display: inline-flex;
	align-items: center;
	min-block-size: 44px;
	border: 1px solid var(--app-border);
	border-radius: var(--radius-sm);
	padding-inline: var(--space-4);
	text-decoration: none;
}
.profile-section {
	display: grid;
	gap: var(--space-4);
}
.profile-details {
	display: block;
	gap: var(--space-5);
}
.profile-details__bio {
	max-inline-size: 42rem;
	margin: 0;
	font-size: var(--text-lg);
	line-height: 1.6;
	white-space: pre-wrap;
}
.profile-details dl {
	display: flex;
	flex-wrap: wrap;
	gap: var(--space-5);
}
.profile-details dl div {
	display: grid;
	gap: var(--space-1);
}
.profile-details dt {
	color: var(--app-text-muted);
	font-size: var(--text-xs);
	font-weight: 700;
	text-transform: uppercase;
}
.profile-details dd {
	margin: 0;
}
.profile-details__links {
	display: flex;
	flex-wrap: wrap;
	gap: var(--space-4);
	margin: 0;
	padding: 0;
	list-style: none;
}
</style>
