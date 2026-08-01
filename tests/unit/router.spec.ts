import router from '@/router'
import { links } from '@/router/links'
import { describe, expect, test } from 'vitest'

describe('application routes', () => {
	test('encodes AT-URIs, refs, and paths without changing their values', () => {
		const repo = 'at://did:plc:abc/sh.tangled.repo/3mho6hukiei22'
		const resolved = router.resolve(links.source(repo, 'refs/heads/feature theme', 'src/a file.ts'))

		expect(resolved.href).toContain('at:%2F%2Fdid:plc:abc%2Fsh.tangled.repo%2F3mho6hukiei22')
		expect(resolved.href).not.toContain('/sh.tangled.repo/')
		expect(resolved.query).toEqual({ ref: 'refs/heads/feature theme', path: 'src/a file.ts' })
		expect(resolved.params.repo).toBe(repo)
	})

	test('encodes handles, rkeys, and string AT-URIs through named routes', () => {
		expect(router.resolve(links.profile('desertthunder.dev')).name).toBe('profile')
		expect(router.resolve(links.issue('at://did:plc:abc/sh.tangled.repo/key', '3k.test')).name).toBe('issue')
		expect(router.resolve(links.string('at://did:plc:abc/sh.tangled.feed.string/key')).name).toBe('string')
	})

	test('provides named builders for every opaque feature route', () => {
		const actor = 'did:plc:abc'
		const repo = 'at://did:plc:abc/sh.tangled.repo/key'
		const locations = [
			[links.actorActivity(actor, 'issues'), 'actor-activity'],
			[links.actorRelationships(actor, 'followers'), 'actor-relationships'],
			[links.repository(repo), 'repository'],
			[links.commits(repo, 'refs/heads/main', 'src/main.ts'), 'repository-commits'],
			[links.commit(repo, 'abc123'), 'repository-commit'],
			[links.branches(repo), 'repository-branches'],
			[links.tags(repo), 'repository-tags'],
			[links.diff(repo, 'refs/heads/main'), 'repository-diff'],
			[links.compare(repo, 'main', 'feature/theme'), 'repository-compare'],
			[links.issues(repo, { state: 'open' }), 'issues'],
			[links.issue(repo, '3k.test'), 'issue'],
			[links.pulls(repo, { status: 'open' }), 'pulls'],
			[links.pull(repo, '3k.pull'), 'pull'],
			[links.pipelines(repo, 'pipeline/key'), 'pipelines'],
			[links.artifact(repo, 'artifact/key'), 'artifact'],
			[links.string('at://did:plc:abc/sh.tangled.feed.string/key'), 'string'],
			[links.knot('knot.example'), 'knot'],
			[links.spindle('spindle/key'), 'spindle'],
			[links.labels('at://did:plc:abc/sh.tangled.label.scope/key'), 'labels'],
		] as const

		for (const [location, name] of locations) {
			expect(router.resolve(location).name).toBe(name)
		}
	})

	test('sends unknown deep links to the recovery route', () => {
		expect(router.resolve('/not/a/twisted/domain').name).toBe('not-found')
	})
})
