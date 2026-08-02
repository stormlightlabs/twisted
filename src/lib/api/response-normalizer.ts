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
			return response
		}
		if (!isRecord(data) || data.cursor !== null) return response

		const normalized = { ...data }
		delete normalized.cursor
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

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}
