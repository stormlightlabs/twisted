import { parseRetryAfterMs } from './errors'

const DEFAULT_INTERVAL_MS = 250
const DEFAULT_RETRY_DELAY_MS = 1_000
const MAX_AUTOMATIC_RETRY_DELAY_MS = 5_000
const RETRYABLE_STATUSES = new Set([429, 502, 503])

export type RateLimitedFetchOptions = { intervalMs?: number; maxRetries?: number; retryDelayMs?: number }

/** Spaces public requests and retries short-lived service failures once by default. */
export function createRateLimitedFetch(
	fetchImplementation: typeof globalThis.fetch,
	options: RateLimitedFetchOptions = {},
): typeof globalThis.fetch {
	const gate = new RequestStartGate(options.intervalMs ?? DEFAULT_INTERVAL_MS)
	const maxRetries = options.maxRetries ?? 1
	const retryDelayMs = options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS

	return (async (input: RequestInfo | URL, init?: RequestInit) => {
		const signal = init?.signal ?? (input instanceof Request ? input.signal : undefined)
		for (let attempt = 0; ; attempt += 1) {
			await gate.wait(signal)
			const response = await fetchImplementation(input, init)
			if (!RETRYABLE_STATUSES.has(response.status) || attempt >= maxRetries) return response

			const retryAfterMs = parseRetryAfterMs(response.headers.get('retry-after')) ?? retryDelayMs * 2 ** attempt
			if (retryAfterMs > MAX_AUTOMATIC_RETRY_DELAY_MS) return response
			try {
				await response.body?.cancel()
			} catch {
				// Some fetch implementations expose an already-consumed response body.
			}
			await abortableDelay(retryAfterMs, signal)
		}
	}) as typeof globalThis.fetch
}

class RequestStartGate {
	readonly #intervalMs: number
	#nextStart = 0
	#tail = Promise.resolve()

	constructor(intervalMs: number) {
		if (intervalMs < 0) throw new RangeError('Request intervals cannot be negative')
		this.#intervalMs = intervalMs
	}

	async wait(signal?: AbortSignal | null): Promise<void> {
		let release!: () => void
		const previous = this.#tail
		this.#tail = new Promise<void>((resolve) => (release = resolve))
		await previous
		try {
			if (signal?.aborted) throw abortError()
			await abortableDelay(Math.max(0, this.#nextStart - Date.now()), signal)
			this.#nextStart = Date.now() + this.#intervalMs
		} finally {
			release()
		}
	}
}

function abortableDelay(delayMs: number, signal?: AbortSignal | null): Promise<void> {
	if (signal?.aborted) return Promise.reject(abortError())
	if (delayMs <= 0) return Promise.resolve()

	return new Promise((resolve, reject) => {
		const timer = setTimeout(finish, delayMs)
		function finish() {
			signal?.removeEventListener('abort', cancel)
			resolve()
		}
		function cancel() {
			clearTimeout(timer)
			signal?.removeEventListener('abort', cancel)
			reject(abortError())
		}
		signal?.addEventListener('abort', cancel, { once: true })
	})
}

function abortError(): DOMException {
	return new DOMException('Canceled', 'AbortError')
}
