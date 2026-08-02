import { CapacitorSQLite, SQLiteConnection } from '@capacitor-community/sqlite'
import type { SQLiteDBConnection } from '@capacitor-community/sqlite'
import type { PersistentCacheEntry, PersistentCacheStore } from '@/lib/api/cache'
import { isPersistentCacheEntryTooLarge, serializeCacheValue } from './cache-value'

const DATABASE_NAME = 'twisted_public_cache'
const MAX_CACHE_ENTRIES = 500

/** Creates the native cache backed by the Capacitor SQLite plugin. */
export async function createSqliteCacheStore(): Promise<PersistentCacheStore> {
	const sqlite = new SQLiteConnection(CapacitorSQLite)
	const consistency = await sqlite.checkConnectionsConsistency()
	if (!consistency.result) await sqlite.closeAllConnections()
	const existing = await sqlite.isConnection(DATABASE_NAME, false)
	const database = existing.result
		? await sqlite.retrieveConnection(DATABASE_NAME, false)
		: await sqlite.createConnection(DATABASE_NAME, false, 'no-encryption', 1, false)
	if (!(await database.isDBOpen()).result) await database.open()
	await database.execute(`
		CREATE TABLE IF NOT EXISTS response_cache (
			cache_key TEXT PRIMARY KEY NOT NULL,
			data TEXT NOT NULL,
			updated_at INTEGER NOT NULL
		);
		CREATE INDEX IF NOT EXISTS response_cache_updated_at ON response_cache (updated_at);
	`)

	return sqliteCacheStore(database)
}

function sqliteCacheStore(database: SQLiteDBConnection): PersistentCacheStore {
	return {
		async get<T>(key: string) {
			const result = await database.query(
				'SELECT data, updated_at AS updatedAt FROM response_cache WHERE cache_key = ? LIMIT 1',
				[key],
			)
			const row = result.values?.[0] as { data?: unknown; updatedAt?: unknown } | undefined
			const updatedAt = Number(row?.updatedAt)
			if (typeof row?.data !== 'string' || !Number.isFinite(updatedAt)) return undefined
			try {
				return { data: JSON.parse(row.data) as T, key, updatedAt }
			} catch {
				await database.run('DELETE FROM response_cache WHERE cache_key = ?', [key])
				return undefined
			}
		},
		async set<T>(entry: PersistentCacheEntry<T>) {
			const data = serializeCacheValue(entry.data)
			if (data === undefined || isPersistentCacheEntryTooLarge(data)) {
				await database.run('DELETE FROM response_cache WHERE cache_key = ?', [entry.key])
				return
			}
			await database.run('INSERT OR REPLACE INTO response_cache (cache_key, data, updated_at) VALUES (?, ?, ?)', [
				entry.key,
				data,
				entry.updatedAt,
			])
			await database.run(
				`DELETE FROM response_cache WHERE cache_key IN (
					SELECT cache_key FROM response_cache ORDER BY updated_at DESC LIMIT -1 OFFSET ${MAX_CACHE_ENTRIES}
				)`,
			)
		},
		async delete(key: string) {
			await database.run('DELETE FROM response_cache WHERE cache_key = ?', [key])
		},
		async clear() {
			await database.execute('DELETE FROM response_cache;')
		},
	}
}
