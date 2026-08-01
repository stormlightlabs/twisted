import HomePage from '@/views/HomePage.vue'
import { describe, expect, test, vi } from 'vitest'
import { mountIonicRoute } from './support/mount'

describe('HomePage', () => {
	test('mounts as an Ionic route without Vue warnings', async () => {
		const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
		const wrapper = await mountIonicRoute(HomePage, '/home', [{ path: '/home', component: HomePage }])

		expect(wrapper.get('h1').text()).toBe('Read Tangled from anywhere.')
		expect(warning).not.toHaveBeenCalled()
	})
})
