<template>
	<ion-menu content-id="main-content" type="overlay">
		<ion-content class="app-menu">
			<router-link :to="links.landing" class="app-menu__brand" aria-label="Twisted landing page">
				<span class="app-menu__mark" aria-hidden="true">
					<img class="app-menu__logo app-menu__logo--light" alt="" src="/icons/logo-light.svg" />
					<img class="app-menu__logo app-menu__logo--dark" alt="" src="/icons/logo-dark.svg" />
				</span>
				<span class="app-menu__brand-copy">
					<strong>Twisted</strong>
					<small>A Tangled client</small>
				</span>
			</router-link>

			<nav aria-label="Primary navigation">
				<div v-for="group in navigation" :key="group.label" class="app-menu__group">
					<p>{{ group.label }}</p>
					<ion-list lines="none">
						<ion-menu-toggle v-for="item in group.items" :key="item.label" :auto-hide="false">
							<ion-item
								:class="{ 'app-menu__item--active': isActive(item.activePath) }"
								:detail="false"
								:router-link="item.to"
								router-direction="root">
								<ion-icon slot="start" :icon="item.icon" aria-hidden="true" />
								<ion-label>{{ item.label }}</ion-label>
							</ion-item>
						</ion-menu-toggle>
					</ion-list>
				</div>
			</nav>

			<nav class="app-menu__links" aria-label="Tangled links">
				<a href="https://tangled.org/" rel="noopener noreferrer" target="_blank">Tangled</a>
				<a href="https://docs.tangled.org/" rel="noopener noreferrer" target="_blank">Docs</a>
				<a href="https://tangled.org/desertthunder.dev/twisted" rel="noopener noreferrer" target="_blank"> Source </a>
			</nav>
		</ion-content>
	</ion-menu>
</template>

<script setup lang="ts">
import { links } from '@/lib/router/links'
import { IonContent, IonIcon, IonItem, IonLabel, IonList, IonMenu, IonMenuToggle } from '@ionic/vue'
import {
	compassOutline,
	documentTextOutline,
	gitBranchOutline,
	helpBuoyOutline,
	homeOutline,
	peopleOutline,
	searchOutline,
	settingsOutline,
} from 'ionicons/icons'
import { useRoute } from 'vue-router'

const route = useRoute()
const navigation = [
	{
		label: 'Explore',
		items: [
			{ label: 'Home', to: '/home', activePath: '/home', icon: homeOutline },
			{ label: 'Search', to: '/search', activePath: '/search', icon: searchOutline },
			{ label: 'Profiles', to: '/profiles', activePath: '/profiles', icon: peopleOutline },
			{ label: 'Repositories', to: '/repositories', activePath: '/repositories', icon: gitBranchOutline },
			{ label: 'Strings', to: '/strings', activePath: '/strings', icon: documentTextOutline },
		],
	},
	{
		label: 'Infrastructure',
		items: [
			{ label: 'Knots & spindles', to: '/infrastructure', activePath: '/infrastructure', icon: compassOutline },
			{ label: 'Public keys', to: '/diagnostics/keys', activePath: '/diagnostics/keys', icon: helpBuoyOutline },
		],
	},
	{
		label: 'Application',
		items: [{ label: 'Settings', to: '/settings', activePath: '/settings', icon: settingsOutline }],
	},
] as const

function isActive(path: string): boolean {
	return path === '/' ? route.path === '/' : route.path.startsWith(path)
}
</script>

<style scoped>
.app-menu {
	--background: var(--app-surface);
}

.app-menu__brand {
	display: flex;
	align-items: center;
	gap: var(--space-3);
	padding: calc(var(--safe-top) + var(--space-4)) var(--space-4) var(--space-5);
	color: var(--app-text);
	text-decoration: none;
}

.app-menu__brand-copy {
	display: grid;
	gap: 0.125rem;
}

.app-menu__brand strong {
	font-family: var(--font-display);
	font-size: var(--text-xl);
}

.app-menu__brand small {
	color: var(--app-text-muted);
	font-size: var(--text-xs);
}

.app-menu__mark {
	position: relative;
	display: grid;
	place-items: center;
	flex: 0 0 auto;
	inline-size: 2rem;
	block-size: 2rem;
	color: var(--app-accent);
	font-family: var(--font-display);
	font-size: var(--text-xl);
	font-weight: 800;
}

.app-menu__logo {
	position: absolute;
	inline-size: 2rem;
	block-size: 2rem;
	object-fit: contain;
}
.app-menu__logo--light {
	opacity: 0;
}
:global(html[data-theme-variant='light']) .app-menu__logo--light {
	opacity: 1;
}
:global(html[data-theme-variant='light']) .app-menu__logo--dark {
	opacity: 0;
}

.app-menu__group {
	padding-inline: var(--space-3);
}

.app-menu__group + .app-menu__group {
	margin-block-start: var(--space-4);
}

.app-menu__group > p {
	margin: 0 0 var(--space-2) var(--space-3);
	color: var(--app-text-muted);
	font-size: var(--text-xs);
	font-family: var(--font-mono);
	font-weight: 700;
	letter-spacing: 0.08em;
	text-transform: uppercase;
}

.app-menu__group ion-list {
	padding: 0;
	background: transparent;
}

.app-menu__group ion-item {
	--background: transparent;
	--border-radius: var(--radius-sm);
	--color: var(--app-text-muted);
	--min-height: 44px;
	--padding-start: var(--space-3);
	margin-block: 0.125rem;
}

.app-menu__group ion-icon {
	margin-inline-end: var(--space-3);
	font-size: 1.125rem;
}

.app-menu__group .app-menu__item--active {
	--background: var(--app-surface-raised);
	--color: var(--app-text);
	font-weight: 650;
}

.app-menu__group .app-menu__item--active ion-icon {
	color: var(--app-accent);
}

.app-menu__links {
	display: flex;
	flex-wrap: wrap;
	gap: var(--space-3);
	margin: var(--space-6) var(--space-5) calc(var(--safe-bottom) + var(--space-4));
	font-size: var(--text-xs);
}

.app-menu__links a {
	color: var(--app-text-muted);
	text-underline-offset: 0.2em;
}

.app-menu__links a:hover {
	color: var(--app-accent);
}
</style>
