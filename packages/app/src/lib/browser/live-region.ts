import { ref } from 'vue'

/** Message announced by the application-wide polite live region. */
export const liveMessage = ref('')

let messageVersion = 0

/** Announces an asynchronous status change without moving keyboard focus. */
export function announce(message: string): void {
	const version = ++messageVersion
	liveMessage.value = ''
	queueMicrotask(() => {
		if (version === messageVersion) liveMessage.value = message
	})
}
