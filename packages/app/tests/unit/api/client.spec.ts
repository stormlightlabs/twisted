import { ShTangledRepo } from '@atcute/tangled'
import { describe, expect, test, vi } from 'vitest'
import {
	actorActivityKinds,
	BobbinClient,
	BobbinError,
	MAX_RENDERED_PATCH_BYTES,
	normalizeRepositoryPatch,
	normalizeBobbinService,
	normalizeKnotService,
} from '@/lib/api'
import type { RepositoryLocation } from '@/lib/api'

const repoUri = 'at://did:plc:xg2vq45muivyy3xwatcehspu/sh.tangled.repo/3mho6hukiei22'
const repositoryLocation = {
	did: 'did:plc:4iw5fospv2asv3344au236ka',
	knot: 'knot.example',
} satisfies RepositoryLocation

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
	test('presents an unresolved handle as a missing identity', async () => {
		const fetch = fetchMock().mockResolvedValue(
			jsonResponse({ error: 'UpstreamFailure', message: 'handle did not resolve' }, { status: 502 }),
		)
		const client = new BobbinClient({ fetch })

		await expect(client.resolveIdentity('desertthunder.defv')).rejects.toMatchObject({ kind: 'identity-not-found' })
	})

	test('accepts public knot hosts without allowing insecure or path-scoped origins', () => {
		expect(normalizeKnotService('knot.example')).toBe('https://knot.example')
		expect(normalizeKnotService('https://knot.example/')).toBe('https://knot.example')
		expect(() => normalizeKnotService('http://knot.example')).toThrow('repository knot address is invalid')
		expect(() => normalizeKnotService('https://knot.example/private')).toThrow('repository knot address is invalid')
	})

	test('accepts Bobbin list responses with a null cursor', async () => {
		const fetch = fetchMock().mockResolvedValue(jsonResponse({ items: [], cursor: null }))
		const client = new BobbinClient({ fetch })

		await expect(client.listRepos('did:plc:person')).resolves.toEqual({ items: [], cursor: undefined })
	})

	test('lists repository records directly from an actor PDS', async () => {
		const fetch = fetchMock().mockResolvedValue(
			jsonResponse({
				cursor: 'next-page',
				records: [
					{ uri: repoUri, cid: 'bafyreicrfpnvmlnd7x5nvfsytxpehmpirnzx7u6kzwxebtdkd5npjxbsmy', value: repoRecord() },
				],
			}),
		)
		const client = new BobbinClient({ fetch })

		await expect(client.listPdsRepos('did:plc:person', 'https://pds.example', { limit: 100 })).resolves.toEqual({
			cursor: 'next-page',
			items: [expect.objectContaining({ uri: repoUri, value: expect.objectContaining({ name: 'twisted' }) })],
		})
		const requestUrl = new URL(String(fetch.mock.calls[0][0]))
		expect(requestUrl.origin).toBe('https://pds.example')
		expect(requestUrl.pathname).toBe('/xrpc/com.atproto.repo.listRecords')
		expect(requestUrl.searchParams.get('collection')).toBe('sh.tangled.repo')
		expect(requestUrl.searchParams.get('repo')).toBe('did:plc:person')
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

	test('searches public Bluesky actors for DID typeahead', async () => {
		const fetch = fetchMock().mockResolvedValue(
			jsonResponse({ actors: [{ did: 'did:plc:person', handle: 'person.example', displayName: 'Person' }] }),
		)
		const client = new BobbinClient({ fetch })

		await expect(client.searchActorsTypeahead(' person ')).resolves.toEqual([
			expect.objectContaining({ did: 'did:plc:person', handle: 'person.example' }),
		])
		const requestUrl = new URL(String(fetch.mock.calls[0][0]))
		expect(requestUrl.origin).toBe('https://public.api.bsky.app')
		expect(requestUrl.pathname).toBe('/xrpc/app.bsky.actor.searchActorsTypeahead')
		expect(requestUrl.searchParams.get('q')).toBe('person')
		expect(requestUrl.searchParams.get('limit')).toBe('8')
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

	test('validates the T19-T21 indexed record families and preserves their cursors', async () => {
		const fetch = fetchMock().mockImplementation(async () => jsonResponse({ items: [], cursor: 'next' }))
		const client = new BobbinClient({ fetch })

		await expect(client.listPipelines('did:plc:repository')).resolves.toEqual({ items: [], cursor: 'next' })
		await expect(client.listPipelineStatuses('at://did:plc:actor/sh.tangled.pipeline/3mho6hukiei22')).resolves.toEqual({
			items: [],
			cursor: 'next',
		})
		await expect(client.listArtifacts('did:plc:repository')).resolves.toEqual({ items: [], cursor: 'next' })
		await expect(client.listLabelDefinitions('repo scope / with spaces')).resolves.toEqual({
			items: [],
			cursor: 'next',
		})
		await expect(client.listLabelOperations('repo scope / with spaces')).resolves.toEqual({ items: [], cursor: 'next' })
		await expect(client.listStrings('repo scope / with spaces')).resolves.toEqual({ items: [], cursor: 'next' })
		await expect(client.listKnots('did:plc:owner')).resolves.toEqual({ items: [], cursor: 'next' })
		await expect(client.listSpindles('did:plc:owner')).resolves.toEqual({ items: [], cursor: 'next' })
		await expect(client.listSpindleMembers('spindle.example')).resolves.toEqual({ items: [], cursor: 'next' })
		await expect(client.listPublicKeys('did:plc:owner')).resolves.toEqual({ items: [], cursor: 'next' })

		expect(fetch.mock.calls.map((call) => new URL(String(call[0])).pathname)).toEqual([
			'/xrpc/sh.tangled.pipeline.listPipelines',
			'/xrpc/sh.tangled.pipeline.listStatuses',
			'/xrpc/sh.tangled.repo.listArtifacts',
			'/xrpc/sh.tangled.label.listDefinitions',
			'/xrpc/sh.tangled.label.listOps',
			'/xrpc/sh.tangled.string.listStrings',
			'/xrpc/sh.tangled.knot.listKnots',
			'/xrpc/sh.tangled.spindle.listSpindles',
			'/xrpc/sh.tangled.spindle.listMembers',
			'/xrpc/sh.tangled.publicKey.listKeys',
		])
		expect(fetch.mock.calls.some((call) => String(call[0]).includes('listSecrets'))).toBe(false)
	})

	test('rejects unsafe arbitrary scope identifiers before issuing a request', async () => {
		const fetch = fetchMock()
		const client = new BobbinClient({ fetch })

		await expect(client.listLabelDefinitions('bad\nsubject')).rejects.toMatchObject({ kind: 'invalid-request' })
		await expect(client.listStrings('')).rejects.toMatchObject({ kind: 'invalid-request' })
		expect(fetch).not.toHaveBeenCalled()
	})

	test('passes issue state filters to the actor activity query', async () => {
		const fetch = fetchMock().mockImplementation(async () => jsonResponse({ items: [] }))
		const client = new BobbinClient({ fetch })

		await client.listActorActivity('issues', 'did:plc:person', { state: 'open' })
		const requestUrl = new URL(String(fetch.mock.calls[0][0]))
		expect(requestUrl.pathname).toBe('/xrpc/sh.tangled.repo.listIssuesBy')
		expect(requestUrl.searchParams.get('state')).toBe('open')
	})

	test('serializes repository work-item filters and preserves derived list metadata', async () => {
		const issueUri = 'at://did:plc:author/sh.tangled.repo.issue/3mho6hukiei22'
		const fetch = fetchMock().mockResolvedValue(
			jsonResponse({
				cursor: 'next-page',
				items: [
					{
						uri: issueUri,
						commentCount: 7,
						state: 'closed',
						stateUpdatedAt: '2026-08-01T01:00:00.000Z',
						value: {
							$type: 'sh.tangled.repo.issue',
							createdAt: '2026-08-01T00:00:00.000Z',
							repo: 'did:plc:repository',
							title: 'Use derived state',
						},
					},
				],
			}),
		)
		const client = new BobbinClient({ fetch })

		await expect(
			client.listIssues('did:plc:repository', {
				author: 'did:plc:author',
				cursor: 'page-1',
				limit: 20,
				order: 'asc',
				state: 'closed',
			}),
		).resolves.toMatchObject({
			cursor: 'next-page',
			items: [{ uri: issueUri, commentCount: 7, state: 'closed', value: { title: 'Use derived state' } }],
		})
		const requestUrl = new URL(String(fetch.mock.calls[0][0]))
		expect(requestUrl.pathname).toBe('/xrpc/sh.tangled.repo.listIssues')
		expect(Object.fromEntries(requestUrl.searchParams)).toMatchObject({
			subject: 'did:plc:repository',
			author: 'did:plc:author',
			cursor: 'page-1',
			limit: '20',
			order: 'asc',
			state: 'closed',
		})
	})

	test('accepts canonical and legacy comments while rejecting unrelated embedded records', async () => {
		const subject = 'at://did:plc:author/sh.tangled.repo.issue/3mho6hukiei22'
		const comment = (rkey: string, value: Record<string, unknown>) => ({
			uri: `at://did:plc:commenter/${String(value.$type)}/${rkey}`,
			value,
		})
		const canonical = comment('3mho6hukiei23', {
			$type: 'sh.tangled.feed.comment',
			body: { $type: 'sh.tangled.markup.markdown', text: '**canonical**' },
			createdAt: '2026-08-01T01:00:00.000Z',
			subject: { uri: subject, cid: 'bafyreicrfpnvmlnd7x5nvfsytxpehmpirnzx7u6kzwxebtdkd5npjxbsmy' },
		})
		const legacy = comment('3mho6hukiei24', {
			$type: 'sh.tangled.repo.issue.comment',
			body: 'legacy',
			createdAt: '2026-08-01T02:00:00.000Z',
			issue: subject,
		})
		const fetch = fetchMock()
			.mockResolvedValueOnce(jsonResponse({ items: [canonical, legacy], cursor: 'more' }))
			.mockResolvedValueOnce(
				jsonResponse({
					items: [comment('3mho6hukiei25', { $type: 'sh.tangled.feed.star', createdAt: '2026-08-01T03:00:00.000Z' })],
				}),
			)
		const client = new BobbinClient({ fetch })

		await expect(client.listComments(subject, { order: 'asc' })).resolves.toMatchObject({
			cursor: 'more',
			items: [{ value: { $type: 'sh.tangled.feed.comment' } }, { value: { $type: 'sh.tangled.repo.issue.comment' } }],
		})
		await expect(client.listComments(subject, { cache: 'reload' })).rejects.toMatchObject({
			kind: 'malformed-response',
		})
	})

	test('uses matching list and count relationship endpoints with cursor metadata', async () => {
		const starUri = 'at://did:plc:fan/sh.tangled.feed.star/3mho6hukiei22'
		const fetch = fetchMock()
			.mockResolvedValueOnce(
				jsonResponse({
					cursor: 'stars-2',
					items: [
						{
							uri: starUri,
							value: {
								$type: 'sh.tangled.feed.star',
								createdAt: '2026-08-01T00:00:00.000Z',
								subject: { $type: 'sh.tangled.feed.star#repo', did: 'did:plc:repository' },
							},
						},
					],
				}),
			)
			.mockResolvedValueOnce(jsonResponse({ count: 9, distinctAuthors: 8 }))
		const client = new BobbinClient({ fetch })

		await expect(client.listStars('did:plc:repository', { cursor: 'stars-1', limit: 25 })).resolves.toEqual({
			cursor: 'stars-2',
			items: [expect.objectContaining({ uri: starUri })],
		})
		await expect(client.countStars('did:plc:repository')).resolves.toEqual({ count: 9, distinctAuthors: 8 })
		expect(fetch.mock.calls.map((call) => new URL(String(call[0])).pathname)).toEqual([
			'/xrpc/sh.tangled.feed.listStars',
			'/xrpc/sh.tangled.feed.countStars',
		])
		expect(new URL(String(fetch.mock.calls[0][0])).searchParams.get('cursor')).toBe('stars-1')
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

	test('builds read-only repository archive links against the repository knot', () => {
		const client = new BobbinClient({ service: 'https://api.example' })

		const archive = new URL(client.repositoryArchiveUrl(repositoryLocation, 'zip'))
		expect(archive.origin).toBe('https://knot.example')
		expect(archive.pathname).toBe('/xrpc/sh.tangled.repo.archive')
		expect(archive.searchParams.get('repo')).toBe('did:plc:4iw5fospv2asv3344au236ka')
		expect(archive.searchParams.get('ref')).toBe('HEAD')
		expect(archive.searchParams.get('format')).toBe('zip')
	})

	test('encodes patch refs and comparison direction at the API boundary', () => {
		const client = new BobbinClient({ service: 'https://api.example' })
		const ref = 'refs/heads/feature a&b'
		const diff = new URL(client.repositoryDiffUrl(repositoryLocation, ref))
		const compare = new URL(client.repositoryCompareUrl(repositoryLocation, 'main', ref))

		expect(diff.origin).toBe('https://knot.example')
		expect(diff.searchParams.get('repo')).toBe(repositoryLocation.did)
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

		await expect(client.getRepositoryDiff(repositoryLocation, 'HEAD')).resolves.toEqual({
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
			client.getRepositoryArchive(repositoryLocation, {
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

	test('resolves artifact records and preserves streamed blob metadata without buffering', async () => {
		const artifactUri = 'at://did:plc:person/sh.tangled.repo.artifact/3mho6hukiei22'
		const cid = 'bafyreicrfpnvmlnd7x5nvfsytxpehmpirnzx7u6kzwxebtdkd5npjxbsmy'
		const stream = new ReadableStream<Uint8Array>()
		const fetch = fetchMock()
			.mockResolvedValueOnce(
				jsonResponse({
					did: 'did:plc:person',
					handle: 'person.example',
					pds: 'https://pds.example',
					signing_key: 'did:key:zPerson',
				}),
			)
			.mockResolvedValueOnce(
				jsonResponse({
					uri: artifactUri,
					value: {
						$type: 'sh.tangled.repo.artifact',
						artifact: { $type: 'blob', mimeType: 'application/zip', ref: { $link: cid }, size: 100 },
						createdAt: '2026-08-01T00:00:00.000Z',
						name: 'build.zip',
						tag: { $bytes: 'AAAAAAAAAAAAAAAAAAAAAAAAAAA=' },
					},
				}),
			)
			.mockResolvedValueOnce(
				new Response(stream, {
					status: 206,
					headers: {
						'content-disposition': 'attachment; filename="build.zip"',
						'content-length': '10',
						'content-range': 'bytes 0-9/100',
						'content-type': 'application/zip',
					},
				}),
			)
		const client = new BobbinClient({ fetch })

		await expect(client.getArtifactDownload(artifactUri, { range: 'bytes=0-9' })).resolves.toMatchObject({
			body: stream,
			status: 206,
			contentLength: 10,
			contentRange: 'bytes 0-9/100',
			contentType: 'application/zip',
			filename: 'build.zip',
		})
		const recordUrl = new URL(String(fetch.mock.calls[1][0]))
		expect(recordUrl.origin).toBe('https://pds.example')
		expect(recordUrl.pathname).toBe('/xrpc/com.atproto.repo.getRecord')
		const [blobInput, blobInit] = fetch.mock.calls[2]
		const blobUrl = new URL(String(blobInput))
		expect(blobUrl.pathname).toBe('/xrpc/com.atproto.sync.getBlob')
		expect(blobUrl.searchParams.get('cid')).toBe(cid)
		expect(blobInit?.headers).toMatchObject({ range: 'bytes=0-9' })
	})

	test('uses the repository DID for direct knot blob queries', async () => {
		const fetch = fetchMock().mockResolvedValue(
			jsonResponse({ path: 'README.md', ref: 'HEAD', content: '# Tempest', encoding: 'utf-8', size: 9 }),
		)
		const client = new BobbinClient({ fetch })

		await expect(client.getRepositoryBlob(repositoryLocation, 'HEAD', 'README.md')).resolves.toMatchObject({
			path: 'README.md',
			content: '# Tempest',
		})
		const url = new URL(String(fetch.mock.calls[0][0]))
		expect(url.origin).toBe('https://knot.example')
		expect(url.searchParams.get('repo')).toBe(repositoryLocation.did)
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

		await expect(client.listRepositoryBranches(repositoryLocation, { limit: 1 })).resolves.toEqual({
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
				page: 0,
				per_page: 1,
			}),
		)
		const client = new BobbinClient({ fetch })

		await expect(client.getRepositoryLog(repositoryLocation, { ref: 'main', limit: 1 })).resolves.toEqual({
			items: [
				expect.objectContaining({
					hash,
					parents: [parent],
					message: 'Ship it',
					author: expect.objectContaining({ name: 'Grace' }),
				}),
			],
			cursor: '1',
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

	test('reports coverage for the hosted catalog while a configured Bobbin is warming', async () => {
		const fetch = fetchMock().mockImplementation(async (input) => {
			const url = new URL(String(input))
			return jsonResponse(
				url.origin === 'http://localhost:8090'
					? { ready: false, eventsProcessed: 0, lastCursor: 0 }
					: { ready: true, eventsProcessed: 100, lastCursor: 120 },
			)
		})
		const client = new BobbinClient({ fetch, service: 'http://localhost:8090' })

		await expect(client.getCatalogCoverage()).resolves.toEqual({ ready: true, eventsProcessed: 100, lastCursor: 120 })
		expect(fetch.mock.calls.map(([input]) => new URL(String(input)).origin)).toEqual([
			'http://localhost:8090',
			'https://api.tangled.org',
		])
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

	test('allows HTTP only for loopback development services', () => {
		expect(normalizeBobbinService('http://localhost:8090/')).toBe('http://localhost:8090')
		expect(normalizeBobbinService('http://127.0.0.1:8090')).toBe('http://127.0.0.1:8090')
		expect(normalizeBobbinService('http://[::1]:8090')).toBe('http://[::1]:8090')
	})

	test('rejects non-loopback HTTP services', () => {
		expect(() => normalizeBobbinService('http://bobbin.example')).toThrow('must use HTTPS')
	})
})
