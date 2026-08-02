import { BobbinError, errorFromException } from '@/lib/api'
import { computed, onScopeDispose, readonly, ref, shallowRef, watch } from 'vue'
import type { WatchSource } from 'vue'

export type RequestPhase = 'empty' | 'error' | 'idle' | 'loading' | 'ready' | 'refreshing'

export interface RouteRequestOptions<T> {
	immediate?: boolean
	isEmpty?: (data: T) => boolean
}

export interface RequestAttempt {
	cache: 'default' | 'reload'
}

/** Runs one request per source value and aborts work made obsolete by navigation. */
export function useRouteRequest<T, TSource>(
	source: WatchSource<TSource>,
	load: (value: TSource, signal: AbortSignal, attempt: RequestAttempt) => Promise<T>,
	options: RouteRequestOptions<T> = {},
) {
	const data = shallowRef<T>()
	const error = shallowRef<BobbinError>()
	const phase = ref<RequestPhase>('idle')
	const retryAt = ref(0)
	const clock = ref(Date.now())
	let activeController: AbortController | undefined
	let currentSource: TSource | undefined
	let hasCurrentSource = false
	let generation = 0
	let retryTimer: ReturnType<typeof setTimeout> | undefined

	const retryInMs = computed(() => Math.max(0, retryAt.value - clock.value))
	const hasContent = computed(() => data.value !== undefined && !(options.isEmpty?.(data.value) ?? false))

	async function execute(
		value: TSource,
		cache: RequestAttempt['cache'] = 'default',
		preserveContent = false,
	): Promise<void> {
		currentSource = value
		hasCurrentSource = true
		if (!preserveContent) data.value = undefined
		if (retryTimer !== undefined) clearTimeout(retryTimer)
		retryAt.value = 0
		generation += 1
		const requestGeneration = generation
		activeController?.abort()
		const controller = new AbortController()
		activeController = controller
		error.value = undefined
		phase.value = data.value === undefined ? 'loading' : 'refreshing'

		try {
			const result = await load(value, controller.signal, { cache })
			if (requestGeneration !== generation || controller.signal.aborted) return
			data.value = result
			phase.value = options.isEmpty?.(result) ? 'empty' : 'ready'
			retryAt.value = 0
		} catch (reason) {
			if (requestGeneration !== generation) return
			const requestError = errorFromException(reason)
			if (requestError.kind === 'aborted') {
				phase.value = data.value === undefined ? 'idle' : 'ready'
				return
			}

			error.value = requestError
			phase.value = 'error'
			retryAt.value = Date.now() + (requestError.retryAfterMs ?? 0)
			clock.value = Date.now()
			scheduleRetryUnlock(requestError.retryAfterMs)
		}
	}

	function refresh(): Promise<void> {
		return hasCurrentSource ? execute(currentSource as TSource, 'reload', true) : Promise.resolve()
	}

	function retry(): boolean {
		clock.value = Date.now()
		if (retryInMs.value > 0) return false
		void refresh()
		return true
	}

	function abort(): void {
		generation += 1
		activeController?.abort()
		phase.value = data.value === undefined ? 'idle' : 'ready'
	}

	function scheduleRetryUnlock(delay: number | undefined): void {
		if (retryTimer !== undefined) clearTimeout(retryTimer)
		if (delay === undefined || delay <= 0) return
		retryTimer = setTimeout(() => (clock.value = Date.now()), delay)
	}

	const stop = watch(source, (value) => void execute(value), { immediate: options.immediate ?? true })
	onScopeDispose(() => {
		stop()
		abort()
		if (retryTimer !== undefined) clearTimeout(retryTimer)
	})

	return {
		data: readonly(data),
		error: readonly(error),
		hasContent,
		phase: readonly(phase),
		retryInMs,
		abort,
		refresh,
		retry,
	}
}
