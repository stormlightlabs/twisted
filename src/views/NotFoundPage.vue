<template>
	<ion-page>
		<page-header title="Page not found" />
		<ion-content :fullscreen="true">
			<main id="page-content" class="not-found page-frame page-frame--narrow">
				<p class="not-found__code">404</p>
				<h1>This thread ends here.</h1>
				<p>
					There is no Twisted route at <code>{{ route.fullPath }}</code
					>.
				</p>
				<div>
					<router-link to="/">Return home</router-link>
					<router-link to="/search">Search Tangled</router-link>
				</div>
			</main>
		</ion-content>
	</ion-page>
</template>

<script setup lang="ts">
import PageHeader from '@/components/PageHeader.vue'
import { IonContent, IonPage } from '@ionic/vue'
import { useRoute } from 'vue-router'

const route = useRoute()
</script>

<style scoped>
.not-found {
	display: grid;
	align-content: center;
	min-block-size: 80%;
}

.not-found__code {
	margin: 0;
	color: var(--app-accent);
	font-size: var(--text-sm);
	font-weight: 800;
}

.not-found h1 {
	max-inline-size: 12ch;
	margin: var(--space-2) 0;
	font-family: var(--font-display);
	font-size: clamp(3rem, 10vw, 6rem);
	letter-spacing: -0.065em;
	line-height: 0.95;
}

.not-found > p:not(.not-found__code) {
	color: var(--app-text-muted);
	font-size: var(--text-lg);
}

.not-found code {
	overflow-wrap: anywhere;
}

.not-found > div {
	display: flex;
	flex-wrap: wrap;
	gap: var(--space-4);
	margin-block-start: var(--space-5);
}
</style>
