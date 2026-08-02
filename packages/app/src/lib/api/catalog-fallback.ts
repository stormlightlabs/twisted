import { DEFAULT_BOBBIN_SERVICE } from './contracts'

const COVERAGE_TTL_MS = 15_000

export type CatalogFallbackOptions = { fallbackService?: string; primaryService: string }

/**
 * Routes index-dependent queries to a ready public Bobbin while a configured
 * Bobbin is still warming, without moving point lookups away from that service.
 */
export function createCatalogFallbackFetch(
	fetchImplementation: typeof globalThis.fetch,
	options: CatalogFallbackOptions,
): typeof globalThis.fetch {
	const primary = new URL(options.primaryService)
	const fallback = new URL(options.fallbackService ?? DEFAULT_BOBBIN_SERVICE)
	if (primary.origin === fallback.origin) return fetchImplementation

	let coverageCheckedAt = Number.NEGATIVE_INFINITY
	let primaryReady = false
	let coverageRequest: Promise<boolean> | undefined

	async function isPrimaryReady(): Promise<boolean> {
		if (Date.now() - coverageCheckedAt <= COVERAGE_TTL_MS) return primaryReady
		if (coverageRequest) return coverageRequest

		coverageRequest = fetchImplementation(new URL('/xrpc/sh.tangled.bobbin.getCoverage', primary), {
			headers: { accept: 'application/json' },
		})
			.then(async (response) => {
				if (!response.ok) return false
				const value = (await response.json()) as unknown
				return isRecord(value) && value.ready === true
			})
			.catch(() => false)
			.finally(() => {
				coverageRequest = undefined
				coverageCheckedAt = Date.now()
			})

		primaryReady = await coverageRequest
		return primaryReady
	}

	return (async (input: RequestInfo | URL, init?: RequestInit) => {
		const url = requestUrl(input)
		if (url.origin !== primary.origin || !isCatalogQuery(url) || (await isPrimaryReady())) {
			return fetchImplementation(input, init)
		}

		const fallbackUrl = new URL(url)
		fallbackUrl.protocol = fallback.protocol
		fallbackUrl.hostname = fallback.hostname
		fallbackUrl.port = fallback.port
		try {
			return await fetchImplementation(rewriteRequest(input, fallbackUrl), init)
		} catch {
			return fetchImplementation(input, init)
		}
	}) as typeof globalThis.fetch
}

function isCatalogQuery(url: URL): boolean {
	const prefix = '/xrpc/'
	if (!url.pathname.startsWith(prefix)) return false
	const nsid = url.pathname.slice(prefix.length)
	const method = nsid.split('.').at(-1) ?? ''
	return (
		nsid === 'sh.tangled.search.query' ||
		nsid === 'sh.tangled.repo.getRepoByRepoDid' ||
		method.startsWith('list') ||
		method.startsWith('count')
	)
}

function requestUrl(input: RequestInfo | URL): URL {
	return new URL(input instanceof Request ? input.url : input)
}

function rewriteRequest(input: RequestInfo | URL, url: URL): RequestInfo | URL {
	return input instanceof Request ? new Request(url, input) : url
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}
