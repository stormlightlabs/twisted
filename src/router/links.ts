import type { RouteLocationRaw } from 'vue-router'

/** Named route builders let Vue Router encode every opaque identifier. */
export const links = {
	profile: (actor: string): RouteLocationRaw => ({ name: 'profile', params: { actor } }),
	repository: (repo: string): RouteLocationRaw => ({ name: 'repository', params: { repo } }),
	source: (repo: string, ref?: string, path?: string): RouteLocationRaw => ({
		name: 'repository-source',
		params: { repo },
		query: { ref, path },
	}),
	commit: (repo: string, hash: string): RouteLocationRaw => ({ name: 'repository-commit', params: { repo, hash } }),
	issue: (repo: string, rkey: string): RouteLocationRaw => ({ name: 'issue', params: { repo, rkey } }),
	pull: (repo: string, rkey: string): RouteLocationRaw => ({ name: 'pull', params: { repo, rkey } }),
	string: (uri: string): RouteLocationRaw => ({ name: 'string', params: { uri } }),
} as const
