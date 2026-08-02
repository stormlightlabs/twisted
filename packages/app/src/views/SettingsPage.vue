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
							<p>Choose a built-in theme or tune every Base16 color yourself.</p>
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
								@change="chooseTheme(scheme.id)" />
							<span class="theme-option__swatches" aria-hidden="true">
								<i v-for="slot in previewSlots" :key="slot" :style="{ backgroundColor: scheme.palette[slot] }"></i>
							</span>
							<strong>{{ scheme.name }}</strong>
							<small>{{ scheme.variant }}</small>
						</label>
					</fieldset>

					<form class="theme-builder" @submit.prevent="applyCustomTheme">
						<div class="theme-builder__heading">
							<div>
								<h3>Build a custom theme</h3>
								<p>Enter six-digit hex colors or use the color controls. Changes apply when you save.</p>
							</div>
							<span class="theme-builder__preview" aria-hidden="true">
								<i
									v-for="slot in BASE16_SLOTS"
									:key="slot"
									:style="{ backgroundColor: pickerValue(themeDraft.palette[slot]) }"></i>
							</span>
						</div>

						<div class="theme-builder__metadata">
							<label for="theme-name">Name <input id="theme-name" v-model="themeDraft.name" required /></label>
							<label for="theme-author">Author <input id="theme-author" v-model="themeDraft.author" required /></label>
							<label for="theme-variant">
								Variant
								<select id="theme-variant" v-model="themeDraft.variant">
									<option value="dark">Dark</option>
									<option value="light">Light</option>
								</select>
							</label>
						</div>

						<div class="theme-builder__palette">
							<div v-for="slot in BASE16_SLOTS" :key="slot" class="palette-field">
								<label :for="`${slot}-hex`">
									<code>{{ slot }}</code>
									<small>{{ slotDescriptions[slot] }}</small>
								</label>
								<div>
									<input
										:aria-label="`Choose ${slot} color`"
										type="color"
										:value="pickerValue(themeDraft.palette[slot])"
										@input="setPickedColor(slot, $event)" />
									<input
										:id="`${slot}-hex`"
										v-model="themeDraft.palette[slot]"
										autocapitalize="off"
										pattern="#?[0-9a-fA-F]{6}"
										placeholder="#000000"
										required
										spellcheck="false"
										type="text" />
								</div>
							</div>
						</div>

						<div class="theme-builder__actions">
							<button type="submit">Apply theme</button>
							<button class="button-secondary" type="button" @click="downloadTheme('json')">Download JSON</button>
							<button class="button-secondary" type="button" @click="downloadTheme('yaml')">Download YAML</button>
						</div>
						<p
							v-if="themeMessage"
							:class="{ 'form-message--error': themeError }"
							:role="themeError ? 'alert' : 'status'">
							{{ themeMessage }}
						</p>
					</form>
				</section>

				<section class="settings-section" aria-labelledby="service-heading">
					<div class="settings-section__intro">
						<span>02</span>
						<div>
							<h2 id="service-heading">Bobbin</h2>
							<p>
								Choose a preferred Bobbin. Twisted uses Tangled’s public catalog while a custom Bobbin builds its index.
							</p>
						</div>
					</div>
					<form class="service-form" @submit.prevent="saveService">
						<label for="service-url">Preferred Bobbin address</label>
						<input id="service-url" v-model="serviceInput" inputmode="url" spellcheck="false" />
						<div>
							<button type="submit">Save Bobbin</button>
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
							<p>Twisted is a cross-platform client for Tangled.</p>
						</div>
					</div>
					<dl class="about-list">
						<div>
							<dt>Active theme</dt>
							<dd>{{ activeScheme.name }}</dd>
						</div>
						<div>
							<dt>Preferred Bobbin</dt>
							<dd>{{ service }}</dd>
						</div>
						<div>
							<dt>Links</dt>
							<dd class="about-list__links">
								<a href="https://tangled.org/" rel="noopener noreferrer" target="_blank">Tangled</a>
								<a href="https://docs.tangled.org/" rel="noopener noreferrer" target="_blank">Tangled docs</a>
								<a href="https://tangled.org/desertthunder.dev/twisted" rel="noopener noreferrer" target="_blank">
									Source
								</a>
							</dd>
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
import {
	BASE16_SLOTS,
	BUNDLED_SCHEMES,
	parseBase16Scheme,
	serializeBase16Json,
	serializeBase16Yaml,
	useTheme,
} from '@/lib/theme'
import type { Base16Palette, Base16Scheme, Base16Slot } from '@/lib/theme'
import { IonContent, IonPage } from '@ionic/vue'
import { reactive, ref } from 'vue'

