import type { BobbinError } from '@/lib/api'
import { errorFromException } from '@/lib/api'
import { announce } from '@/lib/browser'
import { computed, onScopeDispose, readonly, ref, shallowRef, toValue, watch } from 'vue'
import type { Ref, WatchSource } from 'vue'

/** Appends cursor pages while guarding repeated requests and obsolete routes. */
export function useCursorPagination<T, TSource>(
	source: WatchSource<TSource>,
	firstPage: Readonly<Ref<{ readonly items: readonly T[]; readonly cursor?: string } | undefined>>,
	load: (
		source: TSource,
		cursor: string,
		signal: AbortSignal,
	) => Promise<{ readonly items: readonly T[]; readonly cursor?: string }>,
	key: (item: T) => string,
) {
	const appended = shallowRef<T[]>([])
	const cursor = ref<string>()
	const loading = ref(false)
	const error = shallowRef<BobbinError>()
	let controller: AbortController | undefined
	let generation = 0

	watch(
		firstPage,
		(page) => {
			controller?.abort()
			generation += 1
			appended.value = []
			cursor.value = page?.cursor
			loading.value = false
			error.value = undefined
		},
		{ immediate: true },
	)

	const items = computed(() => [...(firstPage.value?.items ?? []), ...appended.value])

	async function loadMore(): Promise<void> {
		const next = cursor.value
		if (!next || loading.value) return
		const requestGeneration = generation
		controller = new AbortController()
		loading.value = true
		error.value = undefined
		try {
			const page = await load(toValue(source), next, controller.signal)
			if (requestGeneration !== generation || controller.signal.aborted) return
			const seen = new Set(items.value.map(key))
			const added = page.items.filter((item) => !seen.has(key(item)))
			appended.value = [...appended.value, ...added]
			cursor.value = page.cursor
			announce(added.length === 1 ? '1 more item loaded.' : `${added.length} more items loaded.`)
		} catch (reason) {
			if (requestGeneration === generation) error.value = errorFromException(reason)
		} finally {
			if (requestGeneration === generation) loading.value = false
		}
	}

	onScopeDispose(() => controller?.abort())

	return { cursor: readonly(cursor), error: readonly(error), items, loading: readonly(loading), loadMore }
}
