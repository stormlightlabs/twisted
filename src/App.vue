<template>
	<ion-app>
		<a class="skip-link" href="#page-content">Skip to content</a>
		<ion-split-pane :disabled="isLanding" content-id="main-content" when="(min-width: 960px)">
			<app-menu v-if="!isLanding" />
			<ion-router-outlet id="main-content" />
		</ion-split-pane>
		<mobile-tab-bar v-if="!isLanding" />
	</ion-app>
</template>

<script setup lang="ts">
import { App as CapacitorApp } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import { IonApp, IonRouterOutlet, IonSplitPane } from '@ionic/vue'
import { computed, onBeforeUnmount, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppMenu from './components/AppMenu.vue'
import MobileTabBar from './components/MobileTabBar.vue'
import { links } from './router/links'

const router = useRouter()
const route = useRoute()
const isLanding = computed(() => route.name === 'landing')
let removeBackListener: (() => Promise<void>) | undefined

onMounted(async () => {
	if (!Capacitor.isNativePlatform()) return

	const listener = await CapacitorApp.addListener('backButton', () => {
		if (typeof router.options.history.state.back === 'string') {
			router.back()
		} else if (!['home', 'landing'].includes(String(router.currentRoute.value.name))) {
			void router.replace(links.home)
		} else {
			void CapacitorApp.exitApp()
		}
	})
	removeBackListener = () => listener.remove()
})

onBeforeUnmount(() => void removeBackListener?.())
</script>
