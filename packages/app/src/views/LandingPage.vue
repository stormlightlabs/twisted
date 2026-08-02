<template>
	<ion-page>
		<ion-content :fullscreen="true">
			<main id="page-content" class="home-page page-frame">
				<section class="home-page__hero" aria-labelledby="landing-heading">
					<div class="home-page__pitch">
						<p class="home-page__kicker"><span>Twisted</span> A Tangled client</p>
						<h1 id="landing-heading">See where the work leads.</h1>
						<p class="home-page__lede">
							Search public projects and profiles on Tangled, then follow the people, code, and conversations connected
							to them.
						</p>

						<form class="home-page__search" role="search" @submit.prevent="search">
							<label for="home-search">Search Tangled</label>
							<div>
								<ion-icon :icon="searchOutline" aria-hidden="true" />
								<input
									id="home-search"
									v-model="query"
									autocapitalize="off"
									autocomplete="off"
									placeholder="A person, project, topic, or link"
									spellcheck="false" />
								<button type="submit">Search</button>
							</div>
						</form>

						<nav class="home-page__shortcuts" aria-label="Popular starting points">
							<span>Or start with</span>
							<router-link :to="links.profiles">a person</router-link>
							<router-link :to="links.repositories">a repository</router-link>
						</nav>
					</div>

					<aside class="public-trail" aria-labelledby="trail-heading">
						<div class="public-trail__topline">
							<p id="trail-heading">A public trail</p>
							<span>Example</span>
						</div>
						<ol>
							<li>
								<router-link :to="links.profile('desertthunder.dev')">
									<span class="public-trail__number">01</span>
									<span><small>Person</small><strong>@desertthunder.dev</strong></span>
									<ion-icon :icon="arrowForwardOutline" aria-hidden="true" />
								</router-link>
							</li>
							<li>
								<router-link :to="links.repository(twistedRepository)">
									<span class="public-trail__number">02</span>
									<span><small>Repository</small><strong>Twisted</strong></span>
									<ion-icon :icon="arrowForwardOutline" aria-hidden="true" />
								</router-link>
							</li>
							<li>
								<router-link :to="links.search('twisted')">
									<span class="public-trail__number">03</span>
									<span><small>Related records</small><strong>Keep following</strong></span>
									<ion-icon :icon="arrowForwardOutline" aria-hidden="true" />
								</router-link>
							</li>
						</ol>
						<div class="public-trail__mark" aria-hidden="true">
							<img alt="" src="/favicon.png" />
						</div>
					</aside>
				</section>

				<section class="home-page__browse" aria-labelledby="browse-heading">
					<header>
						<p>Pick up any thread</p>
						<h2 id="browse-heading">Start anywhere. Keep your place.</h2>
					</header>

					<div class="home-page__path-list">
						<router-link :to="links.profiles">
							<span>01</span>
							<strong>Meet the people</strong>
							<small>Open a profile and see the public work connected to it.</small>
							<ion-icon :icon="arrowForwardOutline" aria-hidden="true" />
						</router-link>
						<router-link :to="links.repositories">
							<span>02</span>
							<strong>Read the work</strong>
							<small>Move through repositories, changes, issues, and discussions.</small>
							<ion-icon :icon="arrowForwardOutline" aria-hidden="true" />
						</router-link>
						<router-link :to="links.infrastructure">
							<span>03</span>
							<strong>Understand the network</strong>
							<small>See where public projects are hosted and run.</small>
							<ion-icon :icon="arrowForwardOutline" aria-hidden="true" />
						</router-link>
					</div>
				</section>

				<footer class="home-page__footer">
					<div>
						<img alt="" src="/favicon.png" />
						<p><strong>No account needed.</strong> Browse public Tangled work whenever you like.</p>
					</div>
					<router-link :to="links.search()"
						>Open search <ion-icon :icon="arrowForwardOutline" aria-hidden="true"
					/></router-link>
				</footer>
			</main>
		</ion-content>
	</ion-page>
</template>

<script setup lang="ts">
import { links } from '@/lib/router/links'
import { IonContent, IonIcon, IonPage } from '@ionic/vue'
import { arrowForwardOutline, searchOutline } from 'ionicons/icons'
import { ref } from 'vue'
import { useRouter } from 'vue-router'

const twistedRepository = 'at://did:plc:xg2vq45muivyy3xwatcehspu/sh.tangled.repo/3mho6hukiei22'
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
	gap: clamp(5rem, 9vw, 9rem);
	padding-block-start: clamp(var(--space-8), 7vh, 5.5rem);
}

.home-page__hero {
	display: grid;
	grid-template-columns: minmax(0, 1.1fr) minmax(22rem, 0.9fr);
	align-items: center;
	gap: clamp(var(--space-8), 6vw, var(--space-12));
	min-block-size: min(45rem, calc(100vh - 8rem));
}

