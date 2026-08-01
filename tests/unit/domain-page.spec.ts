import DomainPage from '@/views/DomainPage.vue'
import { describe, expect, test } from 'vitest'
import { mountIonicRoute } from './support/mount'

describe('DomainPage', () => {
	test('offers recovery links for an unsupported actor identifier', async () => {
		const wrapper = await mountIonicRoute(DomainPage, '/profiles/not valid', [
			{
				path: '/profiles/:actor',
				component: DomainPage,
				meta: { title: 'Profile', parameter: 'actor', requirement: 'actor' },
			},
			{ path: '/search', component: { template: '<div />' } },
			{ path: '/', component: { template: '<div />' } },
		])

		expect(wrapper.get('#unsupported-heading').text()).toBe('This identifier is not supported')
		expect(wrapper.findAll('.recovery-state__actions a')).toHaveLength(2)
	})
})
