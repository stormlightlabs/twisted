import { describe, expect, test } from 'vitest'
import { errorFromResponse } from '@/api'

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
})