type ThemeDraft = { name: string; author: string; variant: 'light' | 'dark'; palette: Base16Palette }

const { schemes, activeScheme, selectedId, selectTheme, saveCustomTheme } = useTheme()
const { service, updateService, restoreDefault } = useBobbinService()
const previewSlots: Base16Slot[] = ['base00', 'base02', 'base05', 'base0D', 'base0B']
const slotDescriptions: Record<Base16Slot, string> = {
	base00: 'Default background',
	base01: 'Lighter background',
	base02: 'Selection background',
	base03: 'Comments and muted text',
	base04: 'Dark foreground',
	base05: 'Default foreground',
	base06: 'Light foreground',
	base07: 'Lightest foreground',
	base08: 'Red',
	base09: 'Orange',
	base0A: 'Yellow',
	base0B: 'Green',
	base0C: 'Cyan',
	base0D: 'Blue',
	base0E: 'Purple',
	base0F: 'Brown',
}
const themeDraft = reactive<ThemeDraft>(draftFrom(activeScheme.value))
const themeMessage = ref('')
const themeError = ref(false)
const serviceInput = ref(service.value)
const serviceMessage = ref('')
const serviceError = ref(false)

function applyCustomTheme(): void {
	try {
		const saved = saveCustomTheme(schemeFromDraft())
		Object.assign(themeDraft, draftFrom(saved, false))
		themeError.value = false
		themeMessage.value = `${saved.name} was saved and applied.`
	} catch (error) {
		themeError.value = true
		themeMessage.value = error instanceof Error ? error.message : 'The custom theme could not be applied.'
	}
}

function chooseTheme(id: string): void {
	if (!selectTheme(id)) return
	Object.assign(themeDraft, draftFrom(activeScheme.value))
	themeMessage.value = ''
	themeError.value = false
}

function setPickedColor(slot: Base16Slot, event: Event): void {
	themeDraft.palette[slot] = (event.target as HTMLInputElement).value
}

function pickerValue(value: string): string {
	const normalized = value.startsWith('#') ? value : `#${value}`
	return /^#[\da-f]{6}$/i.test(normalized) ? normalized : '#000000'
}

function schemeFromDraft(): Base16Scheme {
	if (!themeDraft.author.trim()) throw new TypeError('The scheme needs an author')
	return parseBase16Scheme({
		system: 'base16',
		name: themeDraft.name,
		author: themeDraft.author,
		variant: themeDraft.variant,
		palette: themeDraft.palette,
	})
}

function downloadTheme(format: 'json' | 'yaml'): void {
	try {
		const scheme = schemeFromDraft()
		const content = format === 'json' ? serializeBase16Json(scheme) : serializeBase16Yaml(scheme)
		downloadText(`${scheme.id}.${format}`, content, format === 'json' ? 'application/json' : 'application/yaml')
		themeError.value = false
		themeMessage.value = `${scheme.name} was downloaded as ${format.toUpperCase()}.`
	} catch (error) {
		themeError.value = true
		themeMessage.value = error instanceof Error ? error.message : 'The custom theme could not be downloaded.'
	}
}

function downloadText(filename: string, content: string, type: string): void {
	const url = URL.createObjectURL(new Blob([content], { type }))
	const link = document.createElement('a')
	link.download = filename
	link.href = url
	document.body.append(link)
	link.click()
	link.remove()
	URL.revokeObjectURL(url)
}

function draftFrom(scheme: Base16Scheme, renameBuiltIn = true): ThemeDraft {
	const builtIn = BUNDLED_SCHEMES.some(({ id }) => id === scheme.id)
	return {
		name: renameBuiltIn && builtIn ? `${scheme.name} Custom` : scheme.name,
		author: scheme.author ?? '',
		variant: scheme.variant,
		palette: { ...scheme.palette },
	}
}

