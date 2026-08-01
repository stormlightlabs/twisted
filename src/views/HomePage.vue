<template>
	<ion-page>
		<page-header title="Twisted" />
		<ion-content :fullscreen="true">
			<main id="page-content" class="home-page page-frame">
				<section class="home-page__intro">
					<p class="home-page__eyebrow">A read-only window into Tangled</p>
					<h1>Follow the thread.</h1>
					<p>Find people, trace repositories, and read public work without signing in.</p>

					<form class="home-page__search" role="search" @submit.prevent="search">
						<label for="home-search">Search or enter an identifier</label>
						<div>
							<ion-icon :icon="searchOutline" aria-hidden="true" />
							<input
								id="home-search"
								v-model="query"
								autocapitalize="off"
								autocomplete="off"
								placeholder="handle, DID, AT-URI, or search terms"
								spellcheck="false" />
							<button type="submit">Explore</button>
						</div>
					</form>
				</section>

				<section class="home-page__paths" aria-labelledby="browse-heading">
					<div>
						<p class="section-label">Start somewhere</p>
						<h2 id="browse-heading">Browse the public network</h2>
					</div>
					<div class="home-page__path-list">
						<router-link :to="links.profiles">
							<span>01</span>
							<strong>People</strong>
							<small>Profiles, repositories, and public activity</small>
							<ion-icon :icon="arrowForwardOutline" aria-hidden="true" />
						</router-link>
						<router-link :to="links.repositories">
							<span>02</span>
							<strong>Repositories</strong>
							<small>Source, history, issues, pulls, and pipelines</small>
							<ion-icon :icon="arrowForwardOutline" aria-hidden="true" />
						</router-link>
						<router-link :to="links.infrastructure">
							<span>03</span>
							<strong>Infrastructure</strong>
							<small>Knots, spindles, labels, and public keys</small>
							<ion-icon :icon="arrowForwardOutline" aria-hidden="true" />
						</router-link>
					</div>
				</section>

				<aside class="home-page__note">
					<ion-icon :icon="eyeOutline" aria-hidden="true" />
					<div>
						<strong>Made for reading</strong>
						<p>Twisted never asks for credentials and does not send writes to Tangled.</p>
					</div>
				</aside>
			</main>
		</ion-content>
	</ion-page>
</template>

<script setup lang="ts">
import PageHeader from '@/components/PageHeader.vue'
import { links } from '@/router/links'
import { IonContent, IonIcon, IonPage } from '@ionic/vue'
import { arrowForwardOutline, eyeOutline, searchOutline } from 'ionicons/icons'
import { ref } from 'vue'
import { useRouter } from 'vue-router'

const query = ref('')
const router = useRouter()

function search(): void {
	const value = query.value.trim()
	void router.push(links.search(value || undefined))
}
</script>

<style scoped>
.home-page {
	display: grid;
	align-content: start;
	gap: clamp(var(--space-8), 6vw, 5rem);
}

.home-page__intro {
	max-inline-size: 52rem;
	padding-block-start: clamp(var(--space-6), 6vh, 4rem);
}

.home-page__eyebrow,
.section-label {
	margin: 0 0 var(--space-3);
	color: var(--app-accent);
	font-size: var(--text-sm);
	font-family: var(--font-mono);
	font-weight: 700;
}

.home-page__intro h1 {
	max-inline-size: 10ch;
	margin: 0;
	font-family: var(--font-display);
	font-size: clamp(3rem, 7vw, 5.75rem);
	font-weight: 780;
	letter-spacing: -0.06em;
	line-height: 0.92;
	text-wrap: balance;
}

.home-page__intro > p:last-of-type {
	max-inline-size: 40rem;
	margin: var(--space-5) 0 0;
	color: var(--app-text-muted);
	font-size: clamp(var(--text-lg), 2.6vw, var(--text-xl));
	line-height: 1.5;
}

