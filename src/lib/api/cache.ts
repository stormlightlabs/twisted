/** Explicit cache lifetimes for Bobbin query families. */
export const STALE_TIMES = {
	coverage: 15_000,
	diagnostics: 60_000,
	identity: 300_000,
	list: 30_000,
	record: 60_000,
	search: 15_000,
} as const

export interface CacheRequestOptions {
	force?: boolean
	signal?: AbortSignal
	staleTimeMs: number
}

interface PendingRequest<T> {
	controller: AbortController
	promise: Promise<T>
	settled: boolean
	subscribers: number
}

interface CacheEntry<T> {
	data?: T
	hasData: boolean
	pending?: PendingRequest<T>
	updatedAt: number
}

/**
 * Small in-memory GET cache with request coalescing and subscriber-aware aborts.
 * An underlying request is canceled only after every interested caller aborts.
 */
export class RequestCache {
	readonly #entries = new Map<string, CacheEntry<unknown>>()
	readonly #now: () => number

	constructor(now: () => number = Date.now) {
		this.#now = now
	}

	get<T>(key: string, load: (signal: AbortSignal) => Promise<T>, options: CacheRequestOptions): Promise<T> {
		if (options.staleTimeMs < 0) {
			throw new RangeError('Cache stale times cannot be negative')
		}
		if (options.signal?.aborted) return Promise.reject(abortError())

		const entry = this.#entry<T>(key)
		if (!options.force && entry.hasData && this.#now() - entry.updatedAt <= options.staleTimeMs) {
			return Promise.resolve(entry.data as T)
		}
		if (entry.pending?.controller.signal.aborted) entry.pending = undefined

		if (entry.pending === undefined) {
			const controller = new AbortController()
			const loadPromise = new Promise<T>((resolve, reject) => {
				try {
					void load(controller.signal).then(resolve, reject)
				} catch (error) {
					reject(error)
				}
			})
			const pending: PendingRequest<T> = { controller, promise: loadPromise, settled: false, subscribers: 0 }
			pending.promise = loadPromise
				.then((data) => {
					if (controller.signal.aborted) throw abortError()
					entry.data = data
					entry.hasData = true
					entry.updatedAt = this.#now()
					return data
				})
				.finally(() => {
					pending.settled = true
					if (entry.pending === pending) entry.pending = undefined
				})
			entry.pending = pending
		}

		return subscribe(entry.pending, options.signal)
	}

	peek<T>(key: string): T | undefined {
		const entry = this.#entries.get(key)
		return entry?.hasData ? (entry.data as T) : undefined
	}

	invalidate(key: string): void {
		const entry = this.#entries.get(key)
		if (entry !== undefined) entry.updatedAt = Number.NEGATIVE_INFINITY
	}

	clear(): void {
		for (const entry of this.#entries.values()) entry.pending?.controller.abort()
		this.#entries.clear()
	}

	#entry<T>(key: string): CacheEntry<T> {
		const existing = this.#entries.get(key)
		if (existing !== undefined) return existing as CacheEntry<T>

		const entry: CacheEntry<T> = { hasData: false, updatedAt: Number.NEGATIVE_INFINITY }
		this.#entries.set(key, entry)
		return entry
	}
}

/** Tracks completed and active cursors so pagination cannot append a page twice. */
export class CursorGuard {
	readonly #active = new Set<string>()
	readonly #completed = new Set<string>()

	start(cursor?: string): boolean {
		const key = cursorKey(cursor)
		if (this.#active.has(key) || this.#completed.has(key)) return false
		this.#active.add(key)
		return true
	}

	complete(cursor: string | undefined, nextCursor?: string): string | undefined {
		const key = cursorKey(cursor)
		this.#active.delete(key)
		this.#completed.add(key)

		return nextCursor === undefined || this.#completed.has(cursorKey(nextCursor)) ? undefined : nextCursor
	}

	fail(cursor?: string): void {
		this.#active.delete(cursorKey(cursor))
	}

	reset(): void {
		this.#active.clear()
		this.#completed.clear()
	}
}

/** Produces the same cache key for objects whose keys have a different insertion order. */
export function createRequestKey(nsid: string, parameters: unknown): string {
	return `${nsid}:${stableSerialize(parameters)}`
}

function subscribe<T>(pending: PendingRequest<T>, signal?: AbortSignal): Promise<T> {
	if (signal?.aborted) return Promise.reject(abortError())
	pending.subscribers += 1

	return new Promise<T>((resolve, reject) => {
		let settled = false
		const finish = (result: { data: T } | { error: unknown }) => {
			if (settled) return
			settled = true
			signal?.removeEventListener('abort', onAbort)
			pending.subscribers -= 1
			if (pending.subscribers === 0 && !pending.settled && !pending.controller.signal.aborted)
				pending.controller.abort()
			if ('data' in result) resolve(result.data)
			else reject(result.error)
		}
		const onAbort = () => finish({ error: abortError() })

		signal?.addEventListener('abort', onAbort, { once: true })
		void pending.promise.then(
			(data) => finish({ data }),
			(error: unknown) => finish({ error }),
		)
	})
}

function stableSerialize(value: unknown): string {
	if (Array.isArray(value)) return `[${value.map(stableSerialize).join(',')}]`
	if (typeof value === 'object' && value !== null) {
		return `{${Object.entries(value)
			.filter(([, item]) => item !== undefined)
			.sort(([left], [right]) => left.localeCompare(right))
			.map(([key, item]) => `${JSON.stringify(key)}:${stableSerialize(item)}`)
			.join(',')}}`
	}
	return JSON.stringify(value)
}

function cursorKey(cursor?: string): string {
	return cursor ?? '__first_page__'
}

function abortError(): DOMException {
	return new DOMException('Canceled', 'AbortError')
}
