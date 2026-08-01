import type { BobbinClient } from '@/lib/api'
import { BOBBIN_CLIENT_PROVIDER } from '@/lib/api'
import RepositoryRefsPage from '@/views/RepositoryRefsPage.vue'
import { flushPromises } from '@vue/test-utils'
import { describe, expect, test, vi } from 'vitest'
import { mountIonicRoute } from './support/mount'

const repo = 'at://did:plc:owner/sh.tangled.repo/twisted'
const repoDid = 'did:plc:repository'
const routes = [
	{ path: '/repositories/:repo', name: 'repository', component: { template: '<div />' } },
	{ path: '/repositories/:repo/source', name: 'repository-source', component: { template: '<div />' } },
	{ path: '/repositories/:repo/commits', name: 'repository-commits', component: { template: '<div />' } },
	{ path: '/repositories/:repo/branches', name: 'repository-branches', component: RepositoryRefsPage },
	{ path: '/repositories/:repo/tags', name: 'repository-tags', component: RepositoryRefsPage },
	{ path: '/repositories/:repo/compare', name: 'repository-compare', component: { template: '<div />' } },
]

describe('RepositoryRefsPage', () => {
	test('appends each branch cursor once and preserves service order', async () => {
		const listRepositoryBranches = vi
			.fn()
			.mockResolvedValueOnce({ items: [{ name: 'main', hash: 'a'.repeat(40), isDefault: true }], cursor: '1' })
			.mockResolvedValueOnce({ items: [{ name: 'feature', hash: 'b'.repeat(40), isDefault: false }] })
		const client = {
			getRepo: vi
				.fn()
				.mockResolvedValue({
					uri: repo,
					value: {
						$type: 'sh.tangled.repo',
						createdAt: '2026-08-01T00:00:00Z',
						knot: 'knot.example',
						name: 'Twisted',
						repoDid,
					},
				}),
			listRepositoryBranches,
			listRepositoryTags: vi.fn().mockResolvedValue({ items: [] }),
		} as unknown as BobbinClient
		const wrapper = await mountIonicRoute(
			RepositoryRefsPage,
			`/repositories/${encodeURIComponent(repo)}/branches`,
			routes,
			{ [BOBBIN_CLIENT_PROVIDER]: () => client, navManager: { handleNavigateBack: vi.fn() } },
		)
		await flushPromises()
		await flushPromises()

		const button = wrapper.get('.load-more')
		void button.trigger('click')
		void button.trigger('click')
		await flushPromises()

		expect(listRepositoryBranches).toHaveBeenCalledTimes(2)
		expect(wrapper.findAll('.ref-list strong').map((node) => node.text())).toEqual(['main', 'feature'])
	})

	test('shows an explicit empty state for a repository without tags', async () => {
		const client = {
			getRepo: vi
				.fn()
				.mockResolvedValue({
					uri: repo,
					value: {
						$type: 'sh.tangled.repo',
						createdAt: '2026-08-01T00:00:00Z',
						knot: 'knot.example',
						name: 'Twisted',
						repoDid,
					},
				}),
			listRepositoryBranches: vi.fn().mockResolvedValue({ items: [] }),
			listRepositoryTags: vi.fn().mockResolvedValue({ items: [] }),
		} as unknown as BobbinClient
		const wrapper = await mountIonicRoute(
			RepositoryRefsPage,
			`/repositories/${encodeURIComponent(repo)}/tags`,
			routes,
			{ [BOBBIN_CLIENT_PROVIDER]: () => client, navManager: { handleNavigateBack: vi.fn() } },
		)
		await flushPromises()
		await flushPromises()

		expect(wrapper.text()).toContain('This repository does not have any tags yet.')
	})
})
