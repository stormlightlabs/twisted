import { links } from '@/lib/router/links'
import type { RouteLocationRaw } from 'vue-router'

export interface RecordLinkContext {
	repo?: string
}

const TANGLED_HOSTS = new Set(['tangled.org', 'www.tangled.org'])

interface AtUriParts {
	authority: string
	collection: string
	rkey: string
}

export function parseAtUri(value: string): AtUriParts | undefined {
	const match = /^at:\/\/([^/\s]+)\/([a-z][a-z0-9.-]+)\/([a-zA-Z0-9._~:%-]+)$/.exec(value)
	if (!match) return undefined

	return { authority: match[1], collection: match[2], rkey: match[3] }
}

/** Maps identifiers we understand to local views without constructing route strings. */
export function localRecordLink(value: string, context: RecordLinkContext = {}): RouteLocationRaw | undefined {
	const atUri = parseAtUri(value)
	if (atUri) {
		if (atUri.collection === 'sh.tangled.repo') return links.repository(value)
		if (atUri.collection === 'sh.tangled.string' || atUri.collection === 'sh.tangled.feed.string')
			return links.string(value)
		return links.search(value)
	}

	if (/^did:[a-z0-9]+:[^\s/]+$/i.test(value)) return links.profile(value)
	if (/^@[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}$/i.test(value)) return links.profile(value.slice(1))
	if (context.repo && /^#[a-zA-Z0-9._~:-]{1,512}$/.test(value)) return links.issue(context.repo, value.slice(1))

	try {
		const url = new URL(value)
		if (url.protocol === 'https:' && TANGLED_HOSTS.has(url.hostname.toLowerCase())) return links.search(url.href)
	} catch {
		// Plain text is not a URL and needs no route.
	}

	return undefined
}

export function safeCanonicalTangledUrl(value: string | undefined): string | undefined {
	if (!value) return undefined

	try {
		const url = new URL(value)
		return url.protocol === 'https:' && TANGLED_HOSTS.has(url.hostname.toLowerCase()) ? url.href : undefined
	} catch {
		/* Invalid external links do not receive a local destination. */
		return undefined
	}
}