.home-page__pitch {
	max-inline-size: 47rem;
}

.home-page__kicker {
	display: flex;
	align-items: center;
	gap: var(--space-3);
	margin: 0 0 var(--space-5);
	color: var(--app-text-muted);
	font-size: var(--text-sm);
	font-weight: 650;
}

.home-page__kicker span {
	border-inline-end: 1px solid var(--app-border);
	padding-inline-end: var(--space-3);
	color: var(--app-accent);
	font-family: var(--font-display);
	font-weight: 800;
}

.home-page__pitch h1 {
	max-inline-size: 9ch;
	margin: 0;
	font-family: var(--font-landing-display);
	font-size: clamp(3.75rem, 7.6vw, 7.5rem);
	font-weight: 790;
	font-optical-sizing: auto;
	letter-spacing: -0.072em;
	line-height: 0.86;
	text-wrap: balance;
}

.home-page__lede {
	max-inline-size: 38rem;
	margin: var(--space-6) 0 0;
	color: var(--app-text-muted);
	font-size: clamp(var(--text-lg), 2vw, 1.45rem);
	line-height: 1.55;
	text-wrap: pretty;
}

.home-page__search {
	display: grid;
	gap: var(--space-2);
	max-inline-size: 43rem;
	margin-block-start: var(--space-8);
}

.home-page__search label {
	font-size: var(--text-sm);
	font-weight: 700;
}

.home-page__search > div {
	display: grid;
	grid-template-columns: auto 1fr auto;
	align-items: center;
	min-block-size: 4.25rem;
	border: 1px solid var(--app-border);
	border-radius: var(--radius-md);
	background: var(--app-surface);
	overflow: hidden;
	transition:
		border-color 160ms ease-out,
		box-shadow 160ms ease-out;
}

.home-page__search > div:focus-within {
	border-color: var(--app-focus);
	box-shadow: 0 0 0 3px color-mix(in srgb, var(--app-focus) 24%, transparent);
}

.home-page__search ion-icon {
	margin-inline-start: var(--space-4);
	color: var(--app-text-muted);
	font-size: 1.25rem;
}

.home-page__search input {
	min-inline-size: 0;
	block-size: 100%;
	min-block-size: 3.5rem;
	border: 0;
	padding-inline: var(--space-3);
	color: var(--app-text);
	background: transparent;
	font: inherit;
	outline: 0;
}

.home-page__search button {
	min-block-size: 3.25rem;
	margin-inline-end: var(--space-2);
	border: 0;
	border-radius: var(--radius-sm);
	padding-inline: var(--space-5);
	color: var(--app-accent-contrast);
	background: var(--app-accent);
	font: inherit;
	font-weight: 780;
	cursor: pointer;
}

.home-page__shortcuts {
	display: flex;
	flex-wrap: wrap;
	gap: var(--space-2) var(--space-4);
	margin-block-start: var(--space-4);
	font-size: var(--text-sm);
}

.home-page__shortcuts span {
	color: var(--app-text-muted);
}

.public-trail {
	position: relative;
	isolation: isolate;
	min-block-size: 32rem;
	border: 1px solid var(--app-border);
	border-radius: 1.5rem;
	padding: var(--space-5);
	background: var(--app-surface);
	overflow: hidden;
	transform: rotate(1.2deg);
}

.public-trail__topline {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: var(--space-4);
	border-block-end: 1px solid var(--app-border);
	padding-block-end: var(--space-4);
}

.public-trail__topline p {
	margin: 0;
	font-family: var(--font-display);
	font-weight: 750;
}

.public-trail__topline > span {
	color: var(--app-text-muted);
	font-size: var(--text-xs);
}

.public-trail ol {
	position: relative;
	z-index: 1;
	display: grid;
	gap: var(--space-3);
	margin: var(--space-5) 0 0;
	padding: 0;
	list-style: none;
}

.public-trail li a {
	display: grid;
	grid-template-columns: auto 1fr auto;
	align-items: center;
	gap: var(--space-4);
	min-block-size: 6rem;
	border: 1px solid var(--app-border);
	border-radius: var(--radius-md);
	padding: var(--space-4);
	color: var(--app-text);
	background: var(--app-background);
	text-decoration: none;
	transition:
		border-color 160ms ease-out,
		transform 160ms ease-out;
}

.public-trail__number {
	display: grid;
	place-items: center;
	inline-size: 2.5rem;
	block-size: 2.5rem;
	border: 1px solid var(--app-accent);
	border-radius: 50%;
	color: var(--app-accent);
	background: var(--app-background);
	font-family: var(--font-mono);
	font-size: var(--text-xs);
	font-weight: 700;
}

.public-trail li a > span:nth-child(2) {
	display: grid;
	gap: var(--space-1);
	min-inline-size: 0;
}

