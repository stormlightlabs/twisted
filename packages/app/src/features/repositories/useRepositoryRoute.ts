import type { RepositoryLocation } from '@/lib/api'
import { useBobbinClientProvider } from '@/lib/api'
import { useRouteRequest } from '@/lib/requests'
import { computed } from 'vue'
import { useRoute } from 'vue-router'

/** Resolves route metadata and the direct knot location shared by repository views. */
export function useRepositoryRoute() {
	const route = useRoute()
	const getClient = useBobbinClientProvider()
	const repo = computed(() => String(route.params.repo ?? ''))
	const repositoryRequest = useRouteRequest(repo, (identifier, signal, attempt) =>
		getClient().getRepo(identifier as Parameters<ReturnType<typeof getClient>['getRepo']>[0], {
			signal,
			cache: attempt.cache,
		}),
	)
	const repository = computed(() => repositoryRequest.data.value)
	const repoDid = computed(() => repository.value?.value.repoDid ?? '')
	const repoUri = computed(() => repository.value?.uri ?? '')
	const repositoryLocation = computed<RepositoryLocation | undefined>(() => {
		const did = repository.value?.value.repoDid
		const knot = repository.value?.value.knot
		return did && knot ? { did, knot } : undefined
	})

	return { getClient, repo, repoDid, repoUri, repository, repositoryLocation, repositoryRequest, route }
}
