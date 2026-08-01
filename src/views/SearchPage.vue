<template>
	<ion-page>
		<page-header title="Search" />
		<ion-content :fullscreen="true">
			<main id="page-content" class="search-page page-frame page-frame--narrow">
				<p class="section-label">Discovery</p>
				<h1>Search Tangled</h1>
				<p>Enter a handle, DID, repository AT-URI, or words from a public record.</p>
				<form class="search-page__form" role="search" @submit.prevent="submit">
					<label for="search-query">Search or identifier</label>
					<div>
						<input id="search-query" v-model="query" autofocus placeholder="desertthunder.dev" />
						<button type="submit">Search</button>
					</div>
				</form>
				<div v-if="submitted" class="route-notice">
					<strong>Search route ready</strong>
					<p>Result loading arrives in T08. Your query is preserved in this shareable URL.</p>
				</div>
			</main>
		</ion-content>
	</ion-page>
</template>

<script setup lang="ts">
import PageHeader from '@/components/PageHeader.vue'
import { IonContent, IonPage } from '@ionic/vue'
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()
const query = ref(typeof route.query.q === 'string' ? route.query.q : '')
const submitted = computed(() => typeof route.query.q === 'string' && route.query.q.length > 0)

watch(
	() => route.query.q,
	(value) => (query.value = typeof value === 'string' ? value : ''),
)

function submit(): void {
	const value = query.value.trim()
	void router.replace({ query: value ? { q: value } : undefined })
}
</script>

<style scoped>
.search-page h1 {
	margin: 0;
	font-family: var(--font-display);
	font-size: clamp(2.5rem, 8vw, 5rem);
	letter-spacing: -0.06em;
}

.search-page > p:not(.section-label) {
	max-inline-size: 42rem;
	color: var(--app-text-muted);
	font-size: var(--text-lg);
	line-height: 1.6;
}

.search-page__form {
	display: grid;
	gap: var(--space-2);
	margin-block-start: var(--space-8);
}

.search-page__form label {
	font-size: var(--text-sm);
	font-weight: 700;
}

.search-page__form > div {
	display: flex;
	gap: var(--space-3);
}

.search-page__form input {
	flex: 1;
	min-inline-size: 0;
	min-block-size: 3rem;
	border: 1px solid var(--app-border);
	border-radius: var(--radius-sm);
	padding-inline: var(--space-4);
	color: var(--app-text);
	background: var(--app-surface);
	font: inherit;
}

.search-page__form button {
	min-block-size: 44px;
	border: 0;
	border-radius: var(--radius-sm);
	padding-inline: var(--space-5);
	color: var(--app-accent-contrast);
	background: var(--app-accent);
	font: inherit;
	font-weight: 700;
}

@media (max-width: 470px) {
	.search-page__form > div {
		flex-direction: column;
	}
}
</style>
