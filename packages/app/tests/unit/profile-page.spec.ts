import type { BobbinClient } from '@/lib/api'
import { BOBBIN_CLIENT_PROVIDER, BobbinError } from '@/lib/api'
import ProfilePage from '@/views/ProfilePage.vue'
import { flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { mountIonicRoute } from './support/mount'

const actorDid = 'did:plc:person'

function repository(name: string, repoDid: string) {
	return {
		uri: `at://${actorDid}/sh.tangled.repo/${name.toLowerCase()}`,
		value: {
			$type: 'sh.tangled.repo',
			createdAt: '2026-08-01T00:00:00.000Z',
			knot: 'https://tangled.org',
			name,
			repoDid,
		},
	}
}

function routes() {
	return [
		{ path: '/profiles/:actor', name: 'profile', component: ProfilePage },
		{ path: '/profiles/:actor/activity/:activity?', name: 'actor-activity', component: { template: '<div />' } },
		{
			path: '/profiles/:actor/relationships/:relationship?',
			name: 'actor-relationships',
			component: { template: '<div />' },
		},
		{ path: '/repositories/:repo', name: 'repository', component: { template: '<div />' } },
		{ path: '/infrastructure', name: 'infrastructure', component: { template: '<div />' } },
		{ path: '/diagnostics/keys', name: 'public-keys', component: { template: '<div />' } },
	]
}

describe('ProfilePage', () => {
	beforeEach(() => {
		vi.stubGlobal(
			'URL',
			Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:profile-avatar'), revokeObjectURL: vi.fn() }),
		)
	})
	afterEach(() => vi.unstubAllGlobals())

	test('renders verified identity and metadata while preserving pinned repository order', async () => {
		const first = repository('First pinned', 'did:plc:first')
		const second = repository('Second pinned', 'did:plc:second')
		const client = {
			resolveIdentity: vi
				.fn()
				.mockResolvedValue({ did: actorDid, handle: 'person.example', pds: 'https://pds.example', signing_key: 'key' }),
			getProfile: vi
				.fn()
				.mockResolvedValue({
					uri: `at://${actorDid}/sh.tangled.actor.profile/self`,
					value: {
						$type: 'sh.tangled.actor.profile',
						bluesky: false,
						description: 'Makes small, useful tools.',
						location: 'Chicago',
						pronouns: 'they/them',
						links: ['https://person.example/about', 'javascript:alert(1)'],
						pinnedRepositories: ['did:plc:first', 'did:plc:second'],
					},
				}),
			getRepoByRepoDid: vi.fn((did: string) => Promise.resolve(did === 'did:plc:first' ? first : second)),
			listRepos: vi
				.fn()
				.mockResolvedValueOnce({ items: [repository('Owned', 'did:plc:owned')], cursor: 'next' })
				.mockResolvedValueOnce({ items: [repository('Owned later', 'did:plc:later')] }),
		} as unknown as BobbinClient
		const wrapper = await mountIonicRoute(ProfilePage, '/profiles/person.example', routes(), {
			[BOBBIN_CLIENT_PROVIDER]: () => client,
			navManager: { handleNavigateBack: vi.fn() },
		})
		await flushPromises()
		await flushPromises()

		expect(wrapper.get('h1').text()).toBe('@person.example')
		expect(wrapper.get('.profile-identity__canonical').attributes()).toMatchObject({
			href: 'https://tangled.org/@person.example',
			rel: 'noopener noreferrer',
			target: '_blank',
		})
		expect(wrapper.get('.profile-identity__canonical').text()).toBe('Open in Tangled')
		expect(wrapper.text()).toContain(actorDid)
		expect(wrapper.text()).toContain('Makes small, useful tools.')
		expect(wrapper.text()).toContain('Chicago')
		expect(wrapper.findAll('.profile-details__links a')).toHaveLength(1)
		expect(wrapper.findAll('[aria-labelledby="pinned-heading"] .repo-card strong').map((item) => item.text())).toEqual([
			'First pinned',
			'Second pinned',
		])
		expect(wrapper.text()).toContain('Owned')
		await wrapper.get('.show-more').trigger('click')
		await flushPromises()
		expect(wrapper.text()).toContain('Owned later')
		expect(client.listRepos).toHaveBeenCalledTimes(2)
	})

	test('renders an avatar from a fetched blob instead of a blocked cross-origin URL', async () => {
		const client = {
			resolveIdentity: vi
				.fn()
				.mockResolvedValue({ did: actorDid, handle: 'person.example', pds: 'https://pds.example', signing_key: 'key' }),
			getProfile: vi
				.fn()
				.mockResolvedValue({
					uri: `at://${actorDid}/sh.tangled.actor.profile/self`,
					value: {
						$type: 'sh.tangled.actor.profile',
						bluesky: false,
						avatar: { ref: { $link: 'bafk-avatar' }, mimeType: 'image/png', size: 4 },
					},
				}),
			getProfileAvatar: vi.fn().mockResolvedValue(new Blob(['avatar'], { type: 'image/png' })),
			listRepos: vi.fn().mockResolvedValue({ items: [] }),
		} as unknown as BobbinClient
		const wrapper = await mountIonicRoute(ProfilePage, '/profiles/person.example', routes(), {
			[BOBBIN_CLIENT_PROVIDER]: () => client,
			navManager: { handleNavigateBack: vi.fn() },
		})
		await flushPromises()
		await flushPromises()

		expect(client.getProfileAvatar).toHaveBeenCalledWith(
			'https://pds.example',
			actorDid,
			'bafk-avatar',
			expect.any(Object),
		)
		expect(wrapper.get('.profile-identity__avatar img').attributes('src')).toBe('blob:profile-avatar')
	})

	test('keeps repositories visible when profile details fail', async () => {
		const client = {
			resolveIdentity: vi
				.fn()
				.mockResolvedValue({ did: actorDid, handle: 'person.example', pds: 'https://pds.example', signing_key: 'key' }),
			getProfile: vi.fn().mockRejectedValue(new BobbinError('upstream-unavailable', 'unavailable')),
			listRepos: vi.fn().mockResolvedValue({ items: [repository('Still here', 'did:plc:owned')] }),
		} as unknown as BobbinClient
		const wrapper = await mountIonicRoute(ProfilePage, '/profiles/person.example', routes(), {
			[BOBBIN_CLIENT_PROVIDER]: () => client,
			navManager: { handleNavigateBack: vi.fn() },
		})
		await flushPromises()
		await flushPromises()

		expect(wrapper.text()).toContain('Part of Tangled is unavailable')
		expect(wrapper.text()).toContain('Still here')
	})
})
