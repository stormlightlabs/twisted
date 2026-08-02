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

	test('repairs the empty author timestamp emitted by Rust knot tree responses', async () => {
		const fetch = vi
			.fn()
			.mockResolvedValue(
				new Response(
					JSON.stringify({
						ref: 'HEAD',
						files: [],
						lastCommit: {
							hash: 'a'.repeat(40),
							message: 'Ship it',
							when: '2026-08-01T00:00:00Z',
							author: { name: 'Ada', email: 'ada@example.com', when: '' },
						},
					}),
					{ headers: { 'content-type': 'application/json' } },
				),
			)
		const response = await createNormalizedResponseFetch(fetch)(
			'https://knot.example/xrpc/sh.tangled.repo.tree?repo=did%3Aplc%3Arepo&ref=HEAD',
		)

		await expect(response.json()).resolves.toMatchObject({ lastCommit: { author: { when: '2026-08-01T00:00:00Z' } } })
	})

	test('repairs the empty author timestamp emitted by Rust knot blob responses', async () => {
		const fetch = vi
			.fn()
			.mockResolvedValue(
				new Response(
					JSON.stringify({
						ref: 'main',
						path: 'README.md',
						content: '# Intrepid Ibex',
						encoding: 'utf-8',
						size: 16,
						isBinary: false,
						mimeType: 'text/markdown',
						lastCommit: {
							hash: 'a'.repeat(40),
							message: 'Ship it',
							when: '2026-08-01T00:00:00Z',
							author: { name: 'Ada', email: 'ada@example.com', when: '' },
						},
					}),
					{ headers: { 'content-type': 'application/json' } },
				),
			)
		const response = await createNormalizedResponseFetch(fetch)(
			'https://knot.example/xrpc/sh.tangled.repo.blob?repo=did%3Aplc%3Arepo&ref=main&path=README.md',
		)

		await expect(response.json()).resolves.toMatchObject({ lastCommit: { author: { when: '2026-08-01T00:00:00Z' } } })
	})
})
