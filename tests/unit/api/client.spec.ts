import { ShTangledRepo } from '@atcute/tangled'
import { describe, expect, test, vi } from 'vitest'
import {
	actorActivityKinds,
	BobbinClient,
	BobbinError,
	MAX_RENDERED_PATCH_BYTES,
	normalizeRepositoryPatch,
	normalizeBobbinService,
} from '@/lib/api'

const repoUri = 'at://did:plc:xg2vq45muivyy3xwatcehspu/sh.tangled.repo/3mho6hukiei22'

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
	return new Response(JSON.stringify(body), {
		status: 200,
		headers: { 'content-type': 'application/json', ...init.headers },
		...init,
	})
}

function fetchMock() {
	return vi.fn<[input: RequestInfo | URL, init?: RequestInit], Promise<Response>>()
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
	test('accepts Bobbin list responses with a null cursor', async () => {
		const fetch = fetchMock().mockResolvedValue(jsonResponse({ items: [], cursor: null }))
		const client = new BobbinClient({ fetch })

		await expect(client.listRepos('did:plc:person')).resolves.toEqual({ items: [], cursor: undefined })
	})

	test('removes blank placeholders from older actor profiles before validation', async () => {
		const profileUri = 'at://did:plc:person/sh.tangled.actor.profile/self'
		const fetch = fetchMock().mockResolvedValue(
			jsonResponse({
				uri: profileUri,
				value: {
					$type: 'sh.tangled.actor.profile',
					bluesky: true,
					links: ['https://person.example', '', '  '],
					stats: ['', 'repository-count'],
				},
			}),
		)
		const client = new BobbinClient({ fetch })

		await expect(client.getProfile(profileUri)).resolves.toMatchObject({
			value: { links: ['https://person.example'], stats: ['repository-count'] },
		})
	})

	test('validates embedded repository records', async () => {
		const fetch = fetchMock().mockResolvedValue(jsonResponse({ uri: repoUri, value: repoRecord() }))
		const client = new BobbinClient({ fetch })

		await expect(client.getRepo(repoUri)).resolves.toMatchObject({
			uri: repoUri,
			value: { $type: 'sh.tangled.repo', name: 'twisted' },
		})
		expect(fetch).toHaveBeenCalledOnce()
	})

	test('validates repository DID and ordered batch lookups', async () => {
		const secondUri = repoUri.replace('3mho6hukiei22', 'second')
		const fetch = fetchMock()
			.mockResolvedValueOnce(jsonResponse({ uri: repoUri, value: repoRecord() }))
			.mockResolvedValueOnce(
				jsonResponse({
					items: [
						{ uri: repoUri, value: repoRecord() },
						{ uri: secondUri, value: { ...repoRecord(), name: 'second' } },
					],
				}),
			)
		const client = new BobbinClient({ fetch })

		await expect(client.getRepoByRepoDid('did:plc:4iw5fospv2asv3344au236ka')).resolves.toMatchObject({ uri: repoUri })
		await expect(client.getRepos([repoUri, secondUri] as Parameters<BobbinClient['getRepos']>[0])).resolves.toEqual([
			expect.objectContaining({ uri: repoUri }),
			expect.objectContaining({ uri: secondUri }),
		])
	})

	test('rejects malformed embedded records', async () => {
		const fetch = fetchMock().mockResolvedValue(
			jsonResponse({ uri: repoUri, value: { ...repoRecord(), $type: 'wrong.type' } }),
		)
		const client = new BobbinClient({ fetch })

		await expect(client.getRepo(repoUri)).rejects.toMatchObject({ kind: 'malformed-response' })
	})

	test('validates and paginates search hits', async () => {
		const fetch = fetchMock().mockResolvedValue(
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

	test('validates and paginates actor activity through its typed query', async () => {
		const reactionUri = 'at://did:plc:person/sh.tangled.feed.reaction/3mho6hukiei22'
		const fetch = fetchMock().mockResolvedValue(
			jsonResponse({
				cursor: 'next-page',
				items: [
					{
						uri: reactionUri,
						value: {
							$type: 'sh.tangled.feed.reaction',
							createdAt: '2026-08-01T00:00:00.000Z',
							reaction: '👍',
							subject: repoUri,
						},
					},
				],
			}),
		)
		const client = new BobbinClient({ fetch })

		await expect(client.listActorActivity('reactions', 'did:plc:person', { limit: 10 })).resolves.toEqual({
			cursor: 'next-page',
			items: [expect.objectContaining({ uri: reactionUri, value: expect.objectContaining({ reaction: '👍' }) })],
		})
		const requestUrl = new URL(String(fetch.mock.calls[0][0]))
		expect(requestUrl.pathname).toBe('/xrpc/sh.tangled.feed.listReactionsBy')
		expect(requestUrl.searchParams.get('subject')).toBe('did:plc:person')
		expect(requestUrl.searchParams.get('limit')).toBe('10')
	})

	test('passes issue state filters to the actor activity query', async () => {
		const fetch = fetchMock().mockImplementation(async () => jsonResponse({ items: [] }))
		const client = new BobbinClient({ fetch })

		await client.listActorActivity('issues', 'did:plc:person', { state: 'open' })
		const requestUrl = new URL(String(fetch.mock.calls[0][0]))
		expect(requestUrl.pathname).toBe('/xrpc/sh.tangled.repo.listIssuesBy')
		expect(requestUrl.searchParams.get('state')).toBe('open')
	})

	test('dispatches every actor activity family through its published query', async () => {
		const endpoints = [
			'sh.tangled.feed.listCommentsBy',
			'sh.tangled.feed.listReactionsBy',
			'sh.tangled.feed.listStarsBy',
			'sh.tangled.graph.listFollowsBy',
			'sh.tangled.graph.listVouchesBy',
			'sh.tangled.repo.listIssuesBy',
			'sh.tangled.repo.listPullsBy',
			'sh.tangled.repo.issue.listStatesBy',
			'sh.tangled.repo.pull.listStatusesBy',
			'sh.tangled.git.listRefUpdatesBy',
			'sh.tangled.repo.listCollaboratorsBy',
			'sh.tangled.label.listOpsBy',
			'sh.tangled.pipeline.listPipelinesBy',
			'sh.tangled.pipeline.listStatusesBy',
			'sh.tangled.repo.listArtifactsBy',
			'sh.tangled.knot.listMembersBy',
			'sh.tangled.spindle.listMembersBy',
		]
		const fetch = fetchMock().mockImplementation(async () => jsonResponse({ items: [] }))
		const client = new BobbinClient({ fetch })

		for (const kind of actorActivityKinds) await client.listActorActivity(kind, 'did:plc:person')

		expect(fetch.mock.calls.map((call) => new URL(String(call[0])).pathname.replace('/xrpc/', ''))).toEqual(endpoints)
	})

	test('builds read-only repository archive links without losing repository identity', () => {
		const client = new BobbinClient({ service: 'https://api.example' })

		const archive = new URL(client.repositoryArchiveUrl('did:plc:4iw5fospv2asv3344au236ka', 'zip'))
		expect(archive.origin).toBe('https://api.example')
		expect(archive.pathname).toBe('/xrpc/sh.tangled.repo.archive')
		expect(archive.searchParams.get('repo')).toBe('did:plc:4iw5fospv2asv3344au236ka')
		expect(archive.searchParams.get('ref')).toBe('HEAD')
		expect(archive.searchParams.get('format')).toBe('zip')
	})

	test('encodes patch refs and comparison direction at the API boundary', () => {
		const client = new BobbinClient({ service: 'https://api.example' })
		const ref = 'refs/heads/feature a&b'
		const diff = new URL(client.repositoryDiffUrl(repoUri, ref))
		const compare = new URL(client.repositoryCompareUrl(repoUri, 'main', ref))

		expect(diff.searchParams.get('repo')).toBe(repoUri)
		expect(diff.searchParams.get('ref')).toBe(ref)
		expect(compare.searchParams.get('rev1')).toBe('main')
		expect(compare.searchParams.get('rev2')).toBe(ref)
	})

	test('normalizes Bobbin diff and compare envelopes as unified patches', () => {
		const file = {
			OldName: 'src/old.ts',
			NewName: 'src/new.ts',
			TextFragments: [
				{
					Comment: 'renameValue',
					OldPosition: 4,
					OldLines: 2,
					NewPosition: 4,
					NewLines: 2,
					Lines: [
						{ Op: 1, Line: 'const oldValue = 1\n' },
						{ Op: 2, Line: 'const newValue = 1\n' },
					],
				},
			],
		}
		const expected = [
			'diff --git a/src/old.ts b/src/new.ts',
			'--- a/src/old.ts',
			'+++ b/src/new.ts',
			'@@ -4,2 +4,2 @@ renameValue',
			'-const oldValue = 1',
			'+const newValue = 1',
			'',
		].join('\n')

		expect(normalizeRepositoryPatch(JSON.stringify({ format_patch: [{ Files: [file] }] }))).toBe(expected)
		expect(
			normalizeRepositoryPatch(
				JSON.stringify({
					diff: { diff: [{ name: { old: 'src/old.ts', new: 'src/new.ts' }, text_fragments: file.TextFragments }] },
				}),
			),
		).toBe(expected)
	})

	test('stops reading patches that exceed the display limit', async () => {
		const cancel = vi.fn()
		const stream = new ReadableStream<Uint8Array>({
			start(controller) {
				controller.enqueue(new Uint8Array(MAX_RENDERED_PATCH_BYTES + 1))
			},
			cancel,
		})
		const fetch = fetchMock().mockResolvedValue(new Response(stream, { headers: { 'content-type': 'text/x-diff' } }))
		const client = new BobbinClient({ fetch })

		await expect(client.getRepositoryDiff(repoUri, 'HEAD')).resolves.toEqual({
			kind: 'too-large',
			bytes: MAX_RENDERED_PATCH_BYTES + 1,
			contentType: 'text/x-diff',
			filename: undefined,
		})
		expect(cancel).toHaveBeenCalledOnce()
	})

	test('preserves streamed archive response and request metadata', async () => {
		const stream = new ReadableStream<Uint8Array>()
		const fetch = fetchMock().mockResolvedValue(
			new Response(stream, {
				status: 206,
				headers: {
					'cache-control': 'public, max-age=60',
					'content-disposition': "attachment; filename*=UTF-8''twisted%20main.zip",
					'content-length': '10',
					'content-range': 'bytes 0-9/100',
					'content-type': 'application/zip',
					etag: '"archive-1"',
					'last-modified': 'Sat, 01 Aug 2026 12:00:00 GMT',
				},
			}),
		)
		const client = new BobbinClient({ fetch })

		await expect(
			client.getRepositoryArchive(repoUri, {
				format: 'zip',
				ref: 'feature/a b',
				prefix: 'twisted/',
				range: 'bytes=0-9',
			}),
		).resolves.toEqual({
			body: stream,
			status: 206,
			cacheControl: 'public, max-age=60',
			contentLength: 10,
			contentRange: 'bytes 0-9/100',
			contentType: 'application/zip',
			etag: '"archive-1"',
			filename: 'twisted main.zip',
			lastModified: 'Sat, 01 Aug 2026 12:00:00 GMT',
		})
		const [input, init] = fetch.mock.calls[0]
		const url = new URL(String(input))
		expect(url.searchParams.get('ref')).toBe('feature/a b')
		expect(url.searchParams.get('prefix')).toBe('twisted/')
		expect(init?.headers).toMatchObject({ range: 'bytes=0-9' })
	})

	test('uses Bobbin repository record identifiers for proxied blob queries', async () => {
		const fetch = fetchMock().mockResolvedValue(
			jsonResponse({ path: 'README.md', ref: 'HEAD', content: '# Tempest', encoding: 'utf-8', size: 9 }),
		)
		const client = new BobbinClient({ fetch })

		await expect(client.getRepositoryBlob(repoUri, 'HEAD', 'README.md')).resolves.toMatchObject({
			path: 'README.md',
			content: '# Tempest',
		})
		const url = new URL(String(fetch.mock.calls[0][0]))
		expect(url.searchParams.get('repo')).toBe(repoUri)
	})

	test('fetches profile avatars as CORS blobs for COEP-safe object URLs', async () => {
		const fetch = fetchMock().mockResolvedValue(
			new Response(new Uint8Array([137, 80, 78, 71]), { headers: { 'content-type': 'image/png' } }),
		)
		const client = new BobbinClient({ fetch })

		const blob = await client.getProfileAvatar('https://pds.example', 'did:plc:person', 'bafk-avatar')

		expect(blob.type).toBe('image/png')
		const [input, init] = fetch.mock.calls[0]
		const url = new URL(String(input))
		expect(url.pathname).toBe('/xrpc/com.atproto.sync.getBlob')
		expect(url.searchParams.get('did')).toBe('did:plc:person')
		expect(url.searchParams.get('cid')).toBe('bafk-avatar')
		expect(init).toMatchObject({ credentials: 'omit', mode: 'cors', referrerPolicy: 'no-referrer' })
	})

	test('normalizes branch pages and advances an offset cursor once', async () => {
		const fetch = fetchMock().mockResolvedValue(
			jsonResponse({
				branches: [
					{
						reference: { name: 'main', hash: 'a'.repeat(40) },
						commit: {
							Author: { Name: 'Ada', Email: 'ada@example.com', When: '2026-08-01T00:00:00Z' },
							Message: 'First',
						},
						is_default: true,
					},
					{ reference: { name: 'next', hash: 'b'.repeat(40) } },
				],
			}),
		)
		const client = new BobbinClient({ fetch })

		await expect(client.listRepositoryBranches('did:plc:repo', { limit: 1 })).resolves.toEqual({
			items: [
				expect.objectContaining({
					name: 'main',
					hash: 'a'.repeat(40),
					isDefault: true,
					author: expect.objectContaining({ name: 'Ada' }),
				}),
			],
			cursor: '1',
		})
		const url = new URL(String(fetch.mock.calls[0][0]))
		expect(url.searchParams.get('limit')).toBe('2')
	})

	test('normalizes commit pages and derives the next page from the returned totals', async () => {
		const hash = '0123456789abcdef0123456789abcdef01234567'
		const parent = 'fedcba9876543210fedcba9876543210fedcba98'
		const fetch = fetchMock().mockResolvedValue(
			jsonResponse({
				commits: [{ this: hash, parent, message: 'Ship it', author: { Name: 'Grace', When: '2026-08-01T00:00:00Z' } }],
				ref: 'main',
				total: 3,
				page: 1,
				per_page: 1,
			}),
		)
		const client = new BobbinClient({ fetch })

		await expect(client.getRepositoryLog('did:plc:repo', { ref: 'main', limit: 1 })).resolves.toEqual({
			items: [
				expect.objectContaining({
					hash,
					parents: [parent],
					message: 'Ship it',
					author: expect.objectContaining({ name: 'Grace' }),
				}),
			],
			cursor: '2',
			ref: 'main',
			total: 3,
		})
	})

	test('maps aborts separately from network failures', async () => {
		const controller = new AbortController()
		let requestSignal!: AbortSignal
		const fetch = fetchMock().mockImplementation((_input, init) => {
			requestSignal = init?.signal as AbortSignal
			return new Promise((_resolve, reject) => {
				requestSignal.addEventListener('abort', () => reject(new DOMException('Canceled', 'AbortError')), {
					once: true,
				})
			})
		})
		const client = new BobbinClient({ fetch })
		const request = client.getCoverage({ signal: controller.signal })
		controller.abort()

		await expect(request).rejects.toEqual(expect.objectContaining<Partial<BobbinError>>({ kind: 'aborted' }))
		expect(requestSignal.aborted).toBe(true)
	})

	test('deduplicates concurrent identical Bobbin calls', async () => {
		let resolveFetch!: (response: Response) => void
		const fetch = fetchMock().mockImplementation(
			() =>
				new Promise<Response>((resolve) => {
					resolveFetch = resolve
				}),
		)
		const client = new BobbinClient({ fetch })
		const first = client.getCoverage()
		const second = client.getCoverage()
		resolveFetch(jsonResponse({ ready: true, eventsProcessed: 100, lastCursor: 120 }))

		await expect(Promise.all([first, second])).resolves.toEqual([
			{ ready: true, eventsProcessed: 100, lastCursor: 120 },
			{ ready: true, eventsProcessed: 100, lastCursor: 120 },
		])
		expect(fetch).toHaveBeenCalledOnce()
	})

	test('reloads a cached query only when requested', async () => {
		const fetch = fetchMock()
			.mockResolvedValueOnce(jsonResponse({ ready: true, eventsProcessed: 100, lastCursor: 120 }))
			.mockResolvedValueOnce(jsonResponse({ ready: true, eventsProcessed: 101, lastCursor: 121 }))
		const client = new BobbinClient({ fetch })

		await client.getCoverage()
		await client.getCoverage()
		await expect(client.getCoverage({ cache: 'reload' })).resolves.toMatchObject({ eventsProcessed: 101 })
		expect(fetch).toHaveBeenCalledTimes(2)
	})

	test('adds Bobbin knot proxy parameters without copying generated outputs', async () => {
		const fetch = fetchMock().mockResolvedValue(jsonResponse({ owner: 'did:plc:xg2vq45muivyy3xwatcehspu' }))
		const client = new BobbinClient({ fetch })

		await expect(client.getKnotOwner('knot.example')).resolves.toEqual({ owner: 'did:plc:xg2vq45muivyy3xwatcehspu' })
		expect(String(fetch.mock.calls[0][0])).toContain('knot=knot.example')
	})

	test('maps XRPC status and retry timing', async () => {
		const fetch = fetchMock().mockResolvedValue(
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
		const fetch = fetchMock().mockResolvedValue(jsonResponse({ ready: true }))
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
