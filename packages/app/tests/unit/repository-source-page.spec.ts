import type { BobbinClient } from '@/lib/api'
import { BOBBIN_CLIENT_PROVIDER, BobbinError } from '@/lib/api'
import RepositorySourcePage from '@/views/RepositorySourcePage.vue'
import { flushPromises } from '@vue/test-utils'
import { describe, expect, test, vi } from 'vitest'
import { mountIonicRoute } from './support/mount'

const repo = 'at://did:plc:owner/sh.tangled.repo/twisted'
const repoDid = 'did:plc:repository'
const repositoryLocation = { did: repoDid, knot: 'knot.example' }
const routes = [
	{ path: '/repositories/:repo', name: 'repository', component: { template: '<div />' } },
	{ path: '/repositories/:repo/source', name: 'repository-source', component: RepositorySourcePage },
	{ path: '/repositories/:repo/commits', name: 'repository-commits', component: { template: '<div />' } },
	{ path: '/repositories/:repo/branches', name: 'repository-branches', component: { template: '<div />' } },
	{ path: '/repositories/:repo/tags', name: 'repository-tags', component: { template: '<div />' } },
	{ path: '/repositories/:repo/compare', name: 'repository-compare', component: { template: '<div />' } },
	{ path: '/repositories/:repo/issues', name: 'issues', component: { template: '<div />' } },
	{ path: '/repositories/:repo/pulls', name: 'pulls', component: { template: '<div />' } },
	{
		path: '/repositories/:repo/relationships/:relationship?',
		name: 'repository-relationships',
		component: { template: '<div />' },
	},
]

function client(overrides: Record<string, unknown> = {}) {
	return {
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
			.mockResolvedValue({ name: 'main', hash: 'a'.repeat(40), when: '2026-08-01T00:00:00Z' }),
		listRepositoryBranches: vi
			.fn()
			.mockResolvedValue({ items: [{ name: 'main', hash: 'a'.repeat(40), isDefault: true }] }),
		listRepositoryTags: vi.fn().mockResolvedValue({ items: [] }),
		getRepositoryTree: vi.fn().mockResolvedValue({ ref: 'main', files: [] }),
		getRepositoryBlob: vi
			.fn()
			.mockResolvedValue({
				path: 'src/main.ts',
				ref: 'main',
				size: 20,
				encoding: 'utf-8',
				content: 'const one = 1\nconst two = 2',
			}),
		repositoryBlobUrl: vi.fn(() => 'https://api.example/raw'),
		...overrides,
	} as unknown as BobbinClient
}

describe('RepositorySourcePage', () => {
	test('renders shareable source lines, anchors, wrapping, and download links', async () => {
		const fakeClient = client()
		const url = `/repositories/${encodeURIComponent(repo)}/source?ref=main&path=src%2Fmain.ts&view=blob`
		const wrapper = await mountIonicRoute(RepositorySourcePage, url, routes, {
			[BOBBIN_CLIENT_PROVIDER]: () => fakeClient,
			navManager: { handleNavigateBack: vi.fn() },
		})
		await flushPromises()
		await flushPromises()

		expect(wrapper.findAll('.code-lines li')).toHaveLength(2)
		expect(wrapper.get('#L2 a').attributes('href')).toBe('#L2')
		expect(wrapper.get('.blob-toolbar a[download]').attributes('href')).toBe('https://api.example/raw')
		await wrapper.get('.blob-toolbar button').trigger('click')
		expect(wrapper.get('.code-lines').classes()).toContain('code-lines--wrap')
		expect(fakeClient.getRepositoryBlob).toHaveBeenCalledWith(
			repositoryLocation,
			'main',
			'src/main.ts',
			expect.any(Object),
		)
	})

	test('keeps repository navigation available when a ref cannot be opened', async () => {
		const fakeClient = client({
			getRepositoryTree: vi.fn().mockRejectedValue(new BobbinError('not-found', 'missing ref')),
		})
		const wrapper = await mountIonicRoute(
			RepositorySourcePage,
			`/repositories/${encodeURIComponent(repo)}/source?ref=missing`,
			routes,
			{ [BOBBIN_CLIENT_PROVIDER]: () => fakeClient, navManager: { handleNavigateBack: vi.fn() } },
		)
		await flushPromises()
		await flushPromises()

		expect(wrapper.findAll('.repository-navigation a')).toHaveLength(9)
		expect(wrapper.text()).toContain('Record not found')
	})
})
