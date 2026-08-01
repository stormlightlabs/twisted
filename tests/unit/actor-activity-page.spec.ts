import type { BobbinClient } from '@/lib/api'
import { actorActivityKinds, BOBBIN_CLIENT_PROVIDER, BobbinError } from '@/lib/api'
import { actorActivityDefinitions } from '@/features/activity/actor'
import ActorActivityPage from '@/views/ActorActivityPage.vue'
import { flushPromises } from '@vue/test-utils'
import { describe, expect, test, vi } from 'vitest'
import { mountIonicRoute } from './support/mount'

const actorDid = 'did:plc:person'

const routes = [
	{ path: '/search', name: 'search', component: { template: '<div />' } },
	{ path: '/profiles/:actor', name: 'profile', component: { template: '<div />' } },
	{ path: '/profiles/:actor/activity/:activity?', name: 'actor-activity', component: ActorActivityPage },
]

function identity() {
	return { did: actorDid, handle: 'person.example', pds: 'https://pds.example', signing_key: 'key' }
}

describe('ActorActivityPage', () => {
	test('covers every actor activity family and preserves issue filters and pagination', async () => {
		const listActorActivity = vi
			.fn()
			.mockResolvedValueOnce({
				items: [
					{
						uri: `at://${actorDid}/sh.tangled.repo.issue/first`,
						value: {
							$type: 'sh.tangled.repo.issue',
							title: 'First issue',
							body: 'Details for the issue.',
							createdAt: '2026-08-01T00:00:00.000Z',
							repo: 'did:plc:repo',
						},
					},
				],
				cursor: 'next',
			})
			.mockResolvedValueOnce({
				items: [
					{
						uri: `at://${actorDid}/sh.tangled.repo.issue/second`,
						value: { $type: 'sh.tangled.repo.issue', title: 'Second issue' },
					},
				],
			})
		const client = {
			resolveIdentity: vi.fn().mockResolvedValue(identity()),
			listActorActivity,
		} as unknown as BobbinClient
		const wrapper = await mountIonicRoute(
			ActorActivityPage,
			'/profiles/person.example/activity/issues?state=open',
			routes,
			{ [BOBBIN_CLIENT_PROVIDER]: () => client, navManager: { handleNavigateBack: vi.fn() } },
		)
		await flushPromises()

		expect(actorActivityDefinitions.map((definition) => definition.kind)).toEqual(actorActivityKinds)
		expect(wrapper.findAll('.activity-nav a')).toHaveLength(actorActivityKinds.length)
		expect(listActorActivity).toHaveBeenCalledWith(
			'issues',
			actorDid,
			expect.objectContaining({ state: 'open', limit: 10 }),
		)
		expect(wrapper.text()).toContain('First issue')
		await wrapper.get('.activity-section__more').trigger('click')
		await flushPromises()
		expect(listActorActivity).toHaveBeenLastCalledWith(
			'issues',
			actorDid,
			expect.objectContaining({ cursor: 'next', state: 'open' }),
		)
		expect(wrapper.text()).toContain('Second issue')
	})

	test('keeps other activity sections available after one section fails', async () => {
		const listActorActivity = vi.fn((kind: string) =>
			kind === 'comments'
				? Promise.reject(new BobbinError('upstream-unavailable', 'comments unavailable'))
				: Promise.resolve({
						items: [
							{
								uri: `at://${actorDid}/sh.tangled.feed.reaction/first`,
								value: { $type: 'sh.tangled.feed.reaction', reaction: '👍' },
							},
						],
					}),
		)
		const client = {
			resolveIdentity: vi.fn().mockResolvedValue(identity()),
			listActorActivity,
		} as unknown as BobbinClient
		const wrapper = await mountIonicRoute(ActorActivityPage, '/profiles/person.example/activity/comments', routes, {
			[BOBBIN_CLIENT_PROVIDER]: () => client,
			navManager: { handleNavigateBack: vi.fn() },
		})
		await flushPromises()
		expect(wrapper.text()).toContain('Part of Tangled is unavailable')

		await wrapper
			.findAll('.activity-nav a')
			.find((link) => link.text() === 'Reactions')!
			.trigger('click')
		await flushPromises()
		expect(wrapper.text()).toContain('👍')
		expect(wrapper.text()).not.toContain('Part of Tangled is unavailable')
	})
})
