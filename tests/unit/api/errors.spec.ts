import { describe, expect, test, vi } from 'vitest'
import { errorFromException, errorFromResponse } from '@/lib/api'

describe('errorFromResponse', () => {
	test.each([
		[400, 'invalid-request'],
		[404, 'not-found'],
		[429, 'rate-limited'],
		[502, 'upstream-unavailable'],
		[503, 'service-unavailable'],
		[500, 'service-unavailable'],
	] as const)('maps HTTP %i to %s', (status, kind) => {
		const error = errorFromResponse({ status, headers: new Headers(), data: { error: 'TestError' } })

		expect(error).toMatchObject({ kind, status })
	})

	test('parses an HTTP-date Retry-After value', () => {
		vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-08-01T12:00:00Z'))
		const error = errorFromResponse({
			status: 429,
			headers: new Headers({ 'retry-after': 'Sat, 01 Aug 2026 12:00:05 GMT' }),
			data: { error: 'RateLimitExceeded' },
		})

		expect(error.retryAfterMs).toBe(5_000)
	})
})

test('distinguishes an offline device from another network failure', () => {
	vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)

	expect(errorFromException(new TypeError('Failed to fetch'))).toMatchObject({ kind: 'offline' })
})
