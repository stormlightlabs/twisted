import HomePage from '@/views/HomePage.vue'
import { describe, expect, test, vi } from 'vitest'
import { mountIonicRoute } from './support/mount'

describe('HomePage', () => {
	test('mounts as an Ionic route without Vue warnings', async () => {
		const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
		const emptyPage = { template: '<div />' }
		const wrapper = await mountIonicRoute(HomePage, '/home', [
			{ path: '/home', name: 'home', component: HomePage },
			{ path: '/profiles', name: 'profiles', component: emptyPage },
			{ path: '/repositories', name: 'repositories', component: emptyPage },
			{ path: '/infrastructure', name: 'infrastructure', component: emptyPage },
		])

		expect(wrapper.get('h1').text()).toBe('Follow the thread.')
		expect(warning).not.toHaveBeenCalled()
	})
})
