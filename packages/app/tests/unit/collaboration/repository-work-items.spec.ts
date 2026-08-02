import type { BobbinClient } from '@/lib/api'
import { BOBBIN_CLIENT_PROVIDER } from '@/lib/api'
import RepositoryWorkItemsPage from '@/views/RepositoryWorkItemsPage.vue'
import { flushPromises } from '@vue/test-utils'
import { describe, expect, test, vi } from 'vitest'
import { mountIonicRoute } from '../support/mount'

const repo = 'at://did:plc:owner/sh.tangled.repo/twisted'
const repoDid = 'did:plc:repository'
const author = 'did:plc:author'
const placeholder = { template: '<div />' }
const routes = [
	{ path: '/profiles/:actor', name: 'profile', component: placeholder },
	{ path: '/search', name: 'search', component: placeholder },
	{ path: '/repositories/:repo', name: 'repository', component: placeholder },
	{ path: '/repositories/:repo/source', name: 'repository-source', component: placeholder },
	{ path: '/repositories/:repo/commits', name: 'repository-commits', component: placeholder },
	{ path: '/repositories/:repo/branches', name: 'repository-branches', component: placeholder },
	{ path: '/repositories/:repo/tags', name: 'repository-tags', component: placeholder },
	{ path: '/repositories/:repo/compare', name: 'repository-compare', component: placeholder },
	{ path: '/repositories/:repo/issues', name: 'issues', component: RepositoryWorkItemsPage },
	{ path: '/repositories/:repo/issues/:rkey', name: 'issue', component: placeholder },
	{ path: '/repositories/:repo/pulls', name: 'pulls', component: RepositoryWorkItemsPage },
	{ path: '/repositories/:repo/pulls/:rkey', name: 'pull', component: placeholder },
	{
		path: '/repositories/:repo/relationships/:relationship?',
		name: 'repository-relationships',
		component: placeholder,
	},
]

function repository() {
	return {
		uri: repo,
		value: {
			$type: 'sh.tangled.repo',
			createdAt: '2026-08-01T00:00:00.000Z',
			knot: 'knot.example',
			name: 'Twisted',
			repoDid,
		},
	}
}

describe('RepositoryWorkItemsPage', () => {
	test.each([
		{
			kind: 'issues',
			filter: 'state=closed',
			stateKey: 'state',
			state: 'closed',
			collection: 'sh.tangled.repo.issue',
			title: 'Closed issue',
			method: 'listIssues',
		},
		{
			kind: 'pulls',
			filter: 'status=merged',
			stateKey: 'status',
			state: 'merged',
			collection: 'sh.tangled.repo.pull',
			title: 'Merged pull',
			method: 'listPulls',
		},
	])('round-trips $kind filters and renders Bobbin-derived metadata', async (fixture) => {
		const list = vi
			.fn()
			.mockResolvedValue({
				items: [
					{
						uri: `at://${author}/${fixture.collection}/3mho6hukiei22`,
						commentCount: 4,
						state: fixture.state,
						value: { title: fixture.title },
					},
				],
			})
		const client = {
			getRepo: vi.fn().mockResolvedValue(repository()),
			listIssues: fixture.method === 'listIssues' ? list : vi.fn(),
			listPulls: fixture.method === 'listPulls' ? list : vi.fn(),
		} as unknown as BobbinClient
		const url = `/repositories/${encodeURIComponent(repo)}/${fixture.kind}?${fixture.filter}&author=${encodeURIComponent(author)}`
		const wrapper = await mountIonicRoute(RepositoryWorkItemsPage, url, routes, {
			[BOBBIN_CLIENT_PROVIDER]: () => client,
			navManager: { handleNavigateBack: vi.fn() },
		})
		await flushPromises()
		await flushPromises()

		expect(list).toHaveBeenCalledWith(
			repoDid,
			expect.objectContaining({ [fixture.stateKey]: fixture.state, author, limit: 20 }),
		)
		expect(wrapper.text()).toContain(fixture.title)
		expect(wrapper.text()).toContain('3mho6hukiei22')
		expect(wrapper.text()).toContain(fixture.state)
		expect(wrapper.text()).toContain('4 comments')
		const detailLink = wrapper.findAll('.work-list a').find((link) => link.text() === fixture.title)
		expect(new URL(detailLink!.attributes('href'), 'https://twisted.test').searchParams.get('author')).toBe(author)
	})
})
