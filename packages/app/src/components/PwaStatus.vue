<template>
	<aside v-if="visible" class="pwa-status" :role="offline ? 'alert' : 'status'">
		<div>
			<strong>{{ title }}</strong>
			<p>{{ message }}</p>
		</div>
		<div class="pwa-status__actions">
			<button v-if="needRefresh" type="button" @click="installUpdate">Update now</button>
			<button v-else-if="canInstall" type="button" @click="installApp">Install Twisted</button>
			<button v-if="!offline" class="pwa-status__dismiss" type="button" @click="dismiss">Dismiss</button>
		</div>
	</aside>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { registerSW } from 'virtual:pwa-register'

type InstallPromptEvent = Event & {
	prompt: () => Promise<void>
	userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

const online = ref(typeof navigator === 'undefined' || navigator.onLine)
const needRefresh = ref(false)
const offlineReady = ref(false)
const dismissed = ref(false)
const installPrompt = ref<InstallPromptEvent>()
const canInstall = computed(() => installPrompt.value !== undefined)
const offline = computed(() => !online.value)
const visible = computed(
	() => offline.value || (!dismissed.value && (needRefresh.value || offlineReady.value || canInstall.value)),
)
const title = computed(() => {
	if (offline.value) return 'You’re offline'
	if (needRefresh.value) return 'An update is ready'
	if (canInstall.value) return 'Install Twisted'
	return 'Offline shell ready'
})
const message = computed(() => {
	if (offline.value) return 'The app shell is available, but live Tangled data needs an internet connection.'
	if (needRefresh.value) return 'Reload once to use the new version of every application asset.'
	if (canInstall.value) return 'Add the app to this device for a standalone window and an offline application shell.'
	return 'Twisted can open its application shell without a connection. Public Tangled data remains online-only.'
})

const updateServiceWorker = registerSW({
	onNeedRefresh: () => {
		needRefresh.value = true
		dismissed.value = false
	},
	onOfflineReady: () => {
		offlineReady.value = true
		dismissed.value = false
	},
})

function setOnline(): void {
	online.value = navigator.onLine
	if (!online.value) dismissed.value = false
}

function captureInstallPrompt(event: Event): void {
	event.preventDefault()
	installPrompt.value = event as InstallPromptEvent
	dismissed.value = false
}

async function installApp(): Promise<void> {
	const prompt = installPrompt.value
	if (!prompt) return
	await prompt.prompt()
	await prompt.userChoice
	installPrompt.value = undefined
}

async function installUpdate(): Promise<void> {
	await updateServiceWorker(true)
}

function dismiss(): void {
	dismissed.value = true
	offlineReady.value = false
}

onMounted(() => {
	window.addEventListener('online', setOnline)
	window.addEventListener('offline', setOnline)
	window.addEventListener('beforeinstallprompt', captureInstallPrompt)
})

onBeforeUnmount(() => {
	window.removeEventListener('online', setOnline)
	window.removeEventListener('offline', setOnline)
	window.removeEventListener('beforeinstallprompt', captureInstallPrompt)
})
</script>

<style scoped>
.pwa-status {
	position: fixed;
	z-index: 20;
	inset-inline: max(var(--space-3), var(--safe-left)) max(var(--space-3), var(--safe-right));
	inset-block-end: max(var(--space-3), var(--safe-bottom));
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: var(--space-4);
	max-inline-size: 52rem;
	margin-inline: auto;
	border: 1px solid var(--app-border);
	border-inline-start: 4px solid var(--app-warning);
	border-radius: var(--radius-md);
	padding: var(--space-4);
	color: var(--app-text);
	background: var(--app-surface-raised);
	box-shadow: 0 0.75rem 2rem rgb(0 0 0 / 28%);
}

.pwa-status strong,
.pwa-status p {
	margin: 0;
}

.pwa-status p {
	margin-block-start: var(--space-1);
	color: var(--app-text-muted);
	line-height: 1.45;
}

.pwa-status__actions {
	display: flex;
	flex: 0 0 auto;
	gap: var(--space-2);
}

.pwa-status button {
	min-block-size: 44px;
	border: 1px solid var(--app-accent);
	border-radius: var(--radius-sm);
	padding-inline: var(--space-4);
	color: var(--app-accent-contrast);
	background: var(--app-accent);
	font-weight: 700;
	cursor: pointer;
}

.pwa-status .pwa-status__dismiss {
	color: var(--app-text);
	background: transparent;
}

@media (max-width: 640px) {
	.pwa-status {
		align-items: stretch;
		flex-direction: column;
		inset-block-end: calc(4rem + var(--safe-bottom));
	}

	.pwa-status__actions {
		flex-wrap: wrap;
	}
}
</style>
