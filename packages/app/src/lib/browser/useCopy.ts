import { useClipboard } from '@vueuse/core'

/** Provides one consistent, browser-compatible text-copy operation. */
export function useCopy() {
	const { copied, copy, isSupported } = useClipboard({ legacy: true })

	return {
		async copyText(value: string): Promise<boolean> {
			if (!isSupported.value) return false

			try {
				await copy(value)
				return copied.value
			} catch {
				/* Callers render their own copy failure state. */
				return false
			}
		},
	}
}
