<template>
	<ion-page>
		<page-header title="Home" />
		<ion-content :fullscreen="true">
			<main id="page-content" class="dashboard page-frame">
				<header class="dashboard__header">
					<p class="section-label">Your Tangled home</p>
					<h1>Pick up where you left off.</h1>
					<p>Return to something you opened recently, or start a new search.</p>

					<form class="dashboard__search" role="search" @submit.prevent="search">
						<label for="dashboard-search">Search Tangled</label>
						<div>
							<ion-icon :icon="searchOutline" aria-hidden="true" />
							<input
								id="dashboard-search"
								v-model="query"
								autocomplete="off"
								placeholder="A person, repository, topic, or link"
								spellcheck="false" />
							<button type="submit">Search</button>
						</div>
					</form>
				</header>

				<section class="dashboard__recent" aria-labelledby="recent-heading">
					<div class="dashboard__section-heading">
						<div>
							<p class="section-label">On this device</p>
							<h2 id="recent-heading">Recently opened</h2>
						</div>
						<button v-if="recentDestinations.length" type="button" @click="clearRecentActivity">Clear history</button>
					</div>

					<ol v-if="recentDestinations.length" class="recent-list">
						<li v-for="destination in recentDestinations" :key="`${destination.kind}:${destination.target}`">
							<router-link :to="recentDestinationLink(destination)">
								<ion-icon :icon="recentIcon(destination.kind)" aria-hidden="true" />
								<span>
									<small>{{ recentKind(destination.kind) }}</small>
									<strong>{{ destination.label }}</strong>
								</span>
								<ion-icon :icon="arrowForwardOutline" aria-hidden="true" />
							</router-link>
						</li>
					</ol>

					<div v-else class="dashboard__empty">
						<ion-icon :icon="timeOutline" aria-hidden="true" />
						<div>
							<h3>Nothing to resume yet</h3>
							<p>Profiles, repositories, and searches you open will appear here.</p>
						</div>
					</div>
				</section>

				<section class="dashboard__explore" aria-labelledby="explore-heading">
					<div>
						<p class="section-label">Explore</p>
						<h2 id="explore-heading">Choose a starting point</h2>
					</div>
					<nav aria-label="Explore Tangled">
						<router-link :to="links.profiles"><strong>People</strong><span>Find a public profile</span></router-link>
						<router-link :to="links.repositories"
							><strong>Repositories</strong><span>Open public work</span></router-link
						>
						<router-link :to="links.infrastructure"
							><strong>Tangled network</strong><span>Browse public services</span></router-link
						>
					</nav>
				</section>
			</main>
		</ion-content>
	</ion-page>
</template>

