<template>
	<ion-page>
		<page-header title="Settings" />
		<ion-content :fullscreen="true">
			<main id="page-content" class="settings-page page-frame">
				<header class="settings-page__header">
					<p class="section-label">Application</p>
					<h1>Make Twisted yours.</h1>
					<p>Choose how Twisted looks and where it finds public Tangled content.</p>
				</header>

				<section class="settings-section" aria-labelledby="theme-heading">
					<div class="settings-section__intro">
						<span>01</span>
						<div>
							<h2 id="theme-heading">Theme</h2>
							<p>Choose a built-in color theme or bring your own Base16 theme file.</p>
						</div>
					</div>

					<fieldset class="theme-grid">
						<legend class="sr-only">Available themes</legend>
						<label
							v-for="scheme in schemes"
							:key="scheme.id"
							:class="{ 'theme-option--active': scheme.id === selectedId }">
							<input
								:checked="scheme.id === selectedId"
								name="theme"
								type="radio"
								:value="scheme.id"
								@change="selectTheme(scheme.id)" />
							<span class="theme-option__swatches" aria-hidden="true">
								<i v-for="slot in previewSlots" :key="slot" :style="{ backgroundColor: scheme.palette[slot] }"></i>
							</span>
							<strong>{{ scheme.name }}</strong>
							<small>{{ scheme.variant }}</small>
						</label>
					</fieldset>

					<div class="import-control">
						<label for="theme-import">Import Base16 JSON</label>
						<input id="theme-import" accept="application/json,.json" type="file" @change="importFile" />
						<p v-if="importMessage" :class="{ 'form-message--error': importError }" role="status">
							{{ importMessage }}
						</p>
					</div>
				</section>

				<section class="settings-section" aria-labelledby="service-heading">
					<div class="settings-section__intro">
						<span>02</span>
						<div>
							<h2 id="service-heading">Data source</h2>
							<p>Advanced: choose where Twisted finds public Tangled content.</p>
						</div>
					</div>
					<form class="service-form" @submit.prevent="saveService">
						<label for="service-url">Data source address</label>
						<input id="service-url" v-model="serviceInput" inputmode="url" spellcheck="false" />
						<div>
							<button type="submit">Save data source</button>
							<button type="button" class="button-secondary" @click="resetService">Restore default</button>
						</div>
						<p v-if="serviceMessage" :class="{ 'form-message--error': serviceError }" role="status">
							{{ serviceMessage }}
						</p>
					</form>
				</section>

				<section class="settings-section" aria-labelledby="about-heading">
					<div class="settings-section__intro">
						<span>03</span>
						<div>
							<h2 id="about-heading">About</h2>
							<p>Twisted gives you a focused way to browse public work on Tangled.</p>
						</div>
					</div>
					<dl class="about-list">
						<div>
							<dt>Active theme</dt>
							<dd>{{ activeScheme.name }}</dd>
						</div>
						<div>
							<dt>Data source</dt>
							<dd>{{ service }}</dd>
						</div>
						<div>
							<dt>Access</dt>
							<dd>No sign-in needed</dd>
						</div>
					</dl>
				</section>
			</main>
		</ion-content>
	</ion-page>
</template>

<script setup lang="ts">
import PageHeader from '@/components/PageHeader.vue'
import { useBobbinService } from '@/lib/settings/service'
import { useTheme } from '@/lib/theme'
import type { Base16Slot } from '@/lib/theme'
import { IonContent, IonPage } from '@ionic/vue'
import { ref } from 'vue'

const { schemes, activeScheme, selectedId, selectTheme, importTheme } = useTheme()
const { service, updateService, restoreDefault } = useBobbinService()
const previewSlots: Base16Slot[] = ['base00', 'base02', 'base05', 'base0D', 'base0B']
const importMessage = ref('')
const importError = ref(false)
const serviceInput = ref(service.value)
const serviceMessage = ref('')
const serviceError = ref(false)

async function importFile(event: Event): Promise<void> {
	const input = event.target as HTMLInputElement
	const file = input.files?.[0]
	if (file === undefined) return

	try {
		const imported = importTheme(JSON.parse(await file.text()) as unknown)
		importError.value = false
		importMessage.value = `${imported.name} was imported and selected.`
	} catch (error) {
		importError.value = true
		importMessage.value = error instanceof Error ? error.message : 'The theme file could not be imported.'
	} finally {
		input.value = ''
	}
}

function saveService(): void {
	try {
		serviceInput.value = updateService(serviceInput.value)
		serviceError.value = false
		serviceMessage.value = 'Data source saved.'
	} catch (error) {
		serviceError.value = true
		serviceMessage.value = error instanceof Error ? error.message : 'The service URL is invalid.'
	}
}

