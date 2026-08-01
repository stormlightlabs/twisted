<template>
	<nav class="mobile-tabs" aria-label="Primary tabs">
		<router-link
			v-for="item in tabs"
			:key="item.label"
			:aria-current="isActive(item.activePath) ? 'page' : undefined"
			:class="{ 'mobile-tabs__item--active': isActive(item.activePath) }"
			:to="item.to">
			<ion-icon :icon="item.icon" aria-hidden="true" />
			<span>{{ item.label }}</span>
		</router-link>
	</nav>
</template>

<script setup lang="ts">
import { links } from '@/router/links'
import { IonIcon } from '@ionic/vue'
import { gitBranchOutline, homeOutline, peopleOutline, searchOutline } from 'ionicons/icons'
import { useRoute } from 'vue-router'

const route = useRoute()
const tabs = [
	{ label: 'Home', to: links.home, activePath: '/', icon: homeOutline },
	{ label: 'Search', to: links.search(), activePath: '/search', icon: searchOutline },
	{ label: 'People', to: links.profiles, activePath: '/profiles', icon: peopleOutline },
	{ label: 'Repos', to: links.repositories, activePath: '/repositories', icon: gitBranchOutline },
] as const

function isActive(path: string): boolean {
	return path === '/' ? route.path === '/' : route.path.startsWith(path)
}
</script>

<style scoped>
.mobile-tabs {
	display: none;
}

@media (max-width: 959px) {
	.mobile-tabs {
		position: fixed;
		z-index: 20;
		inset-inline: 0;
		inset-block-end: 0;
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		min-block-size: calc(3.75rem + var(--safe-bottom));
		border-block-start: 1px solid var(--app-border);
		padding: var(--space-1) max(var(--space-2), var(--safe-right)) var(--safe-bottom)
			max(var(--space-2), var(--safe-left));
		background: var(--app-surface);
	}

	.mobile-tabs a {
		display: grid;
		place-items: center;
		align-content: center;
		gap: 0.125rem;
		min-block-size: 3.25rem;
		border-radius: var(--radius-sm);
		color: var(--app-text-muted);
		font-size: var(--text-xs);
		font-weight: 650;
		line-height: 1;
		text-decoration: none;
	}

	.mobile-tabs ion-icon {
		font-size: 1.25rem;
	}

	.mobile-tabs .mobile-tabs__item--active {
		color: var(--app-accent);
		background: var(--app-surface-raised);
	}
}
</style>