<script setup lang="ts">
import { recentDestinationLink, useRecentActivity } from '@/activity/recent'
import type { RecentDestinationKind } from '@/activity/recent'
import PageHeader from '@/components/PageHeader.vue'
import { links } from '@/router/links'
import { IonContent, IonIcon, IonPage } from '@ionic/vue'
import { arrowForwardOutline, gitBranchOutline, personOutline, searchOutline, timeOutline } from 'ionicons/icons'
import { ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const query = ref('')
const { recentDestinations, clearRecentActivity } = useRecentActivity()

function search(): void {
	const value = query.value.trim()
	void router.push(links.search(value || undefined))
}

function recentIcon(kind: RecentDestinationKind): string {
	if (kind === 'person') return personOutline
	if (kind === 'repository') return gitBranchOutline
	return searchOutline
}

function recentKind(kind: RecentDestinationKind): string {
	if (kind === 'person') return 'Person'
	if (kind === 'repository') return 'Repository'
	return 'Search'
}
</script>

<style scoped>
.dashboard {
	display: grid;
	gap: clamp(var(--space-10), 7vw, var(--space-12));
}
.dashboard__header {
	max-inline-size: 54rem;
}
.dashboard__header h1 {
	max-inline-size: 11ch;
	margin: 0;
	font-family: var(--font-display);
	font-size: clamp(3rem, 6vw, 5.5rem);
	letter-spacing: -0.06em;
	line-height: 0.95;
	text-wrap: balance;
}
.dashboard__header > p:last-of-type {
	max-inline-size: 38rem;
	color: var(--app-text-muted);
	font-size: var(--text-lg);
	line-height: 1.6;
}
.dashboard__search {
	display: grid;
	gap: var(--space-2);
	max-inline-size: 46rem;
	margin-block-start: var(--space-8);
}
.dashboard__search label {
	font-size: var(--text-sm);
	font-weight: 700;
}
.dashboard__search > div {
	display: grid;
	grid-template-columns: auto 1fr auto;
	align-items: center;
	min-block-size: 3.75rem;
	border: 1px solid var(--app-border);
	border-radius: var(--radius-md);
	background: var(--app-surface);
	overflow: hidden;
}
.dashboard__search ion-icon {
	margin-inline-start: var(--space-4);
	color: var(--app-text-muted);
	font-size: 1.2rem;
}
.dashboard__search input {
	min-inline-size: 0;
	block-size: 100%;
	border: 0;
	padding-inline: var(--space-3);
	color: var(--app-text);
	background: transparent;
	outline: 0;
}
.dashboard__search button {
	min-block-size: 44px;
	margin-inline-end: var(--space-2);
	border: 0;
	border-radius: var(--radius-sm);
	padding-inline: var(--space-5);
	color: var(--app-accent-contrast);
	background: var(--app-accent);
	font-weight: 750;
	cursor: pointer;
}
.dashboard__recent {
	display: grid;
	gap: var(--space-5);
}
.dashboard__section-heading {
	display: flex;
	align-items: end;
	justify-content: space-between;
	gap: var(--space-5);
	border-block-end: 1px solid var(--app-border);
	padding-block-end: var(--space-4);
}
.dashboard__section-heading h2,
.dashboard__explore h2 {
	margin: 0;
	font-family: var(--font-display);
	font-size: var(--text-2xl);
}
.dashboard__section-heading button {
	min-block-size: 44px;
	border: 0;
	padding-inline: var(--space-3);
	color: var(--app-accent);
	background: transparent;
	cursor: pointer;
}
.recent-list {
	display: grid;
	grid-template-columns: repeat(2, minmax(0, 1fr));
	gap: var(--space-3);
	margin: 0;
	padding: 0;
	list-style: none;
}
.recent-list a {
	display: grid;
	grid-template-columns: auto minmax(0, 1fr) auto;
	align-items: center;
	gap: var(--space-4);
	min-block-size: 5.5rem;
	border: 1px solid var(--app-border);
	border-radius: var(--radius-md);
	padding: var(--space-4);
	color: var(--app-text);
	background: var(--app-surface);
	text-decoration: none;
}
.recent-list a > ion-icon:first-child {
	color: var(--app-accent);
	font-size: 1.25rem;
}
.recent-list a > ion-icon:last-child {
	color: var(--app-text-muted);
}
.recent-list span {
	display: grid;
	gap: var(--space-1);
	min-inline-size: 0;
}
.recent-list small {
	color: var(--app-text-muted);
}
.recent-list strong {
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}
.dashboard__empty {
	display: flex;
	align-items: flex-start;
	gap: var(--space-4);
	border-inline-start: 3px solid var(--app-accent);
	padding: var(--space-3) var(--space-5);
}
.dashboard__empty > ion-icon {
	flex: 0 0 auto;
	color: var(--app-accent);
	font-size: 1.4rem;
}
.dashboard__empty h3,
.dashboard__empty p {
	margin: 0;
}
.dashboard__empty p {
	margin-block-start: var(--space-1);
	color: var(--app-text-muted);
	line-height: 1.5;
}
.dashboard__explore {
	display: grid;
	grid-template-columns: minmax(12rem, 0.65fr) minmax(20rem, 1.35fr);
	gap: var(--space-8);
	border-block-start: 1px solid var(--app-border);
	padding-block-start: var(--space-6);
}
.dashboard__explore nav {
	display: grid;
}
.dashboard__explore nav a {
	display: grid;
	grid-template-columns: minmax(10rem, 0.8fr) minmax(12rem, 1.2fr);
	gap: var(--space-4);
	min-block-size: 4.5rem;
	border-block-end: 1px solid var(--app-border);
	color: var(--app-text);
	text-decoration: none;
	align-items: center;
}
.dashboard__explore nav a:first-child {
	border-block-start: 1px solid var(--app-border);
}
.dashboard__explore nav span {
	color: var(--app-text-muted);
}
@media (max-width: 720px) {
	.recent-list {
		grid-template-columns: 1fr;
	}
	.dashboard__explore {
		grid-template-columns: 1fr;
	}
}
@media (max-width: 470px) {
	.dashboard__search > div {
		grid-template-columns: auto 1fr;
	}
	.dashboard__search button {
		grid-column: 1 / -1;
		margin: 0 var(--space-2) var(--space-2);
	}
	.dashboard__section-heading {
		align-items: flex-start;
	}
	.dashboard__explore nav a {
		grid-template-columns: 1fr;
		gap: var(--space-1);
		padding-block: var(--space-3);
	}
}
</style>