.home-page__search {
	display: grid;
	gap: var(--space-2);
	max-inline-size: 46rem;
	margin-block-start: var(--space-8);
}

.home-page__search label {
	font-size: var(--text-sm);
	font-weight: 650;
}

.home-page__search > div {
	display: grid;
	grid-template-columns: auto 1fr auto;
	align-items: center;
	min-block-size: 3.75rem;
	border: 1px solid var(--app-border);
	border-radius: var(--radius-md);
	background: var(--app-surface);
	overflow: hidden;
}

.home-page__search ion-icon {
	margin-inline-start: var(--space-4);
	color: var(--app-text-muted);
	font-size: 1.25rem;
}

.home-page__search input {
	min-inline-size: 0;
	min-block-size: 3rem;
	block-size: 100%;
	border: 0;
	padding: 0 var(--space-3);
	color: var(--app-text);
	background: transparent;
	font: inherit;
	outline: 0;
}

.home-page__search button {
	min-block-size: 44px;
	margin-inline-end: var(--space-2);
	border: 0;
	border-radius: var(--radius-sm);
	padding-inline: var(--space-5);
	color: var(--app-accent-contrast);
	background: var(--app-accent);
	font: inherit;
	font-weight: 750;
	cursor: pointer;
}

.home-page__paths {
	display: grid;
	grid-template-columns: minmax(12rem, 0.65fr) minmax(20rem, 1.35fr);
	gap: clamp(var(--space-6), 6vw, var(--space-12));
}

.home-page__paths h2 {
	max-inline-size: 12ch;
	margin: 0;
	font-family: var(--font-display);
	font-size: clamp(var(--text-2xl), 4vw, 2.75rem);
	letter-spacing: -0.035em;
	line-height: 1.05;
}

.home-page__path-list {
	display: grid;
	border-block-start: 1px solid var(--app-border);
}

.home-page__path-list a {
	display: grid;
	grid-template-columns: 2rem minmax(8rem, 0.7fr) minmax(12rem, 1.3fr) auto;
	align-items: center;
	gap: var(--space-4);
	min-block-size: 5.5rem;
	border-block-end: 1px solid var(--app-border);
	color: var(--app-text);
	text-decoration: none;
}

.home-page__path-list span,
.home-page__path-list small {
	color: var(--app-text-muted);
}

.home-page__path-list span {
	font-family: var(--font-mono);
	font-size: var(--text-sm);
}

.home-page__path-list strong {
	font-family: var(--font-display);
	font-size: var(--text-lg);
}

.home-page__path-list ion-icon {
	color: var(--app-accent);
	font-size: 1.25rem;
	transition: transform 160ms ease-out;
}

.home-page__note {
	display: flex;
	align-items: flex-start;
	gap: var(--space-4);
	max-inline-size: 40rem;
	border-inline-start: 3px solid var(--app-accent);
	padding: var(--space-2) var(--space-5);
}

.home-page__note ion-icon {
	flex: 0 0 auto;
	color: var(--app-accent);
	font-size: 1.4rem;
}

.home-page__note p {
	margin: var(--space-1) 0 0;
	color: var(--app-text-muted);
	line-height: 1.5;
}

@media (hover: hover) {
	.home-page__path-list a:hover ion-icon {
		transform: translateX(0.25rem);
	}
}

@media (max-width: 700px) {
	.home-page__paths {
		grid-template-columns: 1fr;
	}

	.home-page__path-list a {
		grid-template-columns: 1.5rem 1fr auto;
		gap: var(--space-3);
		padding-block: var(--space-3);
	}

	.home-page__path-list small {
		grid-column: 2 / -1;
		grid-row: 2;
	}

	.home-page__path-list ion-icon {
		grid-column: 3;
		grid-row: 1;
	}
}

@media (max-width: 470px) {
	.home-page__search > div {
		grid-template-columns: auto 1fr;
	}

	.home-page__search button {
		grid-column: 1 / -1;
		margin: 0 var(--space-2) var(--space-2);
	}
}
</style>
