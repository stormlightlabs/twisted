import type { BobbinClient } from '@/lib/api'
import { BOBBIN_CLIENT_PROVIDER } from '@/lib/api'
import RepositoryDiffPage from '@/views/RepositoryDiffPage.vue'
import { flushPromises } from '@vue/test-utils'
import { describe, expect, test, vi } from 'vitest'
import { mountIonicRoute } from './support/mount'

vi.mock('@/features/repositories/PatchViewer.vue', () => ({
	default: { props: ['patch'], template: '<pre class="stub-patch">{{ patch }}</pre>' },
}))

const repo = 'at://did:plc:owner/sh.tangled.repo/twisted'
const routes = [
	{ path: '/repositories/:repo', name: 'repository', component: { template: '<div />' } },
	{ path: '/repositories/:repo/source', name: 'repository-source', component: { template: '<div />' } },
	{ path: '/repositories/:repo/commits', name: 'repository-commits', component: { template: '<div />' } },
	{ path: '/repositories/:repo/branches', name: 'repository-branches', component: { template: '<div />' } },
	{ path: '/repositories/:repo/tags', name: 'repository-tags', component: { template: '<div />' } },
	{ path: '/repositories/:repo/compare', name: 'repository-compare', component: RepositoryDiffPage },
]

describe('RepositoryDiffPage', () => {
	test('shows base-to-head direction and swaps comparison refs through the URL', async () => {
		const getRepositoryCompare = vi.fn().mockResolvedValue({ kind: 'patch', bytes: 12, text: 'readable patch' })
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
						repoDid: 'did:plc:repository',
					},
				}),
			listRepositoryBranches: vi.fn().mockResolvedValue({ items: [{ name: 'main' }, { name: 'feature' }] }),
			listRepositoryTags: vi.fn().mockResolvedValue({ items: [] }),
			getRepositoryCompare,
			repositoryCompareUrl: vi.fn(() => 'https://api.example/compare'),
		} as unknown as BobbinClient
		const wrapper = await mountIonicRoute(
			RepositoryDiffPage,
			`/repositories/${encodeURIComponent(repo)}/compare?base=main&head=feature`,
			routes,
			{ [BOBBIN_CLIENT_PROVIDER]: () => client, navManager: { handleNavigateBack: vi.fn() } },
		)
		await flushPromises()
		await flushPromises()

		expect(wrapper.text()).toContain('Changes needed to move from main to feature.')
		expect(wrapper.get('.stub-patch').text()).toBe('readable patch')
		expect(getRepositoryCompare).toHaveBeenCalledWith(repo, 'main', 'feature', expect.any(Object))

		await wrapper.get('.swap-button').trigger('click')
		await flushPromises()
		expect(wrapper.vm.$route.query).toEqual({ base: 'feature', head: 'main' })
		expect(getRepositoryCompare).toHaveBeenLastCalledWith(repo, 'feature', 'main', expect.any(Object))
	})
})
