import type { BobbinClient } from '@/lib/api'
import { BOBBIN_CLIENT_PROVIDER } from '@/lib/api'
import SearchPage from '@/views/SearchPage.vue'
import { flushPromises } from '@vue/test-utils'
import { describe, expect, test, vi } from 'vitest'
import { mountIonicRoute } from './support/mount'

function repoHit(name: string, uri: string) {
	return {
		uri,
		nsid: 'sh.tangled.repo',
		score: 1,
		value: { $type: 'sh.tangled.repo', createdAt: '2026-08-01T00:00:00.000Z', knot: 'tangled.org', name },
	}
}

describe('SearchPage', () => {
	test('passes every filter, preserves result order, and appends the next page once', async () => {
		const search = vi
			.fn()
			.mockResolvedValueOnce({
				items: [
					repoHit('First', 'at://did:plc:a/sh.tangled.repo/first'),
					repoHit('Second', 'at://did:plc:a/sh.tangled.repo/second'),
				],
				cursor: 'next',
			})
			.mockResolvedValueOnce({ items: [repoHit('Third', 'at://did:plc:a/sh.tangled.repo/third')] })
		const client = {
			service: 'https://example.test',
			getCoverage: vi.fn().mockResolvedValue({ ready: false, eventsProcessed: 1, lastCursor: 2 }),
			search,
		} as unknown as BobbinClient
		const wrapper = await mountIonicRoute(
			SearchPage,
			'/search?q=twisted&nsid=sh.tangled.repo&author=did:plc:a&repo=did:plc:r&since=2026-07-01&until=2026-08-01',
			[
				{ path: '/search', name: 'search', component: SearchPage },
				{ path: '/repositories/:repo', name: 'repository', component: { template: '<div />' } },
			],
			{ [BOBBIN_CLIENT_PROVIDER]: () => client },
		)
		await flushPromises()

		expect(search.mock.calls[0][0]).toMatchObject({
			q: 'twisted',
			nsid: 'sh.tangled.repo',
			author: 'did:plc:a',
			repo: 'did:plc:r',
			since: '2026-07-01T00:00:00.000Z',
			until: '2026-08-01T23:59:59.999Z',
		})
		expect(wrapper.findAll('.search-results li strong').map((item) => item.text())).toEqual(['First', 'Second'])
		expect(wrapper.text()).toContain('Some recent results may be missing')

		await wrapper.get('.search-results__more').trigger('click')
		await flushPromises()
		expect(wrapper.findAll('.search-results li strong').map((item) => item.text())).toEqual([
			'First',
			'Second',
			'Third',
		])
		expect(search).toHaveBeenCalledTimes(2)
	})

	test('shows invalid filters without making a request', async () => {
		const search = vi.fn()
		const client = {
			service: 'https://example.test',
			getCoverage: vi.fn().mockResolvedValue({ ready: true, eventsProcessed: 1, lastCursor: 1 }),
			search,
		} as unknown as BobbinClient
		const wrapper = await mountIonicRoute(
			SearchPage,
			'/search',
			[{ path: '/search', name: 'search', component: SearchPage }],
			{ [BOBBIN_CLIENT_PROVIDER]: () => client },
		)
		await wrapper.get('#search-query').setValue('twisted')
		await wrapper.get('input[placeholder="did:plc:…"]').setValue('invalid')
		await wrapper.get('form').trigger('submit')

		expect(wrapper.get('[role="alert"]').text()).toContain('author must be a complete DID')
		expect(search).not.toHaveBeenCalled()
	})

	test('shows a useful empty state', async () => {
		const client = {
			service: 'https://example.test',
			getCoverage: vi.fn().mockResolvedValue({ ready: true, eventsProcessed: 1, lastCursor: 1 }),
			search: vi.fn().mockResolvedValue({ items: [] }),
		} as unknown as BobbinClient
		const wrapper = await mountIonicRoute(
			SearchPage,
			'/search?q=nothing-here',
			[{ path: '/search', name: 'search', component: SearchPage }],
			{ [BOBBIN_CLIENT_PROVIDER]: () => client },
		)
		await flushPromises()

		expect(wrapper.get('.search-empty h2').text()).toBe('No matches yet')
	})
})
