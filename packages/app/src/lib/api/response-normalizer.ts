/** Removes Bobbin's known nullable-cursor exception before generated schema validation. */
export function createNormalizedResponseFetch(fetchImplementation: typeof globalThis.fetch): typeof globalThis.fetch {
	return (async (input: RequestInfo | URL, init?: RequestInit) => {
		const response = await fetchImplementation(input, init)
		if (!response.ok || !response.headers.get('content-type')?.toLowerCase().includes('application/json')) {
			return response
		}

		let data: unknown
		try {
			data = await response.clone().json()
		} catch {
			/* Non-JSON responses pass through unchanged. */
			return response
		}
		if (!isRecord(data)) return response

		const normalized = normalizeJsonResponse(input, data)
		if (normalized === data) return response
		const headers = new Headers(response.headers)
		headers.delete('content-encoding')
		headers.delete('content-length')
		return new Response(JSON.stringify(normalized), {
			headers,
			status: response.status,
			statusText: response.statusText,
		})
	}) as typeof globalThis.fetch
}

function normalizeJsonResponse(input: RequestInfo | URL, data: Record<string, unknown>): Record<string, unknown> {
	let normalized = data
	if (data.cursor === null) {
		normalized = { ...normalized }
		delete normalized.cursor
	}

	const url = new URL(input instanceof Request ? input.url : input)
	if (url.pathname.endsWith('/xrpc/sh.tangled.repo.tree') || url.pathname.endsWith('/xrpc/sh.tangled.repo.blob')) {
		normalized = normalizeRepositoryCommitMetadata(normalized)
	}
	return normalized
}

function normalizeRepositoryCommitMetadata(data: Record<string, unknown>): Record<string, unknown> {
	let changed = false
	const normalized = { ...data }
	const rootCommit = normalizeCommitMetadata(data.lastCommit)
	if (rootCommit !== data.lastCommit) {
		normalized.lastCommit = rootCommit
		changed = true
	}

	if (Array.isArray(data.files)) {
		const files = data.files.map((value) => {
			if (!isRecord(value)) return value
			const commit = normalizeCommitMetadata(value.last_commit)
			if (commit === value.last_commit) return value
			changed = true
			return { ...value, last_commit: commit }
		})
		if (changed) normalized.files = files
	}
	return changed ? normalized : data
}

function normalizeCommitMetadata(value: unknown): unknown {
	if (!isRecord(value) || !isRecord(value.author) || value.author.when !== '') return value
	if (typeof value.when !== 'string' || value.when.length === 0) return value
	return { ...value, author: { ...value.author, when: value.when } }
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}
