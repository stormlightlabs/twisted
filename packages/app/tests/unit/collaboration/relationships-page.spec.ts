import type { BobbinClient } from '@/lib/api'
import { BOBBIN_CLIENT_PROVIDER } from '@/lib/api'
import RelationshipsPage from '@/views/RelationshipsPage.vue'
import { flushPromises } from '@vue/test-utils'
import { describe, expect, test, vi } from 'vitest'
import { mountIonicRoute } from '../support/mount'

const actor = 'did:plc:subject'
const follower = 'did:plc:follower'
const placeholder = { template: '<div />' }
const routes = [
	{ path: '/profiles/:actor', name: 'profile', component: placeholder },
	{ path: '/profiles/:actor/relationships/:relationship?', name: 'actor-relationships', component: RelationshipsPage },
	{ path: '/repositories/:repo', name: 'repository', component: placeholder },
	{
		path: '/repositories/:repo/relationships/:relationship?',
		name: 'repository-relationships',
		component: RelationshipsPage,
	},
	{ path: '/search', name: 'search', component: placeholder },
]

function follow(uri: string) {
	return { uri, value: { $type: 'sh.tangled.graph.follow', createdAt: '2026-08-01T00:00:00.000Z', subject: actor } }
}

describe('RelationshipsPage', () => {
	test('labels inbound edges, preserves raw actors, counts authors, and paginates', async () => {
		const listFollows = vi
			.fn()
			.mockResolvedValueOnce({
				items: [follow(`at://${follower}/sh.tangled.graph.follow/3mho6hukiei22`)],
				cursor: 'followers-2',
			})
			.mockResolvedValueOnce({ items: [follow('at://did:plc:another/sh.tangled.graph.follow/3mho6hukiei23')] })
		const client = {
			resolveIdentity: vi.fn().mockResolvedValue({ did: actor, handle: 'subject.example' }),
			listFollows,
			countFollows: vi.fn().mockResolvedValue({ count: 2, distinctAuthors: 2 }),
		} as unknown as BobbinClient
		const wrapper = await mountIonicRoute(
			RelationshipsPage,
			`/profiles/${encodeURIComponent(actor)}/relationships/followers`,
			routes,
			{ [BOBBIN_CLIENT_PROVIDER]: () => client, navManager: { handleNavigateBack: vi.fn() } },
		)
		await flushPromises()

		expect(wrapper.text()).toContain('Inbound records authored by other people.')
		expect(wrapper.text()).toContain('2 records from 2 distinct authors')
		expect(wrapper.text()).toContain(follower)
		expect(wrapper.text()).toContain(actor)
		expect(listFollows).toHaveBeenCalledWith(actor, expect.objectContaining({ limit: 25 }))

		await wrapper.get('.load-more').trigger('click')
		await flushPromises()
		expect(listFollows).toHaveBeenLastCalledWith(actor, expect.objectContaining({ cursor: 'followers-2' }))
		expect(wrapper.text()).toContain('did:plc:another')
	})
})
