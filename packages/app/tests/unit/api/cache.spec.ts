import type { PersistentCacheEntry, PersistentCacheStore } from '@/lib/api'
import { CursorGuard, RequestCache, createRequestKey } from '@/lib/api'
import { describe, expect, test, vi } from 'vitest'

function deferred<T>() {
	let resolve!: (value: T) => void
	let reject!: (reason?: unknown) => void
	const promise = new Promise<T>((resolvePromise, rejectPromise) => {
		resolve = resolvePromise
		reject = rejectPromise
	})
	return { promise, reject, resolve }
}

describe('RequestCache', () => {
	test('reuses fresh persistent data across cache instances', async () => {
		let now = 1_000
		const records = new Map<string, PersistentCacheEntry>()
		const store: PersistentCacheStore = {
			get: async <T>(key: string) => records.get(key) as PersistentCacheEntry<T> | undefined,
			set: async <T>(entry: PersistentCacheEntry<T>) => {
				records.set(entry.key, entry)
			},
			delete: async (key: string) => {
				records.delete(key)
			},
			clear: async () => {
				records.clear()
			},
		}
		const firstLoad = vi.fn().mockResolvedValue({ name: 'Twisted' })
		const first = new RequestCache(() => now, store)

		await expect(first.get('repo', firstLoad, { staleTimeMs: 100 })).resolves.toEqual({ name: 'Twisted' })
		expect(records.get('repo')).toEqual({ data: { name: 'Twisted' }, key: 'repo', updatedAt: 1_000 })

		now = 1_050
		const secondLoad = vi.fn().mockResolvedValue({ name: 'New' })
		const second = new RequestCache(() => now, store)
		await expect(second.get('repo', secondLoad, { staleTimeMs: 100 })).resolves.toEqual({ name: 'Twisted' })
		expect(secondLoad).not.toHaveBeenCalled()

		now = 1_101
		await expect(second.get('repo', secondLoad, { staleTimeMs: 100 })).resolves.toEqual({ name: 'New' })
		expect(records.get('repo')?.updatedAt).toBe(1_101)
	})

	test('keeps requests working when persistent storage fails', async () => {
		const failure = new Error('Storage unavailable')
		const store: PersistentCacheStore = {
			get: vi.fn().mockRejectedValue(failure),
			set: vi.fn().mockRejectedValue(failure),
			delete: vi.fn().mockRejectedValue(failure),
			clear: vi.fn().mockRejectedValue(failure),
		}
		const cache = new RequestCache(Date.now, store)

		await expect(cache.get('repo', async () => 'network data', { staleTimeMs: 100 })).resolves.toBe('network data')
		expect(cache.peek('repo')).toBe('network data')
	})

	test('shares one in-flight request between identical callers', async () => {
		const pending = deferred<string>()
		const load = vi.fn(() => pending.promise)
		const cache = new RequestCache()

		const first = cache.get('same', load, { staleTimeMs: 1_000 })
		const second = cache.get('same', load, { staleTimeMs: 1_000 })
		pending.resolve('result')

		await expect(Promise.all([first, second])).resolves.toEqual(['result', 'result'])
		expect(load).toHaveBeenCalledOnce()
	})

	test('uses fresh data and reloads it after the explicit stale time', async () => {
		let now = 1_000
		const load = vi.fn().mockResolvedValueOnce('first').mockResolvedValueOnce('second')
		const cache = new RequestCache(() => now)

		await expect(cache.get('timed', load, { staleTimeMs: 100 })).resolves.toBe('first')
		now = 1_100
		await expect(cache.get('timed', load, { staleTimeMs: 100 })).resolves.toBe('first')
		now = 1_101
		await expect(cache.get('timed', load, { staleTimeMs: 100 })).resolves.toBe('second')
		expect(load).toHaveBeenCalledTimes(2)
	})

	test('keeps shared work alive while another subscriber still needs it', async () => {
		const pending = deferred<string>()
		let requestSignal!: AbortSignal
		const cache = new RequestCache()
		const firstController = new AbortController()
		const secondController = new AbortController()
		const load = (signal: AbortSignal) => {
			requestSignal = signal
			return pending.promise
		}

		const first = cache.get('shared', load, { signal: firstController.signal, staleTimeMs: 0 })
		const second = cache.get('shared', load, { signal: secondController.signal, staleTimeMs: 0 })
		firstController.abort()

		await expect(first).rejects.toMatchObject({ name: 'AbortError' })
		expect(requestSignal.aborted).toBe(false)
		pending.resolve('still useful')
		await expect(second).resolves.toBe('still useful')
	})

	test('aborts underlying work after every subscriber leaves', async () => {
		const cache = new RequestCache()
		const controller = new AbortController()
		let requestSignal!: AbortSignal
		const load = (signal: AbortSignal) => {
			requestSignal = signal
			return new Promise<string>((_resolve, reject) => {
				signal.addEventListener('abort', () => reject(new DOMException('Canceled', 'AbortError')), { once: true })
			})
		}

		const request = cache.get('alone', load, { signal: controller.signal, staleTimeMs: 0 })
		controller.abort()

		await expect(request).rejects.toMatchObject({ name: 'AbortError' })
		expect(requestSignal.aborted).toBe(true)
	})

	test('does not cache a result returned after every subscriber aborted', async () => {
		const abandoned = deferred<string>()
		const controller = new AbortController()
		const load = vi
			.fn()
			.mockImplementationOnce(() => abandoned.promise)
			.mockResolvedValueOnce('current')
		const cache = new RequestCache()

		const request = cache.get('abandoned', load, { signal: controller.signal, staleTimeMs: 1_000 })
		controller.abort()
		await expect(request).rejects.toMatchObject({ name: 'AbortError' })
		abandoned.resolve('obsolete')
		await Promise.resolve()
		await Promise.resolve()

		await expect(cache.get('abandoned', load, { staleTimeMs: 1_000 })).resolves.toBe('current')
		expect(load).toHaveBeenCalledTimes(2)
	})

	test('normalizes parameter key order', () => {
		expect(createRequestKey('query', { b: 2, a: 1, missing: undefined })).toBe(
			createRequestKey('query', { a: 1, b: 2 }),
		)
	})
})

describe('CursorGuard', () => {
	test('blocks active, completed, and cyclic cursors while allowing failed pages to retry', () => {
		const guard = new CursorGuard()

		expect(guard.start()).toBe(true)
		expect(guard.start()).toBe(false)
		expect(guard.complete(undefined, 'next')).toBe('next')
		expect(guard.start()).toBe(false)
		expect(guard.start('next')).toBe(true)
		expect(guard.complete('next', 'next')).toBeUndefined()

		expect(guard.start('retry')).toBe(true)
		guard.fail('retry')
		expect(guard.start('retry')).toBe(true)
	})
})
