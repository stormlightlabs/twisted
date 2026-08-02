import { parseAtUri } from '@/content/links'

export type IdentifierInput =
	| { kind: 'actor'; actor: string }
	| { kind: 'at-uri'; uri: string }
	| { kind: 'did'; did: string }
	| { kind: 'repo-url'; owner: string; repo: string }
	| { kind: 'search' }

const handlePattern = /^(?=.{1,253}$)[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}$/i

/** Classifies direct identifiers before full-text search is attempted. */
export function classifyIdentifier(input: string): IdentifierInput {
	const value = input.trim()
	const atUri = parseAtUri(value)
	if (atUri) {
		if (atUri.collection === 'sh.tangled.actor.profile') return { kind: 'actor', actor: atUri.authority }
		return { kind: 'at-uri', uri: value }
	}
	if (/^did:[a-z0-9]+:[^\s/]+$/i.test(value)) return { kind: 'did', did: value }
	const handle = value.startsWith('@') ? value.slice(1) : value
	if (handlePattern.test(handle)) return { kind: 'actor', actor: handle }

	try {
		const url = new URL(value)
		if (url.protocol !== 'https:' || !['tangled.org', 'www.tangled.org'].includes(url.hostname.toLowerCase())) {
			return { kind: 'search' }
		}
		const parts = url.pathname.split('/').filter(Boolean).map(decodeURIComponent)
		if (parts.length === 1 && parts[0].startsWith('@') && handlePattern.test(parts[0].slice(1))) {
			return { kind: 'actor', actor: parts[0].slice(1) }
		}
		if (parts.length >= 2 && !parts[0].includes(':')) {
			return { kind: 'repo-url', owner: parts[0].replace(/^@/, ''), repo: parts[1] }
		}
	} catch {
		// Ordinary search text is expected to fail URL parsing.
	}

	return { kind: 'search' }
}
