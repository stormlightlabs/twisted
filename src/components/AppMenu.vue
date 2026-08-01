<template>
	<ion-menu content-id="main-content" type="overlay">
		<ion-content class="app-menu">
			<div class="app-menu__brand">
				<div class="app-menu__mark" aria-hidden="true">T</div>
				<div>
					<strong>Twisted</strong>
					<span>Read Tangled anywhere</span>
				</div>
			</div>

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

			<p class="app-menu__readonly"><span aria-hidden="true"></span> Read-only connection</p>
		</ion-content>
	</ion-menu>
</template>

<script setup lang="ts">
import { links } from '@/router/links'
import { IonContent, IonIcon, IonItem, IonLabel, IonList, IonMenu, IonMenuToggle } from '@ionic/vue'
import {
	compassOutline,
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
			{ label: 'Home', to: links.home, activePath: '/', icon: homeOutline },
			{ label: 'Search', to: links.search(), activePath: '/search', icon: searchOutline },
			{ label: 'Profiles', to: links.profiles, activePath: '/profiles', icon: peopleOutline },
			{ label: 'Repositories', to: links.repositories, activePath: '/repositories', icon: gitBranchOutline },
		],
	},
	{
		label: 'Infrastructure',
		items: [
			{ label: 'Knots & spindles', to: links.infrastructure, activePath: '/infrastructure', icon: compassOutline },
			{ label: 'Public keys', to: links.publicKeys, activePath: '/diagnostics/keys', icon: helpBuoyOutline },
		],
	},
	{
		label: 'Application',
		items: [{ label: 'Settings', to: links.settings, activePath: '/settings', icon: settingsOutline }],
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
	padding: calc(var(--safe-top) + var(--space-6)) var(--space-5) var(--space-6);
}

.app-menu__brand > div:last-child {
	display: grid;
	gap: 0.125rem;
}

.app-menu__brand strong {
	font-family: var(--font-display);
	font-size: var(--text-xl);
}

.app-menu__brand span {
	color: var(--app-text-muted);
	font-size: var(--text-xs);
}

.app-menu__mark {
	display: grid;
	place-items: center;
	inline-size: 2.5rem;
	block-size: 2.5rem;
	border: 1px solid var(--app-accent);
	border-radius: var(--radius-sm);
	color: var(--app-accent);
	font-family: var(--font-display);
	font-size: var(--text-xl);
	font-weight: 800;
	transform: rotate(-3deg);
}

.app-menu__group {
	padding-inline: var(--space-3);
}

.app-menu__group + .app-menu__group {
	margin-block-start: var(--space-5);
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

.app-menu__readonly {
	display: flex;
	align-items: center;
	gap: var(--space-2);
	margin: var(--space-8) var(--space-6) calc(var(--safe-bottom) + var(--space-5));
	color: var(--app-text-muted);
	font-size: var(--text-xs);
}

.app-menu__readonly span {
	inline-size: 0.5rem;
	block-size: 0.5rem;
	border-radius: 50%;
	background: var(--app-success);
}
</style>
