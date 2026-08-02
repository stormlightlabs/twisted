import LandingPage from '@/views/LandingPage.vue'
import { describe, expect, test } from 'vitest'
import { mountIonicRoute } from './support/mount'

describe('LandingPage', () => {
	test('introduces Twisted and links into the client', async () => {
		const emptyPage = { template: '<div />' }
		const wrapper = await mountIonicRoute(LandingPage, '/', [
			{ path: '/', name: 'landing', component: LandingPage },
			{ path: '/search', name: 'search', component: emptyPage },
			{ path: '/profiles', name: 'profiles', component: emptyPage },
			{ path: '/profiles/:actor', name: 'profile', component: emptyPage },
			{ path: '/repositories', name: 'repositories', component: emptyPage },
			{ path: '/repositories/:repo', name: 'repository', component: emptyPage },
			{ path: '/infrastructure', name: 'infrastructure', component: emptyPage },
		])

		expect(wrapper.get('h1').text()).toBe('See where the work leads.')
		expect(wrapper.get('.public-trail').text()).toContain('@desertthunder.dev')
	})
})
