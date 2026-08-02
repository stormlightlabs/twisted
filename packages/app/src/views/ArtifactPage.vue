<template>
	<ion-page>
		<page-header :back="router.resolve(links.pipelines(repo)).href" title="Artifact" />
		<ion-content :fullscreen="true">
			<main id="page-content" class="artifact-page page-frame page-frame--narrow">
				<request-state
					:error="artifactRequest.error.value"
					:loading="artifactRequest.phase.value === 'loading'"
					noun="artifact"
					@retry="artifactRequest.retry" />
				<template v-if="artifact">
					<record-header
						:author="author"
						collection="Pipeline artifact"
						:title="artifact.value.name"
						:uri="artifact.uri" />
					<section class="artifact-metadata" aria-labelledby="metadata-heading">
						<div>
							<h2 id="metadata-heading">File metadata</h2>
							<dl>
								<div>
									<dt>Media type</dt>
									<dd>{{ artifact.value.artifact.mimeType }}</dd>
								</div>
								<div>
									<dt>Size</dt>
									<dd>{{ formatBytes(blobSize) }}</dd>
								</div>
								<div>
									<dt>Published</dt>
									<dd>{{ formatDate(artifact.value.createdAt) }}</dd>
								</div>
								<div>
									<dt>Tag object</dt>
									<dd>
										<code>{{ tagHash }}</code>
									</dd>
								</div>
							</dl>
						</div>
						<div class="artifact-download">
							<request-state
								:error="downloadRequest.error.value"
								:loading="downloadRequest.phase.value === 'loading'"
								noun="download address"
								@retry="downloadRequest.retry" />
							<a v-if="downloadRequest.data.value" :download="artifact.value.name" :href="downloadRequest.data.value">
								Download artifact
							</a>
							<p>
								The browser streams this file directly from its public record host. Twisted does not buffer it in
								memory.
							</p>
						</div>
					</section>
					<section
						v-if="artifact.value.repo || artifact.value.repoDid"
						class="artifact-subject"
						aria-labelledby="subject-heading">
						<h2 id="subject-heading">Attached repository</h2>
						<router-link v-if="artifact.value.repo" :to="links.repository(artifact.value.repo)">{{
							artifact.value.repo
						}}</router-link>
						<copyable-identifier
							v-else-if="artifact.value.repoDid"
							:value="artifact.value.repoDid"
							noun="repository DID" />
					</section>
				</template>
			</main>
		</ion-content>
	</ion-page>
</template>

<script setup lang="ts">
import CopyableIdentifier from '@/components/CopyableIdentifier.vue'
import PageHeader from '@/components/PageHeader.vue'
import RecordHeader from '@/components/RecordHeader.vue'
import RequestState from '@/components/RequestState.vue'
import { parseAtUri } from '@/content'
import { useBobbinClientProvider } from '@/lib/api'
import { useRouteRequest } from '@/lib/requests'
import { links } from '@/lib/router/links'
import { IonContent, IonPage } from '@ionic/vue'
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()
const getClient = useBobbinClientProvider()
const repo = computed(() => String(route.params.repo ?? ''))
const uri = computed(() => String(route.params.artifact ?? ''))
const artifactRequest = useRouteRequest(uri, (value, signal, attempt) =>
	getClient().getArtifact(value, { signal, cache: attempt.cache }),
)
const artifact = computed(() => artifactRequest.data.value)
const author = computed(() => parseAtUri(uri.value)?.authority)
const downloadRequest = useRouteRequest(uri, (value, signal, attempt) =>
	getClient().artifactDownloadUrl(value, { signal, cache: attempt.cache }),
)
const blobSize = computed(() => {
	const blob = artifact.value?.value.artifact
	return blob && '$type' in blob ? blob.size : undefined
})
const tagHash = computed(() => {
	const tag = artifact.value?.value.tag
	return tag instanceof Uint8Array
		? [...tag].map((byte) => byte.toString(16).padStart(2, '0')).join('')
		: String(tag ?? '')
})

function formatBytes(value: number | undefined): string {
	if (value === undefined || value < 0) return 'Not reported by this record'
	if (value < 1024) return `${value} B`
	if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
	return `${(value / (1024 * 1024)).toFixed(1)} MB`
}
function formatDate(value: string): string {
	return new Intl.DateTimeFormat(undefined, { dateStyle: 'long', timeStyle: 'short' }).format(new Date(value))
}
</script>

<style scoped>
.artifact-page {
	display: grid;
	gap: var(--space-8);
}
.artifact-metadata {
	display: grid;
	grid-template-columns: minmax(0, 1.3fr) minmax(16rem, 0.7fr);
	gap: var(--space-8);
}
.artifact-metadata h2,
.artifact-subject h2 {
	margin-block-start: 0;
}
dl {
	display: grid;
	grid-template-columns: repeat(2, minmax(0, 1fr));
	gap: var(--space-5);
	margin: 0;
}
dt {
	color: var(--app-text-muted);
	font-size: var(--text-sm);
}
dd {
	margin: var(--space-1) 0 0;
	overflow-wrap: anywhere;
}
.artifact-download {
	align-self: start;
	border-inline-start: 1px solid var(--app-border);
	padding-inline-start: var(--space-6);
}
.artifact-download a {
	display: inline-flex;
	align-items: center;
	min-block-size: 44px;
	border-radius: var(--radius-sm);
	padding-inline: var(--space-5);
	color: var(--app-accent-contrast);
	background: var(--app-accent);
	font-weight: 750;
	text-decoration: none;
}
.artifact-download p {
	color: var(--app-text-muted);
	line-height: 1.5;
}
.artifact-subject {
	border-block-start: 1px solid var(--app-border);
	padding-block-start: var(--space-5);
	overflow-wrap: anywhere;
}
@media (max-width: 42rem) {
	.artifact-metadata {
		grid-template-columns: 1fr;
	}
	.artifact-download {
		border-inline-start: 0;
		border-block-start: 1px solid var(--app-border);
		padding: var(--space-5) 0 0;
	}
	dl {
		grid-template-columns: 1fr;
	}
}
</style>
