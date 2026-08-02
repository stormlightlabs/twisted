export const MAX_PERSISTENT_CACHE_ENTRY_BYTES = 1_000_000

export function isPersistentCacheEntryTooLarge(serialized: string): boolean {
	return new TextEncoder().encode(serialized).byteLength > MAX_PERSISTENT_CACHE_ENTRY_BYTES
}

/** Returns undefined when a value cannot be represented by native JSON storage. */
export function serializeCacheValue(value: unknown): string | undefined {
	if (!isJsonCacheValue(value)) return undefined
	try {
		return JSON.stringify(value)
	} catch {
		/* Non-serializable values are intentionally excluded from persistence. */
		return undefined
	}
}

function isJsonCacheValue(value: unknown): boolean {
	if (value === null || typeof value === 'string' || typeof value === 'boolean') return true
	if (typeof value === 'number') return Number.isFinite(value)
	if (value === undefined) return true
	if (Array.isArray(value)) return value.every(isJsonCacheValue)
	if (typeof value !== 'object') return false
	const prototype = Object.getPrototypeOf(value)
	return (prototype === Object.prototype || prototype === null) && Object.values(value).every(isJsonCacheValue)
}
