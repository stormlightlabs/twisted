<template>
	<aside
		v-if="error && error.kind !== 'aborted'"
		:class="['request-state', { 'request-state--inline': hasContent }]"
		:role="hasContent ? 'status' : 'alert'">
		<ion-icon :icon="hasContent ? warningOutline : cloudOfflineOutline" aria-hidden="true" />
		<div>
			<strong>{{ hasContent ? 'Could not refresh' : presentation?.title }}</strong>
			<p>{{ presentation?.message }}</p>
			<button v-if="presentation?.retryable" :disabled="retryInMs > 0" type="button" @click="$emit('retry')">
				{{ retryInMs > 0 ? `Retry in ${Math.ceil(retryInMs / 1000)}s` : 'Try again' }}
			</button>
		</div>
	</aside>

	<div v-else-if="loading" class="request-state request-state--loading" aria-live="polite" aria-busy="true">
		<span class="sr-only">Loading {{ noun }}…</span>
		<i v-for="line in 3" :key="line" aria-hidden="true"></i>
	</div>

	<section v-else-if="empty" class="request-state request-state--empty">
		<ion-icon :icon="fileTrayOutline" aria-hidden="true" />
		<div>
			<strong>No {{ noun }} found</strong>
			<p>{{ emptyMessage }}</p>
		</div>
	</section>
</template>

<script setup lang="ts">
import type { BobbinError } from '@/lib/api'
import { presentRequestError } from '@/lib/requests/presentation'
import { IonIcon } from '@ionic/vue'
import { cloudOfflineOutline, fileTrayOutline, warningOutline } from 'ionicons/icons'
import { computed } from 'vue'

const props = withDefaults(
	defineProps<{
		empty?: boolean
		emptyMessage?: string
		error?: BobbinError
		hasContent?: boolean
		loading?: boolean
		noun?: string
		retryInMs?: number
	}>(),
	{
		empty: false,
		emptyMessage: 'Try changing the filters or opening another public record.',
		hasContent: false,
		loading: false,
		noun: 'records',
		retryInMs: 0,
	},
)

defineEmits<{ retry: [] }>()

const presentation = computed(() => (props.error === undefined ? undefined : presentRequestError(props.error)))
</script>

<style scoped>
.request-state {
	display: flex;
	align-items: flex-start;
	gap: var(--space-4);
	max-inline-size: 44rem;
	border: 1px solid var(--app-border);
	border-radius: var(--radius-md);
	padding: var(--space-5);
	background: var(--app-surface);
}

.request-state > ion-icon {
	flex: 0 0 auto;
	color: var(--app-warning);
	font-size: 1.5rem;
}

.request-state strong,
.request-state p {
	margin: 0;
}

.request-state p {
	margin-block-start: var(--space-1);
	color: var(--app-text-muted);
	line-height: 1.5;
}

.request-state button {
	min-block-size: 44px;
	margin-block-start: var(--space-3);
	border: 1px solid var(--app-accent);
	border-radius: var(--radius-sm);
	padding-inline: var(--space-4);
	color: var(--app-accent-contrast);
	background: var(--app-accent);
	font-weight: 700;
	cursor: pointer;
}

.request-state button:disabled {
	border-color: var(--app-border);
	color: var(--app-text-muted);
	background: var(--app-surface-raised);
	cursor: wait;
}

.request-state--inline {
	border-inline-start: 3px solid var(--app-warning);
	border-block: 0;
	border-inline-end: 0;
	border-radius: 0;
	padding-block: var(--space-3);
	background: transparent;
}

.request-state--loading {
	display: grid;
	gap: var(--space-3);
}

.request-state--loading i {
	display: block;
	block-size: 0.9rem;
	border-radius: 0.2rem;
	background: var(--app-surface-raised);
	opacity: 0.75;
	animation: request-pulse 1.4s ease-in-out infinite alternate;
}

.request-state--loading i:nth-of-type(2) {
	inline-size: 82%;
}

.request-state--loading i:nth-of-type(3) {
	inline-size: 64%;
}

.request-state--empty > ion-icon {
	color: var(--app-text-muted);
}

@keyframes request-pulse {
	to {
		opacity: 0.35;
	}
}
</style>
