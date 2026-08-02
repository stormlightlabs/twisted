import { createNormalizedResponseFetch } from '@/lib/api'
import { describe, expect, test, vi } from 'vitest'

describe('Bobbin response normalization', () => {
	test('omits a nullable top-level cursor from JSON list responses', async () => {
		const fetch = vi
			.fn()
			.mockResolvedValue(
				new Response(JSON.stringify({ items: [], cursor: null }), {
					headers: { 'content-type': 'application/json', 'content-length': '26' },
				}),
			)
		const response = await createNormalizedResponseFetch(fetch)('https://example.com/list')

		expect(await response.json()).toEqual({ items: [] })
		expect(response.headers.has('content-length')).toBe(false)
	})

	test('does not rewrite error responses', async () => {
		const fetch = vi
			.fn()
			.mockResolvedValue(
				new Response(JSON.stringify({ error: 'RateLimitExceeded', cursor: null }), {
					status: 429,
					headers: { 'content-type': 'application/json' },
				}),
			)
		const response = await createNormalizedResponseFetch(fetch)('https://example.com/list')

		expect(await response.json()).toEqual({ error: 'RateLimitExceeded', cursor: null })
	})
})
