import { createRateLimitedFetch } from '@/lib/api'
import { afterEach, describe, expect, test, vi } from 'vitest'

afterEach(() => vi.useRealTimers())

describe('rate-limited fetch', () => {
	test('spaces request starts without serializing their responses', async () => {
		vi.useFakeTimers()
		const starts: number[] = []
		const fetch = vi.fn(async () => {
			starts.push(Date.now())
			return new Response('{}')
		})
		const scheduledFetch = createRateLimitedFetch(fetch, { intervalMs: 250, maxRetries: 0 })

		const requests = [scheduledFetch('https://example.com/one'), scheduledFetch('https://example.com/two')]
		await vi.advanceTimersByTimeAsync(250)
		await Promise.all(requests)

		expect(starts).toHaveLength(2)
		expect(starts[1] - starts[0]).toBe(250)
	})

	test('honors Retry-After for one bounded retry', async () => {
		vi.useFakeTimers()
		const fetch = vi
			.fn()
			.mockResolvedValueOnce(new Response('{}', { status: 429, headers: { 'retry-after': '2' } }))
			.mockResolvedValueOnce(new Response('{}'))
		const scheduledFetch = createRateLimitedFetch(fetch, { intervalMs: 0 })
		const response = scheduledFetch('https://example.com/rate-limited')

		await vi.advanceTimersByTimeAsync(1_999)
		expect(fetch).toHaveBeenCalledOnce()
		await vi.advanceTimersByTimeAsync(1)

		await expect(response).resolves.toMatchObject({ status: 200 })
		expect(fetch).toHaveBeenCalledTimes(2)
	})

	test('cancels a request while it waits for its turn', async () => {
		vi.useFakeTimers()
		const fetch = vi.fn().mockResolvedValue(new Response('{}'))
		const scheduledFetch = createRateLimitedFetch(fetch, { intervalMs: 250, maxRetries: 0 })
		const controller = new AbortController()

		const first = scheduledFetch('https://example.com/one')
		const second = scheduledFetch('https://example.com/two', { signal: controller.signal }).catch(
			(error: unknown) => error,
		)
		controller.abort()
		await vi.runAllTimersAsync()

		await expect(first).resolves.toMatchObject({ status: 200 })
		expect(await second).toMatchObject({ name: 'AbortError' })
		expect(fetch).toHaveBeenCalledOnce()
	})
})
