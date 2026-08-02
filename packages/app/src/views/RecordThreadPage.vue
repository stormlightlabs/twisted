<template>
	<ion-page>
		<page-header back="/" title="Public discussion" />
		<ion-content :fullscreen="true">
			<main id="page-content" class="thread-page page-frame page-frame--narrow">
				<header>
					<p class="section-label">Public record</p>
					<h1>Discussion</h1>
					<code>{{ uri }}</code>
				</header>
				<discussion-section :subject="uri" />
			</main>
		</ion-content>
	</ion-page>
</template>

<script setup lang="ts">
import PageHeader from '@/components/PageHeader.vue'
import DiscussionSection from '@/features/collaboration/DiscussionSection.vue'
import { IonContent, IonPage } from '@ionic/vue'
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const uri = computed(() => String(route.params.uri ?? ''))
</script>

<style scoped>
.thread-page {
	display: grid;
	gap: var(--space-8);
}
.thread-page h1 {
	margin: 0;
}
.thread-page code {
	display: block;
	margin-block-start: var(--space-3);
	overflow-wrap: anywhere;
}
</style>
