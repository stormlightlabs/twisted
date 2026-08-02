import type { PersistentCacheEntry, PersistentCacheStore } from '@/lib/api/cache'
import Dexie from 'dexie'
import type { EntityTable } from 'dexie'
import { isPersistentCacheEntryTooLarge, serializeCacheValue } from './cache-value'

const MAX_CACHE_ENTRIES = 500

type CacheDatabase = Dexie & { responses: EntityTable<PersistentCacheEntry, 'key'> }

/** Creates the browser cache backed by IndexedDB through Dexie. */
export function createDexieCacheStore(): PersistentCacheStore {
	const database = new Dexie('twisted-public-cache') as CacheDatabase
	database.version(1).stores({ responses: 'key, updatedAt' })

	return {
		get: <T>(key: string) => database.responses.get(key) as Promise<PersistentCacheEntry<T> | undefined>,
		async set<T>(entry: PersistentCacheEntry<T>) {
			const data = serializeCacheValue(entry.data)
			if (data === undefined || isPersistentCacheEntryTooLarge(data)) {
				await database.responses.delete(entry.key)
				return
			}
			await database.responses.put({ ...entry, data: JSON.parse(data) as T })
			const excess = (await database.responses.count()) - MAX_CACHE_ENTRIES
			if (excess > 0) {
				const oldest = await database.responses.orderBy('updatedAt').limit(excess).primaryKeys()
				await database.responses.bulkDelete(oldest)
			}
		},
		delete: (key: string) => database.responses.delete(key),
		clear: () => database.responses.clear(),
	}
}
