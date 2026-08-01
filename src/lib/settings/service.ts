import { readonly, ref } from 'vue'
import { normalizeBobbinService } from '@/lib/api'
import { DEFAULT_BOBBIN_SERVICE } from '@/lib/api/contracts'

export const SERVICE_STORAGE_KEY = 'twisted.bobbin-service.v1'

type ServiceStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

export function loadBobbinService(storage: Pick<Storage, 'getItem'> | undefined): string {
	if (storage === undefined) {
		return DEFAULT_BOBBIN_SERVICE
	}

	try {
		const saved = storage.getItem(SERVICE_STORAGE_KEY)
		return saved === null ? DEFAULT_BOBBIN_SERVICE : normalizeBobbinService(saved)
	} catch {
		return DEFAULT_BOBBIN_SERVICE
	}
}

export function saveBobbinService(storage: ServiceStorage, service: string): string {
	const normalized = normalizeBobbinService(service)
	if (normalized === DEFAULT_BOBBIN_SERVICE) {
		storage.removeItem(SERVICE_STORAGE_KEY)
	} else {
		storage.setItem(SERVICE_STORAGE_KEY, normalized)
	}
	return normalized
}

const service = ref(DEFAULT_BOBBIN_SERVICE)

export function initializeBobbinService(): void {
	service.value = loadBobbinService(typeof window === 'undefined' ? undefined : window.localStorage)
}

export function useBobbinService() {
	function updateService(value: string): string {
		const normalized = saveBobbinService(window.localStorage, value)
		service.value = normalized
		return normalized
	}

	function restoreDefault(): void {
		window.localStorage.removeItem(SERVICE_STORAGE_KEY)
		service.value = DEFAULT_BOBBIN_SERVICE
	}

	return { service: readonly(service), updateService, restoreDefault }
}
