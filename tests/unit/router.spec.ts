import router from '@/lib/router'
import { links } from '@/lib/router/links'
import { describe, expect, test } from 'vitest'

describe('application routes', () => {
	test('keeps the public landing page separate from the in-app home dashboard', () => {
		expect(router.resolve(links.landing).path).toBe('/')
		expect(router.resolve(links.home).path).toBe('/home')
	})

	test('encodes AT-URIs, refs, and paths without changing their values', () => {
		const repo = 'at://did:plc:abc/sh.tangled.repo/3mho6hukiei22'
		const resolved = router.resolve(links.source(repo, 'refs/heads/feature theme', 'src/a file.ts'))

		expect(resolved.href).toContain('at:%2F%2Fdid:plc:abc%2Fsh.tangled.repo%2F3mho6hukiei22')
		expect(resolved.href).not.toContain('/sh.tangled.repo/')
		expect(resolved.query).toEqual({ ref: 'refs/heads/feature theme', path: 'src/a file.ts' })
		expect(resolved.params.repo).toBe(repo)
	})

	test('round-trips opaque route values through shareable URLs', () => {
		const repo = 'at://did:plc:abc/sh.tangled.repo/3mhø-%25-key'
		const cases = [
			{
				location: links.actorActivity('did:web:example.com', 'pull requests'),
				params: { actor: 'did:web:example.com', activity: 'pull requests' },
				query: {},
			},
			{
				location: links.diff(repo, 'refs/heads/feature/λ theme'),
				params: { repo, ref: 'refs/heads/feature/λ theme' },
				query: {},
			},
			{
				location: links.compare(repo, 'refs/tags/v1.0.0', 'feature/a b#c'),
				params: { repo },
				query: { base: 'refs/tags/v1.0.0', head: 'feature/a b#c' },
			},
			{
				location: links.issues(repo, { state: 'open', author: 'did:plc:a/b', label: 'good first issue' }),
				params: { repo },
				query: { state: 'open', author: 'did:plc:a/b', label: 'good first issue' },
			},
			{
				location: links.artifact(repo, 'build/linux arm64+debug.tgz'),
				params: { repo, artifact: 'build/linux arm64+debug.tgz' },
				query: {},
			},
		] as const

		for (const routeCase of cases) {
			const href = router.resolve(routeCase.location).href
			const shared = router.resolve(href)

			expect(shared.params).toEqual(routeCase.params)
			expect(shared.query).toEqual(routeCase.query)
		}
	})

	test('sends unknown deep links to the recovery route', () => {
		expect(router.resolve('/not/a/twisted/domain').name).toBe('not-found')
	})
})
