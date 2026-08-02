import type { BobbinClient } from '@/lib/api'
import { BOBBIN_CLIENT_PROVIDER } from '@/lib/api'
import KnotPage from '@/views/KnotPage.vue'
import LabelsPage from '@/views/LabelsPage.vue'
import RecordThreadPage from '@/views/RecordThreadPage.vue'
import RepositoryPipelinesPage from '@/views/RepositoryPipelinesPage.vue'
import { flushPromises } from '@vue/test-utils'
import { describe, expect, test, vi } from 'vitest'
import { mountIonicRoute } from './support/mount'

const placeholder = { template: '<div />' }
const repo = 'at://did:plc:owner/sh.tangled.repo/twisted'
const repoDid = 'did:plc:repository'
const pipelineUri = 'at://did:plc:runner/sh.tangled.pipeline/3mho6hukiei22'

describe('T19-T21 read views', () => {
	test('renders a pipeline detail with running and failed history linked to its actors', async () => {
		const pipeline = {
			uri: pipelineUri,
			value: {
				$type: 'sh.tangled.pipeline',
				triggerMetadata: {
					kind: 'push',
					push: { oldSha: 'a'.repeat(40), newSha: 'b'.repeat(40), ref: 'main' },
					repo: { defaultBranch: 'main', did: repoDid, knot: 'knot.example' },
				},
				workflows: [
					{
						name: 'verify',
						engine: 'nix',
						raw: 'check',
						clone: { depth: 1, skip: false, submodules: false, tags: false },
					},
				],
			},
		}
		const status = (rkey: string, value: 'running' | 'failed') => ({
			uri: `at://did:plc:${rkey}/sh.tangled.pipeline.status/${rkey}`,
			value: {
				$type: 'sh.tangled.pipeline.status',
				createdAt: '2026-08-01T00:00:00.000Z',
				pipeline: pipelineUri,
				status: value,
				workflow: 'at://did:plc:runner/sh.tangled.pipeline.workflow/verify',
				...(value === 'failed' ? { error: 'Tests failed', exitCode: 1 } : {}),
			},
		})
		const client = {
			getRepo: vi
				.fn()
				.mockResolvedValue({
					uri: repo,
					value: {
						$type: 'sh.tangled.repo',
						createdAt: '2026-08-01T00:00:00.000Z',
						knot: 'knot.example',
						name: 'Twisted',
						repoDid,
					},
				}),
			getCoverage: vi.fn().mockResolvedValue({ ready: false, eventsProcessed: 4, lastCursor: 4 }),
			listPipelines: vi.fn().mockResolvedValue({ items: [pipeline] }),
			listArtifacts: vi.fn().mockResolvedValue({ items: [] }),
			getPipeline: vi.fn().mockResolvedValue(pipeline),
			listPipelineStatuses: vi
				.fn()
				.mockResolvedValue({ items: [status('runner', 'running'), status('reporter', 'failed')] }),
		} as unknown as BobbinClient
		const routes = [
			{ path: '/repositories/:repo', name: 'repository', component: placeholder },
			{ path: '/repositories/:repo/source', name: 'repository-source', component: placeholder },
			{ path: '/repositories/:repo/commits', name: 'repository-commits', component: placeholder },
			{ path: '/repositories/:repo/compare', name: 'repository-compare', component: placeholder },
			{ path: '/repositories/:repo/branches', name: 'repository-branches', component: placeholder },
			{ path: '/repositories/:repo/tags', name: 'repository-tags', component: placeholder },
			{ path: '/repositories/:repo/issues', name: 'issues', component: placeholder },
			{ path: '/repositories/:repo/pulls', name: 'pulls', component: placeholder },
			{
				path: '/repositories/:repo/relationships/:relationship?',
				name: 'repository-relationships',
				component: placeholder,
			},
			{ path: '/repositories/:repo/pipelines/:pipeline?', name: 'pipelines', component: RepositoryPipelinesPage },
			{ path: '/knots/:knot', name: 'knot', component: placeholder },
			{ path: '/profiles/:actor', name: 'profile', component: placeholder },
			{ path: '/search', name: 'search', component: placeholder },
		]
		const wrapper = await mountIonicRoute(
			RepositoryPipelinesPage,
			`/repositories/${encodeURIComponent(repo)}/pipelines/${encodeURIComponent(pipelineUri)}`,
			routes,
			{ [BOBBIN_CLIENT_PROVIDER]: () => client, navManager: { handleNavigateBack: vi.fn() } },
		)
		await flushPromises()

		expect(wrapper.text()).toContain('verify')
		expect(wrapper.text()).toContain('running')
		expect(wrapper.text()).toContain('Tests failed')
		expect(wrapper.text()).toContain('Some recent results may be missing')
		expect(wrapper.findAll('.status-history small a').map((link) => link.text())).toEqual([
			'did:plc:runner',
			'did:plc:reporter',
		])
	})

	test('renders label definitions, operation authors, targets, and selected history', async () => {
		const scope = 'repo scope / arbitrary'
		const definitionUri = 'at://did:plc:owner/sh.tangled.label.definition/priority'
		const client = {
			getCoverage: vi.fn().mockResolvedValue({ ready: true, eventsProcessed: 10, lastCursor: 10 }),
			listLabelDefinitions: vi
				.fn()
				.mockResolvedValue({
					items: [
						{
							uri: definitionUri,
							value: {
								$type: 'sh.tangled.label.definition',
								name: 'Priority',
								scope: ['sh.tangled.repo.issue'],
								valueType: { type: 'string', format: 'any' },
								createdAt: '2026-08-01T00:00:00.000Z',
							},
						},
					],
				}),
			listLabelOperations: vi
				.fn()
				.mockResolvedValue({
					items: [
						{
							uri: 'at://did:plc:moderator/sh.tangled.label.op/change',
							value: {
								$type: 'sh.tangled.label.op',
								add: [{ key: definitionUri, value: 'high' }],
								delete: [],
								performedAt: '2026-08-01T01:00:00.000Z',
								subject: 'at://did:plc:author/sh.tangled.repo.issue/issue',
							},
						},
					],
				}),
		} as unknown as BobbinClient
		const routes = [
			{ path: '/labels/:scope', name: 'labels', component: LabelsPage },
			{ path: '/profiles/:actor', name: 'profile', component: placeholder },
			{ path: '/search', name: 'search', component: placeholder },
		]
		const wrapper = await mountIonicRoute(
			LabelsPage,
			`/labels/${encodeURIComponent(scope)}?definition=${encodeURIComponent(definitionUri)}`,
			routes,
			{ [BOBBIN_CLIENT_PROVIDER]: () => client, navManager: { handleNavigateBack: vi.fn() } },
		)
		await flushPromises()

		expect(client.listLabelDefinitions).toHaveBeenCalledWith(scope, expect.any(Object))
		expect(wrapper.text()).toContain('Priority')
		expect(wrapper.text()).toContain('did:plc:moderator')
		expect(wrapper.text()).toContain('sh.tangled.repo.issue')
		expect(wrapper.text()).toContain('high')
	})

	test('renders string contents as inert text and exposes its discussion', async () => {
		const uri = 'at://did:plc:author/sh.tangled.string/snippet'
		const client = {
			getString: vi
				.fn()
				.mockResolvedValue({
					uri,
					value: {
						$type: 'sh.tangled.string',
						filename: 'unsafe.html',
						description: 'An example',
						contents: '<script>alert(1)</script>',
						createdAt: '2026-08-01T00:00:00.000Z',
					},
				}),
			listComments: vi.fn().mockResolvedValue({ items: [] }),
			countComments: vi.fn().mockResolvedValue({ count: 0, distinctAuthors: 0 }),
		} as unknown as BobbinClient
		const routes = [
			{ path: '/strings/:uri', name: 'string', component: RecordThreadPage },
			{ path: '/profiles/:actor', name: 'profile', component: placeholder },
		]
		const wrapper = await mountIonicRoute(RecordThreadPage, `/strings/${encodeURIComponent(uri)}`, routes, {
			[BOBBIN_CLIENT_PROVIDER]: () => client,
			navManager: { handleNavigateBack: vi.fn() },
		})
		await flushPromises()

		expect(wrapper.text()).toContain('<script>alert(1)</script>')
		expect(wrapper.find('pre script').exists()).toBe(false)
		expect(wrapper.text()).toContain('No comments found')
	})

	test('discloses roster freshness and renders knot owner, version, members, and copyable keys', async () => {
		const client = {
			getCoverage: vi.fn().mockResolvedValue({ ready: true, eventsProcessed: 10, lastCursor: 10 }),
			getKnotOwner: vi.fn().mockResolvedValue({ owner: 'did:plc:owner' }),
			getKnotVersion: vi.fn().mockResolvedValue({ version: '1.2.3', capabilities: ['knot-acl'] }),
			listKnotMembers: vi
				.fn()
				.mockResolvedValue({
					items: [{ subject: 'did:plc:member', addedBy: 'did:plc:admin', createdAt: '2026-08-01T00:00:00.000Z' }],
				}),
			listKnotKeys: vi
				.fn()
				.mockResolvedValue({
					keys: [{ did: 'did:plc:service', key: 'ssh-ed25519 AAAA', createdAt: '2026-08-01T00:00:00.000Z' }],
				}),
		} as unknown as BobbinClient
		const routes = [
			{ path: '/knots/:knot', name: 'knot', component: KnotPage },
			{ path: '/profiles/:actor', name: 'profile', component: placeholder },
		]
		const wrapper = await mountIonicRoute(KnotPage, '/knots/knot.example', routes, {
			[BOBBIN_CLIENT_PROVIDER]: () => client,
			navManager: { handleNavigateBack: vi.fn() },
		})
		await flushPromises()

		expect(wrapper.text()).toContain('Roster freshness is not verified')
		expect(wrapper.text()).toContain('1.2.3')
		expect(wrapper.text()).toContain('did:plc:member')
		expect(wrapper.text()).toContain('ssh-ed25519 AAAA')
		expect(wrapper.text()).toContain('Copy service key')
	})
})
