import { useCursorPagination } from '@/lib/requests'
import { flushPromises } from '@vue/test-utils'
import { effectScope, ref } from 'vue'
import { describe, expect, test, vi } from 'vitest'

describe('useCursorPagination', () => {
	test('appends each cursor once, removes duplicate records, and resets with the first page', async () => {
		const source = ref('scope-a')
		const firstPage = ref({ items: [{ id: 'first' }], cursor: 'page-2' })
		const load = vi.fn().mockResolvedValue({ items: [{ id: 'first' }, { id: 'second' }] })
		const scope = effectScope()
		const pagination = scope.run(() => useCursorPagination(source, firstPage, load, (item) => item.id))!

		void pagination.loadMore()
		void pagination.loadMore()
		await flushPromises()

		expect(load).toHaveBeenCalledOnce()
		expect(load).toHaveBeenCalledWith('scope-a', 'page-2', expect.any(AbortSignal))
		expect(pagination.items.value).toEqual([{ id: 'first' }, { id: 'second' }])
		expect(pagination.cursor.value).toBeUndefined()

		firstPage.value = { items: [{ id: 'replacement' }], cursor: 'page-b' }
		await flushPromises()
		expect(pagination.items.value).toEqual([{ id: 'replacement' }])
		expect(pagination.cursor.value).toBe('page-b')
		scope.stop()
	})
})
