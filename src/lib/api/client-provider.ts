import type { InjectionKey } from 'vue'
import { inject } from 'vue'
import { useBobbinService } from '@/lib/settings/service'
import { createBobbinClient } from './client'
import type { BobbinClient } from './client'

export type BobbinClientProvider = () => BobbinClient

export const BOBBIN_CLIENT_PROVIDER: InjectionKey<BobbinClientProvider> = Symbol('BobbinClientProvider')

let activeService = ''
let activeClient: BobbinClient | undefined

function defaultProvider(): BobbinClient {
	const service = useBobbinService().service.value
	if (activeClient === undefined || service !== activeService) {
		activeService = service
		activeClient = createBobbinClient({ service })
	}
	return activeClient
}

/** Returns the injected client provider, or the application provider in production. */
export function useBobbinClientProvider(): BobbinClientProvider {
	return inject(BOBBIN_CLIENT_PROVIDER, defaultProvider)
}
