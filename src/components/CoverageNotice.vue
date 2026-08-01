<template>
	<aside v-if="coverage && !coverage.ready" class="coverage-notice" role="status">
		<ion-icon :icon="hourglassOutline" aria-hidden="true" />
		<p>
			<strong>Some recent results may be missing.</strong> Tangled’s public catalog is still catching up. Everything
			available now remains visible.
		</p>
	</aside>
</template>

<script setup lang="ts">
import type { BobbinCoverage } from '@/lib/api'
import { IonIcon } from '@ionic/vue'
import { hourglassOutline } from 'ionicons/icons'

defineProps<{ coverage?: BobbinCoverage }>()
</script>

<style scoped>
.coverage-notice {
	display: flex;
	align-items: flex-start;
	gap: var(--space-3);
	max-inline-size: 52rem;
	border: 1px solid var(--app-border);
	border-radius: var(--radius-sm);
	padding: var(--space-3) var(--space-4);
	background: var(--app-surface);
}

.coverage-notice ion-icon {
	flex: 0 0 auto;
	margin-block-start: 0.15rem;
	color: var(--app-warning);
	font-size: 1.2rem;
}

.coverage-notice p {
	margin: 0;
	color: var(--app-text-muted);
	line-height: 1.5;
}

.coverage-notice strong {
	color: var(--app-text);
}
</style>
