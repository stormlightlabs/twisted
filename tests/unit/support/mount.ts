import { IonicVue } from '@ionic/vue'
import { mount } from '@vue/test-utils'
import type { Component } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'

/** Mounts an Ionic route component with the plugins it receives in the app. */
export async function mountIonicRoute(
	component: Component,
	path = '/',
	routes: RouteRecordRaw[] = [{ path: '/', component }],
) {
	const router = createRouter({ history: createMemoryHistory(), routes })
	await router.push(path)
	await router.isReady()

	return mount(component, { global: { plugins: [IonicVue, router] } })
}
