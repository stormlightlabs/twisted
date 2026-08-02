import { useBobbinClientProvider } from '@/lib/api'
import { useRouteRequest } from '@/lib/requests'
import { computed } from 'vue'
import { useRoute } from 'vue-router'

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

	return { getClient, repo, repoDid, repoUri, repository, repositoryRequest, route }
}
