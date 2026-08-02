import { isPersistentCacheEntryTooLarge, serializeCacheValue } from '@/lib/storage/cache-value'
import { describe, expect, test } from 'vitest'

describe('SQLite cache serialization', () => {
	test('round-trips public JSON data', () => {
		const value = { items: [{ name: 'Twisted', topics: ['vue', 'tangled'] }], cursor: undefined }
		const serialized = serializeCacheValue(value)

		expect(serialized).toBeDefined()
		expect(JSON.parse(serialized!)).toEqual({ items: [{ name: 'Twisted', topics: ['vue', 'tangled'] }] })
	})

	test('rejects values SQLite cannot restore faithfully', () => {
		expect(serializeCacheValue(new Blob(['patch']))).toBeUndefined()
		expect(serializeCacheValue({ count: Number.NaN })).toBeUndefined()
		expect(serializeCacheValue({ id: 1n })).toBeUndefined()
	})

	test('measures the native cache limit in UTF-8 bytes', () => {
		expect(isPersistentCacheEntryTooLarge('a'.repeat(1_000_000))).toBe(false)
		expect(isPersistentCacheEntryTooLarge('é'.repeat(500_001))).toBe(true)
	})
})