function saveService(): void {
	try {
		serviceInput.value = updateService(serviceInput.value)
		serviceError.value = false
		serviceMessage.value = 'Preferred Bobbin saved.'
	} catch (error) {
		serviceError.value = true
		serviceMessage.value = error instanceof Error ? error.message : 'The service URL is invalid.'
	}
}

function resetService(): void {
	restoreDefault()
	serviceInput.value = service.value
	serviceError.value = false
	serviceMessage.value = 'The default Bobbin was restored.'
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
	grid-template-columns: minmax(0, 1fr);
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

.theme-builder,
.service-form {
	display: grid;
	gap: var(--space-4);
}

.theme-builder label,
.service-form label {
	font-size: var(--text-sm);
	font-weight: 700;
}

.theme-builder input,
.theme-builder select,
.service-form input {
	min-block-size: 44px;
	border: 1px solid var(--app-border);
	border-radius: var(--radius-sm);
	padding: var(--space-3);
	color: var(--app-text);
	background: var(--app-surface);
	font: inherit;
}

.theme-builder__heading {
	display: grid;
	grid-template-columns: minmax(0, 1fr) minmax(12rem, 20rem);
	gap: var(--space-5);
	align-items: end;
}

.theme-builder__heading h3,
.theme-builder__heading p {
	margin: 0;
}

.theme-builder__heading h3 {
	font-family: var(--font-display);
	font-size: var(--text-xl);
}

.theme-builder__heading p {
	margin-block-start: var(--space-1);
	color: var(--app-text-muted);
}

.theme-builder__preview {
	display: flex;
	block-size: 2.75rem;
	border: 1px solid var(--app-border);
	border-radius: var(--radius-sm);
	overflow: hidden;
}

.theme-builder__preview i {
	flex: 1;
}

.theme-builder__metadata {
	display: grid;
	grid-template-columns: repeat(auto-fit, minmax(min(100%, 12rem), 1fr));
	gap: var(--space-3);
}

.theme-builder__metadata label {
	display: grid;
	gap: var(--space-2);
}

.theme-builder__palette {
	display: grid;
	grid-template-columns: repeat(auto-fit, minmax(min(100%, 19rem), 1fr));
	gap: var(--space-2) var(--space-4);
}

.palette-field {
	display: grid;
	grid-template-columns: minmax(0, 1fr) minmax(9rem, 0.8fr);
	gap: var(--space-3);
	align-items: center;
}

.palette-field > label {
	display: grid;
	min-inline-size: 0;
}

.palette-field code {
	color: var(--app-accent);
	font-weight: 750;
}

.palette-field small {
	color: var(--app-text-muted);
	font-weight: 400;
}

.palette-field > div {
	display: grid;
	grid-template-columns: 44px minmax(0, 1fr);
	gap: var(--space-2);
}

.palette-field input[type='color'] {
	inline-size: 44px;
	padding: 0.2rem;
	cursor: pointer;
}

.palette-field input[type='text'] {
	min-inline-size: 0;
	font-family: var(--font-mono);
}

.theme-builder__actions,
.service-form > div {
	display: flex;
	flex-wrap: wrap;
	gap: var(--space-3);
	margin-block-start: var(--space-2);
}

.theme-builder button,
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

.theme-builder .button-secondary,
.service-form .button-secondary {
	color: var(--app-text);
	background: transparent;
}

.theme-builder > p,
.service-form p {
	margin: var(--space-1) 0 0;
	color: var(--app-success);
}

.theme-builder .form-message--error,
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

.about-list__links {
	display: flex;
	flex-wrap: wrap;
	gap: var(--space-3) var(--space-4);
}

.about-list__links a {
	text-underline-offset: 0.2em;
}

@media (max-width: 520px) {
	.theme-builder__heading {
		grid-template-columns: 1fr;
	}

	.palette-field {
		grid-template-columns: 1fr;
		gap: var(--space-2);
	}

	.about-list div {
		grid-template-columns: 1fr;
		gap: var(--space-1);
	}
}
</style>
