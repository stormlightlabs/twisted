import { Capacitor } from '@capacitor/core'
import type { PersistentCacheStore } from '@/lib/api/cache'

let storePromise: Promise<PersistentCacheStore | undefined> | undefined

/** Selects one persistent cache for the current runtime and reuses it for the app session. */
export function getPersistentCacheStore(): Promise<PersistentCacheStore | undefined> {
	storePromise ??= createPersistentCacheStore(Capacitor.getPlatform())
	return storePromise
}

export async function createPersistentCacheStore(platform: string): Promise<PersistentCacheStore | undefined> {
	try {
		if (platform === 'ios' || platform === 'android') {
			const { createSqliteCacheStore } = await import('./sqlite-cache')
			return await createSqliteCacheStore()
		}

		if (typeof indexedDB !== 'undefined') {
			const { createDexieCacheStore } = await import('./dexie-cache')
			return createDexieCacheStore()
		}
	} catch {
		// Browsing must remain available when storage is blocked or initialization fails.
	}
	return undefined
}