function resetService(): void {
	restoreDefault()
	serviceInput.value = service.value
	serviceError.value = false
	serviceMessage.value = 'The default data source was restored.'
}
</script>

<style scoped>
.settings-page {
	display: grid;
	gap: var(--space-12);
}

.settings-page__header {
	max-inline-size: 48rem;
}

.settings-page__header h1 {
	margin: 0;
	font-family: var(--font-display);
	font-size: clamp(2.75rem, 8vw, 5rem);
	letter-spacing: -0.06em;
	line-height: 0.98;
}

.settings-page__header > p:last-child {
	color: var(--app-text-muted);
	font-size: var(--text-lg);
	line-height: 1.6;
}

.settings-section {
	display: grid;
	gap: var(--space-6);
	border-block-start: 1px solid var(--app-border);
	padding-block-start: var(--space-6);
}

.settings-section__intro {
	display: grid;
	grid-template-columns: 2rem 1fr;
	gap: var(--space-4);
}

.settings-section__intro > span {
	color: var(--app-accent);
	font-size: var(--text-sm);
	font-weight: 700;
}

.settings-section__intro h2,
.settings-section__intro p {
	margin: 0;
}

.settings-section__intro h2 {
	font-family: var(--font-display);
	font-size: var(--text-2xl);
}

.settings-section__intro p {
	margin-block-start: var(--space-1);
	color: var(--app-text-muted);
}

.theme-grid {
	display: grid;
	grid-template-columns: repeat(auto-fit, minmax(min(100%, 12rem), 1fr));
	gap: var(--space-3);
	margin: 0;
	border: 0;
	padding: 0;
}

.theme-grid label {
	display: grid;
	grid-template-columns: 1fr auto;
	gap: var(--space-2);
	min-block-size: 7rem;
	border: 1px solid var(--app-border);
	border-radius: var(--radius-md);
	padding: var(--space-4);
	background: var(--app-surface);
	cursor: pointer;
}

.theme-grid label:focus-within {
	outline: 3px solid var(--app-focus);
	outline-offset: 2px;
}

.theme-grid label.theme-option--active {
	border-color: var(--app-accent);
}

.theme-grid input {
	position: absolute;
	opacity: 0;
	pointer-events: none;
}

.theme-option__swatches {
	display: flex;
	grid-column: 1 / -1;
	block-size: 2.25rem;
	border-radius: calc(var(--radius-sm) - 0.125rem);
	overflow: hidden;
}

.theme-option__swatches i {
	flex: 1;
}

.theme-grid small {
	color: var(--app-text-muted);
	text-transform: capitalize;
}

.import-control,
.service-form {
	display: grid;
	gap: var(--space-2);
	max-inline-size: 42rem;
}

.import-control label,
.service-form label {
	font-size: var(--text-sm);
	font-weight: 700;
}

.import-control input,
.service-form input {
	min-block-size: 3rem;
	border: 1px solid var(--app-border);
	border-radius: var(--radius-sm);
	padding: var(--space-3);
	color: var(--app-text);
	background: var(--app-surface);
	font: inherit;
}

.service-form > div {
	display: flex;
	flex-wrap: wrap;
	gap: var(--space-3);
	margin-block-start: var(--space-2);
}

.service-form button {
	min-block-size: 44px;
	border: 1px solid var(--app-accent);
	border-radius: var(--radius-sm);
	padding-inline: var(--space-4);
	color: var(--app-accent-contrast);
	background: var(--app-accent);
	font: inherit;
	font-weight: 700;
}

.service-form .button-secondary {
	color: var(--app-text);
	background: transparent;
}

.import-control p,
.service-form p {
	margin: var(--space-1) 0 0;
	color: var(--app-success);
}

.import-control .form-message--error,
.service-form .form-message--error {
	color: var(--app-danger);
}

.about-list {
	display: grid;
	max-inline-size: 42rem;
	margin: 0;
}

.about-list div {
	display: grid;
	grid-template-columns: minmax(8rem, 0.6fr) minmax(12rem, 1.4fr);
	gap: var(--space-4);
	border-block-end: 1px solid var(--app-border);
	padding-block: var(--space-3);
}

.about-list dt {
	color: var(--app-text-muted);
}

.about-list dd {
	margin: 0;
	overflow-wrap: anywhere;
}

@media (max-width: 520px) {
	.about-list div {
		grid-template-columns: 1fr;
		gap: var(--space-1);
	}
}
</style>