.public-trail small {
	color: var(--app-text-muted);
	font-size: var(--text-xs);
}

.public-trail strong {
	overflow: hidden;
	font-family: var(--font-display);
	font-size: var(--text-lg);
	text-overflow: ellipsis;
	white-space: nowrap;
}

.public-trail li ion-icon {
	color: var(--app-accent);
}

.public-trail__mark {
	position: absolute;
	z-index: -1;
	inset-inline-end: -3rem;
	inset-block-end: -4rem;
	opacity: 0.055;
	transform: rotate(-12deg);
}

.public-trail__mark img {
	display: block;
	inline-size: 16rem;
	block-size: 16rem;
}

.home-page__browse {
	display: grid;
	grid-template-columns: minmax(15rem, 0.65fr) minmax(24rem, 1.35fr);
	gap: clamp(var(--space-8), 7vw, var(--space-12));
	border-block-start: 1px solid var(--app-border);
	padding-block-start: var(--space-8);
}

.home-page__browse header > p {
	margin: 0 0 var(--space-4);
	color: var(--app-accent);
	font-size: var(--text-sm);
	font-weight: 700;
}

.home-page__browse h2 {
	max-inline-size: 11ch;
	margin: 0;
	font-family: var(--font-display);
	font-size: clamp(2.5rem, 4.5vw, 4.75rem);
	letter-spacing: -0.055em;
	line-height: 0.95;
	text-wrap: balance;
}

.home-page__path-list {
	display: grid;
}

.home-page__path-list a {
	display: grid;
	grid-template-columns: 2rem minmax(11rem, 0.85fr) minmax(13rem, 1.15fr) auto;
	align-items: center;
	gap: var(--space-4);
	min-block-size: 7rem;
	border-block-end: 1px solid var(--app-border);
	color: var(--app-text);
	text-decoration: none;
}

.home-page__path-list a:first-child {
	border-block-start: 1px solid var(--app-border);
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
	font-size: var(--text-xl);
}

.home-page__path-list small {
	font-size: var(--text-base);
	line-height: 1.5;
}

.home-page__path-list ion-icon {
	color: var(--app-accent);
	font-size: 1.35rem;
	transition: transform 160ms ease-out;
}

.home-page__footer {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: var(--space-6);
	border-block-start: 1px solid var(--app-border);
	padding-block: var(--space-6);
}

.home-page__footer > div {
	display: flex;
	align-items: center;
	gap: var(--space-3);
}

.home-page__footer img {
	inline-size: 2.25rem;
	block-size: 2.25rem;
}

.home-page__footer p {
	margin: 0;
	color: var(--app-text-muted);
}

.home-page__footer strong {
	color: var(--app-text);
}

.home-page__footer > a {
	display: inline-flex;
	align-items: center;
	gap: var(--space-2);
	min-block-size: 44px;
	font-weight: 700;
}

@media (hover: hover) {
	.public-trail li a:hover {
		border-color: var(--app-accent);
		transform: translateX(0.25rem);
	}

	.home-page__path-list a:hover ion-icon {
		transform: translateX(0.3rem);
	}
}

@media (max-width: 1100px) {
	.home-page__hero {
		grid-template-columns: minmax(0, 1fr) minmax(19rem, 0.75fr);
	}

	.public-trail {
		min-block-size: 30rem;
	}
}

@media (max-width: 820px) {
	.home-page__hero,
	.home-page__browse {
		grid-template-columns: 1fr;
	}

	.home-page__hero {
		min-block-size: auto;
	}

	.public-trail {
		min-block-size: auto;
		transform: none;
	}

	.home-page__browse {
		gap: var(--space-8);
	}

	.home-page__browse h2 {
		max-inline-size: 13ch;
	}
}

@media (max-width: 620px) {
	.home-page {
		gap: var(--space-12);
	}

	.home-page__pitch h1 {
		font-size: clamp(3.25rem, 17vw, 5rem);
	}

	.home-page__search > div {
		grid-template-columns: auto 1fr;
	}

	.home-page__search button {
		grid-column: 1 / -1;
		margin: 0 var(--space-2) var(--space-2);
	}

	.home-page__path-list a {
		grid-template-columns: 1.5rem 1fr auto;
		gap: var(--space-3);
		padding-block: var(--space-4);
	}

	.home-page__path-list small {
		grid-column: 2 / -1;
		grid-row: 2;
	}

	.home-page__path-list ion-icon {
		grid-column: 3;
		grid-row: 1;
	}

	.home-page__footer {
		align-items: flex-start;
		flex-direction: column;
	}
}

@media (max-width: 390px) {
	.public-trail {
		padding: var(--space-4);
	}

	.public-trail li a {
		grid-template-columns: auto minmax(0, 1fr);
	}

	.public-trail li ion-icon {
		display: none;
	}
}
</style>
