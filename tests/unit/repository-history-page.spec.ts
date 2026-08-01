import type { BobbinClient } from '@/lib/api'
import { BOBBIN_CLIENT_PROVIDER } from '@/lib/api'
import RepositoryHistoryPage from '@/views/RepositoryHistoryPage.vue'
import { flushPromises } from '@vue/test-utils'
import { describe, expect, test, vi } from 'vitest'
import { mountIonicRoute } from './support/mount'

const repo = 'at://did:plc:owner/sh.tangled.repo/twisted'
const repoDid = 'did:plc:repository'
const routes = [
	{ path: '/profiles/:actor', name: 'profile', component: { template: '<div />' } },
	{ path: '/repositories/:repo', name: 'repository', component: { template: '<div />' } },
	{ path: '/repositories/:repo/source', name: 'repository-source', component: { template: '<div />' } },
	{ path: '/repositories/:repo/commits', name: 'repository-commits', component: RepositoryHistoryPage },
	{ path: '/repositories/:repo/commits/:hash', name: 'repository-commit', component: { template: '<div />' } },
	{ path: '/repositories/:repo/branches', name: 'repository-branches', component: { template: '<div />' } },
	{ path: '/repositories/:repo/tags', name: 'repository-tags', component: { template: '<div />' } },
]

describe('RepositoryHistoryPage', () => {
	test('filters by ref and appends each commit page once in service order', async () => {
		const first = {
			hash: 'a'.repeat(40),
			message: 'First',
			parents: [],
			author: { name: 'Ada', when: '2026-08-01T00:00:00Z' },
		}
		const second = { hash: 'b'.repeat(40), message: 'Second', parents: [] }
		const getRepositoryLog = vi
			.fn()
			.mockResolvedValueOnce({ items: [first], cursor: '2', ref: 'main', total: 2 })
			.mockResolvedValueOnce({ items: [second], ref: 'main', total: 2 })
			.mockResolvedValue({ items: [first], ref: 'release', total: 1 })
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
			getRepositoryDefaultBranch: vi
				.fn()
				.mockResolvedValue({ name: 'main', hash: first.hash, when: '2026-08-01T00:00:00Z' }),
			listRepositoryBranches: vi.fn().mockResolvedValue({
				items: [
					{ name: 'main', hash: first.hash, isDefault: true },
					{ name: 'release', hash: second.hash, isDefault: false },
				],
			}),
			listRepositoryTags: vi.fn().mockResolvedValue({ items: [] }),
			listRepositoryRefUpdates: vi
				.fn()
				.mockResolvedValue([
					{
						uri: 'at://did:plc:owner/sh.tangled.git.refUpdate/one',
						value: { ref: 'main', newSha: first.hash, committerDid: 'did:plc:owner' },
					},
				]),
			getRepositoryLog,
		} as unknown as BobbinClient
		const wrapper = await mountIonicRoute(
			RepositoryHistoryPage,
			`/repositories/${encodeURIComponent(repo)}/commits?ref=main`,
			routes,
			{ [BOBBIN_CLIENT_PROVIDER]: () => client, navManager: { handleNavigateBack: vi.fn() } },
		)
		await flushPromises()
		await flushPromises()

		const button = wrapper.get('.load-more')
		void button.trigger('click')
		void button.trigger('click')
		await flushPromises()
		expect(getRepositoryLog).toHaveBeenCalledTimes(2)
		expect(wrapper.findAll('.commit-list__message').map((node) => node.text())).toEqual(['First', 'Second'])

		await wrapper.get('.history-filters select').setValue('release')
		await flushPromises()
		expect(wrapper.vm.$route.query.ref).toBe('release')
		expect(wrapper.get('.repository-navigation a:nth-child(2)').attributes('href')).toContain('ref=release')
	})
})
