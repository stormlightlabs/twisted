<template>
	<header class="record-header">
		<div class="record-header__heading">
			<p>{{ collection }}</p>
			<h1>{{ title || 'Public record' }}</h1>
			<router-link v-if="author" :to="links.profile(author)">{{ author }}</router-link>
		</div>

		<div class="record-header__identifier">
			<span>AT-URI</span>
			<code>{{ uri }}</code>
			<button type="button" @click="copyIdentifier">
				<ion-icon :icon="copyOutline" aria-hidden="true" />
				{{ copyLabel }}
			</button>
		</div>

		<a v-if="canonical" class="record-header__canonical" :href="canonical" rel="noopener noreferrer" target="_blank">
			Open on Tangled
			<ion-icon :icon="openOutline" aria-hidden="true" />
		</a>
	</header>
</template>

<script setup lang="ts">
import { safeCanonicalTangledUrl } from '@/content'
import { useCopy } from '@/lib/browser'
import { links } from '@/lib/router/links'
import { IonIcon } from '@ionic/vue'
import { copyOutline, openOutline } from 'ionicons/icons'
import { computed, ref } from 'vue'

const props = defineProps<{ uri: string; collection: string; title?: string; author?: string; canonicalUrl?: string }>()
const copyLabel = ref('Copy identifier')
const canonical = computed(() => safeCanonicalTangledUrl(props.canonicalUrl))
const { copyText } = useCopy()

async function copyIdentifier(): Promise<void> {
	copyLabel.value = (await copyText(props.uri)) ? 'Copied' : 'Copy failed'
}
</script>

<style scoped>
.record-header {
	display: grid;
	grid-template-columns: minmax(0, 1fr) auto;
	gap: var(--space-5) var(--space-8);
	align-items: end;
	padding-block-end: var(--space-6);
	border-block-end: 1px solid var(--app-border);
}

.record-header__heading p,
.record-header__heading h1 {
	margin: 0;
}

.record-header__heading p,
.record-header__identifier > span {
	color: var(--app-text-muted);
	font-family: var(--font-mono);
	font-size: var(--text-xs);
}

.record-header__heading h1 {
	margin-block: var(--space-2);
	font-family: var(--font-display);
	font-size: clamp(var(--text-2xl), 5vw, 3rem);
	letter-spacing: -0.035em;
}

.record-header__identifier {
	display: grid;
	grid-column: 1 / -1;
	grid-template-columns: minmax(0, 1fr) auto;
	gap: var(--space-2) var(--space-3);
	align-items: center;
}

.record-header__identifier > span {
	grid-column: 1 / -1;
}

.record-header__identifier code {
	min-inline-size: 0;
	padding: var(--space-3);
	border: 1px solid var(--app-border);
	border-radius: var(--radius-sm);
	background: var(--app-surface);
	overflow-wrap: anywhere;
}

.record-header button,
.record-header__canonical {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	gap: var(--space-2);
	min-block-size: 44px;
	border: 1px solid var(--app-border);
	border-radius: var(--radius-sm);
	padding-inline: var(--space-4);
	color: var(--app-text);
	background: var(--app-surface);
	font: inherit;
	font-weight: 650;
	text-decoration: none;
	cursor: pointer;
}

@media (max-width: 600px) {
	.record-header,
	.record-header__identifier {
		grid-template-columns: 1fr;
	}

	.record-header__canonical {
		justify-self: start;
	}
}
</style>
