import { BobbinError } from '@/lib/api'
import { useRouteRequest } from '@/lib/requests/useRouteRequest'
import { flushPromises } from '@vue/test-utils'
import { effectScope, nextTick, ref } from 'vue'
import { afterEach, describe, expect, test, vi } from 'vitest'

afterEach(() => {
	vi.useRealTimers()
})

describe('useRouteRequest', () => {
	test('aborts obsolete route work and ignores its late result', async () => {
		const source = ref('first')
		const calls: Array<{ signal: AbortSignal; value: string; resolve: (result: string) => void }> = []
		const scope = effectScope()
		const state = scope.run(() =>
			useRouteRequest(
				source,
				(value, signal) => new Promise<string>((resolve) => calls.push({ signal, value, resolve })),
			),
		)!

		expect(calls[0].value).toBe('first')
		source.value = 'second'
		await nextTick()
		expect(calls[0].signal.aborted).toBe(true)
		expect(calls[1].value).toBe('second')

		calls[0].resolve('obsolete')
		calls[1].resolve('current')
		await flushPromises()
		expect(state.data.value).toBe('current')
		expect(state.phase.value).toBe('ready')
		scope.stop()
	})

	test('preserves successful content when a refresh fails', async () => {
		const load = vi
			.fn<[string, AbortSignal, { cache: 'default' | 'reload' }], Promise<string[]>>()
			.mockResolvedValueOnce(['existing'])
			.mockRejectedValueOnce(new BobbinError('network', 'Failed'))
		const scope = effectScope()
		const state = scope.run(() => useRouteRequest(ref('route'), load, { isEmpty: (items) => items.length === 0 }))!
		await flushPromises()

		await state.refresh()
		expect(state.data.value).toEqual(['existing'])
		expect(state.hasContent.value).toBe(true)
		expect(state.phase.value).toBe('error')
		expect(state.error.value?.kind).toBe('network')
		expect(load.mock.calls[0][2]).toEqual({ cache: 'default' })
		expect(load.mock.calls[1][2]).toEqual({ cache: 'reload' })
		scope.stop()
	})

	test('does not retry before Retry-After expires', async () => {
		vi.useFakeTimers()
		vi.setSystemTime(1_000)
		const load = vi
			.fn()
			.mockRejectedValueOnce(new BobbinError('rate-limited', 'Slow down', { retryAfterMs: 2_000 }))
			.mockResolvedValueOnce('ready')
		const scope = effectScope()
		const state = scope.run(() => useRouteRequest(ref('route'), load))!
		await flushPromises()

		expect(state.retryInMs.value).toBe(2_000)
		expect(state.retry()).toBe(false)
		expect(load).toHaveBeenCalledOnce()

		vi.advanceTimersByTime(2_000)
		expect(state.retry()).toBe(true)
		await flushPromises()
		expect(load).toHaveBeenCalledTimes(2)
		expect(state.data.value).toBe('ready')
		scope.stop()
	})
})
