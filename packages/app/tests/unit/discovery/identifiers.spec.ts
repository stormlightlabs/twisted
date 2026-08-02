import { classifyIdentifier } from '@/features/discovery/identifiers'
import { describe, expect, test } from 'vitest'

describe('classifyIdentifier', () => {
	test.each([
		['desertthunder.dev', { kind: 'actor', actor: 'desertthunder.dev' }],
		['@desertthunder.dev', { kind: 'actor', actor: 'desertthunder.dev' }],
		['did:plc:account', { kind: 'did', did: 'did:plc:account' }],
		['at://did:plc:account/sh.tangled.actor.profile/self', { kind: 'actor', actor: 'did:plc:account' }],
		[
			'at://did:plc:account/sh.tangled.repo/project',
			{ kind: 'at-uri', uri: 'at://did:plc:account/sh.tangled.repo/project' },
		],
		['https://tangled.org/@desertthunder.dev', { kind: 'actor', actor: 'desertthunder.dev' }],
		[
			'https://tangled.org/desertthunder.dev/twisted',
			{ kind: 'repo-url', owner: 'desertthunder.dev', repo: 'twisted' },
		],
		['search these words', { kind: 'search' }],
	] as const)('classifies %s', (input, expected) => {
		expect(classifyIdentifier(input)).toEqual(expected)
	})
})
