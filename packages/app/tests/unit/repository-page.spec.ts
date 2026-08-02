import type { BobbinClient } from '@/lib/api'
import { BOBBIN_CLIENT_PROVIDER, BobbinError } from '@/lib/api'
import RepositoryPage from '@/views/RepositoryPage.vue'
import { flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { mountIonicRoute } from './support/mount'

const repoUri = 'at://did:plc:owner/sh.tangled.repo/twisted'
const repoDid = 'did:plc:repository'
const repositoryLocation = { did: repoDid, knot: 'knot.tangled.example' }
let copiedText: string[] = []

const routes = [
	{ path: '/profiles/:actor', name: 'profile', component: { template: '<div />' } },
	{ path: '/repositories/:repo', name: 'repository', component: RepositoryPage },
	{ path: '/repositories/:repo/source', name: 'repository-source', component: { template: '<div />' } },
	{ path: '/repositories/:repo/commits', name: 'repository-commits', component: { template: '<div />' } },
	{ path: '/repositories/:repo/commits/:hash', name: 'repository-commit', component: { template: '<div />' } },
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
	{ path: '/knots/:knot', name: 'knot', component: { template: '<div />' } },
	{ path: '/spindles/:spindle', name: 'spindle', component: { template: '<div />' } },
	{ path: '/labels/:scope', name: 'labels', component: { template: '<div />' } },
	{ path: '/repositories/:repo/pipelines/:pipeline?', name: 'pipelines', component: { template: '<div />' } },
]

function repository() {
	return {
		uri: repoUri,
		value: {
			$type: 'sh.tangled.repo',
			createdAt: '2026-08-01T00:00:00.000Z',
			description: 'A Tangled client.',
			knot: 'knot.tangled.example',
			name: 'Twisted',
			repoDid,
			source: 'https://source.example/twisted',
			spindle: 'spindle.example',
			topics: ['vue', 'typescript'],
			website: 'https://twisted.example',
		},
	}
}

function client(overrides: Partial<BobbinClient> = {}): BobbinClient {
	return {
		getRepo: vi.fn().mockResolvedValue(repository()),
		getRepositoryCounts: vi.fn().mockResolvedValue({ issues: 4, pulls: 2, stars: 9 }),
		getRepositoryLanguages: vi
			.fn()
			.mockResolvedValue({ ref: 'HEAD', languages: [{ name: 'TypeScript', percentage: 80, size: 100, fileCount: 5 }] }),
		getRepositoryTree: vi
			.fn()
			.mockResolvedValue({
				ref: 'HEAD',
				files: [],
				readme: { filename: 'README.md', contents: '# Welcome\n\nRead the project.' },
			}),
		listRepositoryCollaborators: vi
			.fn()
			.mockResolvedValue({
				items: [{ subject: 'did:plc:collaborator', addedBy: 'did:plc:owner', createdAt: '2026-08-01' }],
			}),
		listRepositoryLabels: vi
			.fn()
			.mockResolvedValue([
				{
					uri: 'at://did:plc:owner/sh.tangled.label.definition/bug',
					value: { $type: 'sh.tangled.label.definition', name: 'Bug' },
				},
			]),
		getRepositoryLog: vi
			.fn()
			.mockResolvedValue({
				ref: 'HEAD',
				items: [{ hash: 'a'.repeat(40), message: 'Ship the client', parents: [], author: { name: 'Ada' } }],
			}),
		repositoryArchiveUrl: vi.fn((_repo, format) => `https://api.example/archive.${format}`),
		...overrides,
	} as unknown as BobbinClient
}

describe('RepositoryPage', () => {
	beforeEach(() => {
		copiedText = []
		Object.defineProperty(navigator, 'clipboard', {
			configurable: true,
			value: { write: vi.fn().mockResolvedValue(undefined) },
		})
		Object.defineProperty(document, 'execCommand', {
			configurable: true,
			value: vi.fn(() => {
				copiedText.push(document.querySelector('textarea')?.value ?? '')
				return true
			}),
		})
	})
	afterEach(() => vi.unstubAllGlobals())

	test('renders identity, independent overview data, safe actions, and README content', async () => {
		const fakeClient = client()
		const wrapper = await mountIonicRoute(RepositoryPage, `/repositories/${encodeURIComponent(repoUri)}`, routes, {
			[BOBBIN_CLIENT_PROVIDER]: () => fakeClient,
			navManager: { handleNavigateBack: vi.fn() },
		})
		await flushPromises()
		await flushPromises()

		expect(wrapper.text()).toContain(repoUri)
		expect(wrapper.text()).toContain(repoDid)
		expect(wrapper.text()).toContain('TypeScript')
		expect(wrapper.text()).toContain('did:plc:collaborator')
		expect(wrapper.text()).toContain('Bug')
		expect(wrapper.text()).toContain('Welcome')
		expect(wrapper.text()).toContain('Ship the client')
		expect(wrapper.text()).toContain('Ada')
		expect(wrapper.text()).toContain('4 Issues')
		expect(wrapper.findAll('.repository-actions a')).toHaveLength(5)
		expect(wrapper.text()).toContain('View automation')
		expect(fakeClient.getRepositoryLanguages).toHaveBeenCalledWith(repositoryLocation, expect.any(Object))
		expect(fakeClient.getRepositoryTree).toHaveBeenCalledWith(repositoryLocation, { ref: 'HEAD' }, expect.any(Object))
		expect(fakeClient.getRepositoryLog).toHaveBeenCalledWith(
			repositoryLocation,
			expect.objectContaining({ ref: 'HEAD', limit: 6 }),
		)
		expect(fakeClient.repositoryArchiveUrl).toHaveBeenCalledWith(repositoryLocation, 'tar.gz')
		expect(fakeClient.repositoryArchiveUrl).toHaveBeenCalledWith(repositoryLocation, 'zip')

		await wrapper.findAll('.repository-actions button')[0].trigger('click')
		await wrapper.findAll('.repository-actions button')[1].trigger('click')
		expect(copiedText).toEqual([repoDid, `https://tangled.org/${repoDid}`])
	})

	test('keeps the README available when another overview section fails', async () => {
		const fakeClient = client({
			getRepositoryLanguages: vi
				.fn()
				.mockRejectedValue(new BobbinError('upstream-unavailable', 'languages unavailable')),
		} as Partial<BobbinClient>)
		const wrapper = await mountIonicRoute(RepositoryPage, `/repositories/${encodeURIComponent(repoUri)}`, routes, {
			[BOBBIN_CLIENT_PROVIDER]: () => fakeClient,
			navManager: { handleNavigateBack: vi.fn() },
		})
		await flushPromises()
		await flushPromises()

		expect(wrapper.text()).toContain('Part of Tangled is unavailable')
		expect(wrapper.text()).toContain('Welcome')
	})
})
