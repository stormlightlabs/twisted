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
						<div class="profile-identity__avatar" aria-hidden="true">{{ initial }}</div>
						<div>
							<p class="section-label">Public profile</p>
							<h1>{{ displayHandle }}</h1>
							<code>{{ identityRequest.data.value.did }}</code>
							<p v-if="identityRequest.data.value.handle === 'handle.invalid'" class="profile-identity__warning">
								This account does not currently have a verified handle.
							</p>
						</div>
					</header>

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
							<img v-if="avatarUrl" :alt="`${displayHandle}'s avatar`" :src="avatarUrl" />
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
										<a :href="`https://bsky.app/profile/${identity.did}`" rel="noopener noreferrer" target="_blank"
											>Bluesky</a
										>
									</li>
								</ul>
							</div>
						</div>
					</section>

					<pinned-repositories v-if="profile?.pinnedRepositories?.length" :repositories="profile.pinnedRepositories" />
					<owned-repositories :did="identity.did" />
				</template>
			</main>
		</ion-content>
	</ion-page>
</template>

<script setup lang="ts">
import { useBobbinClientProvider } from '@/api'
import PageHeader from '@/components/PageHeader.vue'
import RequestState from '@/components/RequestState.vue'
import OwnedRepositories from '@/features/profiles/OwnedRepositories.vue'
import PinnedRepositories from '@/features/profiles/PinnedRepositories.vue'
import { useRouteRequest } from '@/requests'
import { IonContent, IonPage } from '@ionic/vue'
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
const initial = computed(() =>
	identityRequest.data.value?.handle === 'handle.invalid' ? '?' : displayHandle.value.slice(1, 2).toUpperCase(),
)
const safeLinks = computed(() => (profile.value?.links ?? []).filter((link) => /^https?:\/\//i.test(link)))
const avatarUrl = computed(() => {
	const avatar = profile.value?.avatar
	const cid = avatar && 'ref' in avatar ? avatar.ref.$link : avatar && 'cid' in avatar ? avatar.cid : undefined
	if (!cid || !identityRequest.data.value) return undefined
	try {
		const url = new URL('/xrpc/com.atproto.sync.getBlob', identityRequest.data.value.pds)
		if (url.protocol !== 'https:') return undefined
		url.searchParams.set('did', identityRequest.data.value.did)
		url.searchParams.set('cid', cid)
		return url.href
	} catch {
		return undefined
	}
})

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
}
.profile-identity h1 {
	margin: 0;
	font-family: var(--font-display);
	font-size: clamp(2.5rem, 8vw, 4.5rem);
	letter-spacing: -0.055em;
	overflow-wrap: anywhere;
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
.profile-section {
	display: grid;
	gap: var(--space-4);
}
.profile-details {
	display: grid;
	grid-template-columns: auto minmax(0, 1fr);
	gap: var(--space-5);
}
.profile-details img {
	inline-size: 7rem;
	aspect-ratio: 1;
	border-radius: var(--radius-md);
	object-fit: cover;
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
@media (max-width: 520px) {
	.profile-details {
		grid-template-columns: 1fr;
	}
	.profile-details img {
		inline-size: 5rem;
	}
}
</style>
