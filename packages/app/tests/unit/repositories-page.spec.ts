import type { BobbinClient } from '@/lib/api'
import { BOBBIN_CLIENT_PROVIDER } from '@/lib/api'
import RepositoriesPage from '@/views/RepositoriesPage.vue'
import { flushPromises } from '@vue/test-utils'
import { describe, expect, test, vi } from 'vitest'
import { mountIonicRoute } from './support/mount'

const repoUri = 'at://did:plc:person/sh.tangled.repo/3mrepo'

function routes() {
	return [
		{ path: '/repositories', name: 'repositories', component: RepositoriesPage },
		{ path: '/repositories/:repo', name: 'repository', component: { template: '<div />' } },
		{ path: '/profiles/:actor', name: 'profile', component: { template: '<div />' } },
	]
}

describe('RepositoriesPage', () => {
	test('resolves an owner and renders repository names with rkeys', async () => {
		const client = {
			resolveIdentity: vi
				.fn()
				.mockResolvedValue({
					did: 'did:plc:person',
					handle: 'person.example',
					pds: 'https://pds.example',
					signing_key: 'key',
				}),
			listPdsRepos: vi
				.fn()
				.mockResolvedValue({
					items: [
						{
							uri: repoUri,
							value: {
								$type: 'sh.tangled.repo',
								createdAt: '2026-08-01T00:00:00.000Z',
								knot: 'https://tangled.org',
								name: 'Twisted',
								repoDid: 'did:plc:repo',
							},
						},
					],
				}),
		} as unknown as BobbinClient
		const wrapper = await mountIonicRoute(RepositoriesPage, '/repositories?owner=person.example', routes(), {
			[BOBBIN_CLIENT_PROVIDER]: () => client,
		})
		await flushPromises()

		expect(wrapper.get('.repositories-page__owner strong').text()).toBe('@person.example')
		expect(wrapper.get('.repo-card strong').text()).toBe('Twisted')
		expect(wrapper.get('.repo-card > div code').text()).toBe('3mrepo')
	})

	test('opens a complete repository AT-URI directly', async () => {
		const wrapper = await mountIonicRoute(RepositoriesPage, '/repositories', routes(), {
			[BOBBIN_CLIENT_PROVIDER]: () => ({}) as BobbinClient,
		})
		await wrapper.get('input').setValue(repoUri)
		await wrapper.get('form').trigger('submit')
		await flushPromises()
		expect(wrapper.vm.$route.name).toBe('repository')
		expect(wrapper.vm.$route.params.repo).toBe(repoUri)
	})
})
