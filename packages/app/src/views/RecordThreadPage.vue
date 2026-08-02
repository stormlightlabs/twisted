<template>
	<ion-page>
		<page-header back="/strings" title="String" />
		<ion-content :fullscreen="true">
			<main id="page-content" class="thread-page page-frame page-frame--narrow">
				<request-state
					:error="request.error.value"
					:loading="request.phase.value === 'loading'"
					noun="string"
					@retry="request.retry" />
				<template v-if="record">
					<record-header
						:author="author"
						collection="Tangled string"
						:title="record.value.filename"
						:uri="record.uri" />
					<p v-if="record.value.description" class="description">{{ record.value.description }}</p>
					<pre
						tabindex="0"
						:aria-label="`${record.value.filename} contents`"><code>{{ record.value.contents }}</code></pre>
					<p class="published">Published {{ formatDate(record.value.createdAt) }}</p>
					<discussion-section :subject="uri" />
				</template>
			</main>
		</ion-content>
	</ion-page>
</template>

<script setup lang="ts">
import PageHeader from '@/components/PageHeader.vue'
import RecordHeader from '@/components/RecordHeader.vue'
import RequestState from '@/components/RequestState.vue'
import DiscussionSection from '@/features/collaboration/DiscussionSection.vue'
import { parseAtUri } from '@/content'
import { useBobbinClientProvider } from '@/lib/api'
import { useRouteRequest } from '@/lib/requests'
import { IonContent, IonPage } from '@ionic/vue'
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const uri = computed(() => String(route.params.uri ?? ''))
const getClient = useBobbinClientProvider()
const request = useRouteRequest(uri, (value, signal, attempt) =>
	getClient().getString(value, { signal, cache: attempt.cache }),
)
const record = computed(() => request.data.value)
const author = computed(() => parseAtUri(uri.value)?.authority)
function formatDate(value: string): string {
	return new Intl.DateTimeFormat(undefined, { dateStyle: 'long', timeStyle: 'short' }).format(new Date(value))
}
</script>

<style scoped>
.thread-page {
	display: grid;
	gap: var(--space-8);
}
.description {
	max-inline-size: 70ch;
	margin: 0;
	color: var(--app-text-muted);
	font-size: var(--text-lg);
	line-height: 1.6;
}
pre {
	max-block-size: 40rem;
	margin: 0;
	border: 1px solid var(--app-border);
	border-radius: var(--radius-sm);
	padding: var(--space-5);
	background: var(--app-surface);
	overflow: auto;
}
pre code {
	white-space: pre;
}
.published {
	margin: calc(var(--space-6) * -1) 0 0;
	color: var(--app-text-muted);
	font-size: var(--text-sm);
}
</style>
