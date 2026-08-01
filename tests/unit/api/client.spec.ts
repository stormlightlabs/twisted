import { ShTangledRepo } from '@atcute/tangled'
import { describe, expect, test, vi } from 'vitest'
import { BobbinClient, BobbinError, normalizeBobbinService } from '@/api'

const repoUri = 'at://did:plc:xg2vq45muivyy3xwatcehspu/sh.tangled.repo/3mho6hukiei22'

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
	return new Response(JSON.stringify(body), {
		status: 200,
		headers: { 'content-type': 'application/json', ...init.headers },
		...init,
	})
}

function repoRecord() {
	return {
		$type: 'sh.tangled.repo',
		createdAt: '2026-08-01T00:00:00.000Z',
		knot: 'https://tangled.sh',
		name: 'twisted',
		repoDid: 'did:plc:4iw5fospv2asv3344au236ka',
	}
}

describe('BobbinClient', () => {
	test('validates embedded repository records', async () => {
		const fetch = vi
			.fn<typeof globalThis.fetch>()
			.mockResolvedValue(jsonResponse({ uri: repoUri, value: repoRecord() }))
		const client = new BobbinClient({ fetch })

		await expect(client.getRepo(repoUri)).resolves.toMatchObject({
			uri: repoUri,
			value: { $type: 'sh.tangled.repo', name: 'twisted' },
		})
		expect(fetch).toHaveBeenCalledOnce()
	})

	test('rejects malformed embedded records', async () => {
		const fetch = vi
			.fn<typeof globalThis.fetch>()
			.mockResolvedValue(jsonResponse({ uri: repoUri, value: { ...repoRecord(), $type: 'wrong.type' } }))
		const client = new BobbinClient({ fetch })

		await expect(client.getRepo(repoUri)).rejects.toMatchObject({ kind: 'malformed-response' })
	})

	test('validates and paginates search hits', async () => {
		const fetch = vi
			.fn<typeof globalThis.fetch>()
			.mockResolvedValue(
				jsonResponse({
					cursor: 'next-page',
					hits: [{ uri: repoUri, nsid: 'sh.tangled.repo', score: 1.5, value: repoRecord() }],
				}),
			)
		const client = new BobbinClient({ fetch })

		const page = await client.search({ q: 'twisted' }, { 'sh.tangled.repo': ShTangledRepo.mainSchema })

		expect(page.cursor).toBe('next-page')
		expect(page.items[0].value.$type).toBe('sh.tangled.repo')
	})

	test('maps aborts separately from network failures', async () => {
		const controller = new AbortController()
		const fetch = vi.fn<typeof globalThis.fetch>().mockImplementation((_input, init) => {
			expect(init?.signal).toBe(controller.signal)
			return Promise.reject(new DOMException('Canceled', 'AbortError'))
		})
		const client = new BobbinClient({ fetch })

		await expect(client.getCoverage({ signal: controller.signal })).rejects.toEqual(
			expect.objectContaining<Partial<BobbinError>>({ kind: 'aborted' }),
		)
	})

	test('adds Bobbin knot proxy parameters without copying generated outputs', async () => {
		const fetch = vi
			.fn<typeof globalThis.fetch>()
			.mockResolvedValue(jsonResponse({ owner: 'did:plc:xg2vq45muivyy3xwatcehspu' }))
		const client = new BobbinClient({ fetch })

		await expect(client.getKnotOwner('knot.example')).resolves.toEqual({ owner: 'did:plc:xg2vq45muivyy3xwatcehspu' })
		expect(String(fetch.mock.calls[0][0])).toContain('knot=knot.example')
	})

	test('maps XRPC status and retry timing', async () => {
		const fetch = vi
			.fn<typeof globalThis.fetch>()
			.mockResolvedValue(
				jsonResponse(
					{ error: 'RateLimitExceeded', message: 'Slow down' },
					{ status: 429, headers: { 'retry-after': '3' } },
				),
			)
		const client = new BobbinClient({ fetch })

		await expect(client.getCoverage()).rejects.toEqual(
			expect.objectContaining<Partial<BobbinError>>({ kind: 'rate-limited', status: 429, retryAfterMs: 3_000 }),
		)
	})

	test('maps invalid top-level responses to malformed data', async () => {
		const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(jsonResponse({ ready: true }))
		const client = new BobbinClient({ fetch })

		await expect(client.getCoverage()).rejects.toMatchObject({ kind: 'malformed-response' })
	})
})

describe('normalizeBobbinService', () => {
	test('allows HTTPS services and removes one trailing slash', () => {
		expect(normalizeBobbinService('https://bobbin.example/')).toBe('https://bobbin.example')
	})

	test('rejects non-HTTPS services', () => {
		expect(() => normalizeBobbinService('http://bobbin.example')).toThrow('must use HTTPS')
	})
})
