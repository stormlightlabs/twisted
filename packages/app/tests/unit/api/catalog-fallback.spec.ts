import { createCatalogFallbackFetch } from '@/lib/api'
import { describe, expect, test, vi } from 'vitest'

function jsonResponse(body: unknown): Response {
	return new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } })
}

describe('catalog fallback transport', () => {
	test('keeps point lookups local and routes catalog queries while local coverage is not ready', async () => {
		const fetch = vi.fn(async (input: RequestInfo | URL) => {
			const url = new URL(input instanceof Request ? input.url : input)
			if (url.pathname.endsWith('getCoverage')) return jsonResponse({ ready: false })
			return jsonResponse({ origin: url.origin })
		})
		const hybridFetch = createCatalogFallbackFetch(fetch, { primaryService: 'http://localhost:8090' })

		const catalog = await hybridFetch('http://localhost:8090/xrpc/sh.tangled.repo.listRepos?subject=did%3Aplc%3Ame')
		const point = await hybridFetch('http://localhost:8090/xrpc/sh.tangled.repo.getRepo?repo=at%3A%2F%2Frepo')

		await expect(catalog.json()).resolves.toEqual({ origin: 'https://api.tangled.org' })
		await expect(point.json()).resolves.toEqual({ origin: 'http://localhost:8090' })
		expect(fetch).toHaveBeenCalledTimes(3)
	})

	test('uses a ready configured Bobbin for catalog queries', async () => {
		const fetch = vi.fn(async (input: RequestInfo | URL) => {
			const url = new URL(input instanceof Request ? input.url : input)
			if (url.pathname.endsWith('getCoverage')) return jsonResponse({ ready: true })
			return jsonResponse({ origin: url.origin })
		})
		const hybridFetch = createCatalogFallbackFetch(fetch, { primaryService: 'http://localhost:8090' })

		const response = await hybridFetch('http://localhost:8090/xrpc/sh.tangled.search.query?q=twisted')

		await expect(response.json()).resolves.toEqual({ origin: 'http://localhost:8090' })
	})
})
