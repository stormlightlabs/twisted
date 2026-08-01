<template>
	<ion-page>
		<page-header :back="backPath" :title="title" />
		<ion-content :fullscreen="true">
			<main id="page-content" class="domain-page page-frame page-frame--narrow">
				<p class="section-label">{{ section }}</p>
				<h1>{{ title }}</h1>
				<p class="domain-page__summary">{{ description }}</p>

				<div v-if="identifier && supported" class="identifier-block">
					<span>{{ identifierLabel }}</span>
					<code>{{ identifier }}</code>
				</div>

				<section v-if="!supported" class="recovery-state" aria-labelledby="unsupported-heading">
					<ion-icon :icon="warningOutline" aria-hidden="true" />
					<div>
						<h2 id="unsupported-heading">This identifier is not supported</h2>
						<p>{{ recovery }}</p>
						<div class="recovery-state__actions">
							<router-link to="/search">Try search</router-link>
							<router-link to="/">Return home</router-link>
						</div>
					</div>
				</section>

				<section v-else class="route-notice">
					<strong>{{ identifier ? 'Deep link recognized' : 'Destination ready' }}</strong>
					<p>
						This stable route is part of the application shell. Its live Bobbin data view is implemented in the
						corresponding feature ticket.
					</p>
				</section>
			</main>
		</ion-content>
	</ion-page>
</template>

<script setup lang="ts">
import PageHeader from '@/components/PageHeader.vue'
import { IonContent, IonIcon, IonPage } from '@ionic/vue'
import { warningOutline } from 'ionicons/icons'
import { computed } from 'vue'
import { useRoute } from 'vue-router'

type Requirement = 'actor' | 'at-uri' | 'did' | 'host' | 'rkey' | 'text'

const route = useRoute()
const metadata = computed(() => route.meta as Record<string, unknown>)
const title = computed(() => String(metadata.value.title ?? 'Twisted'))
const section = computed(() => String(metadata.value.section ?? 'Explore'))
const description = computed(() => String(metadata.value.description ?? 'Browse public Tangled data.'))
const identifierLabel = computed(() => String(metadata.value.identifierLabel ?? 'Identifier'))
const parameter = computed(() => (typeof metadata.value.parameter === 'string' ? metadata.value.parameter : undefined))
const identifier = computed(() => {
	const value = parameter.value === undefined ? undefined : route.params[parameter.value]
	return Array.isArray(value) ? value.join('/') : value
})
const requirement = computed(() => metadata.value.requirement as Requirement | undefined)
const supported = computed(() => identifier.value === undefined || isSupported(identifier.value, requirement.value))
const recovery = computed(() => {
	if (requirement.value === 'actor') return 'Use a DID or a domain-style handle such as desertthunder.dev.'
	if (requirement.value === 'at-uri')
		return 'Use a complete at:// URI. Paths and references belong in route query parameters.'
	if (requirement.value === 'did') return 'Use a complete decentralized identifier beginning with did:.'
	return 'Check the value, or use search to find the public record.'
})
const backPath = computed(() => (typeof metadata.value.back === 'string' ? metadata.value.back : undefined))

function isSupported(value: string, expected: Requirement | undefined): boolean {
	if (expected === undefined) return true
	if (expected === 'actor')
		return (
			/^did:[a-z0-9]+:[^\s/]+$/i.test(value) ||
			/^(?=.{1,253}$)[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}$/i.test(value)
		)
	if (expected === 'at-uri') return /^at:\/\/[^/\s]+\/[a-z][a-z0-9.-]+\/[a-zA-Z0-9._~:-]+$/.test(value)
	if (expected === 'did') return /^did:[a-z0-9]+:[^\s/]+$/i.test(value)
	if (expected === 'host') {
		try {
			const url = new URL(value.includes('://') ? value : `https://${value}`)
			return url.protocol === 'https:' && url.hostname.length > 0
		} catch {
			return false
		}
	}
	if (expected === 'rkey') return /^[a-zA-Z0-9._~:-]{1,512}$/.test(value)
	return value.trim().length > 0
}
</script>

<style scoped>
.domain-page h1 {
	max-inline-size: 16ch;
	margin: 0;
	font-family: var(--font-display);
	font-size: clamp(2.5rem, 8vw, 4.5rem);
	letter-spacing: -0.055em;
	line-height: 1;
	text-wrap: balance;
}

.domain-page__summary {
	max-inline-size: 42rem;
	margin-block: var(--space-4) var(--space-8);
	color: var(--app-text-muted);
	font-size: var(--text-lg);
	line-height: 1.6;
}

.identifier-block {
	display: grid;
	gap: var(--space-2);
	margin-block-end: var(--space-6);
}

.identifier-block span {
	color: var(--app-text-muted);
	font-size: var(--text-xs);
	font-weight: 700;
	text-transform: uppercase;
}

.identifier-block code {
	padding: var(--space-4);
	border: 1px solid var(--app-border);
	border-radius: var(--radius-sm);
	background: var(--app-surface);
	overflow-wrap: anywhere;
}
</style>
