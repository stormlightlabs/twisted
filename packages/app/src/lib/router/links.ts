import type { LocationQueryRaw, RouteLocationRaw } from 'vue-router'

type Filters = LocationQueryRaw

/** Named route builders are the only feature-facing boundary for opaque identifiers. */
export const links = {
	landing: { name: 'landing' } satisfies RouteLocationRaw,
	home: { name: 'home' } satisfies RouteLocationRaw,
	search: (query?: string): RouteLocationRaw => ({ name: 'search', query: query ? { q: query } : undefined }),
	profiles: { name: 'profiles' } satisfies RouteLocationRaw,
	profile: (actor: string): RouteLocationRaw => ({ name: 'profile', params: { actor } }),
	actorActivity: (actor: string, activity?: string): RouteLocationRaw => ({
		name: 'actor-activity',
		params: { actor, activity },
	}),
	actorRelationships: (actor: string, relationship?: string): RouteLocationRaw => ({
		name: 'actor-relationships',
		params: { actor, relationship },
	}),
	repositories: { name: 'repositories' } satisfies RouteLocationRaw,
	repository: (repo: string): RouteLocationRaw => ({ name: 'repository', params: { repo } }),
	source: (repo: string, ref?: string, path?: string, view?: 'blob'): RouteLocationRaw => ({
		name: 'repository-source',
		params: { repo },
		query: { ref, path, view },
	}),
	commits: (repo: string, ref?: string, path?: string): RouteLocationRaw => ({
		name: 'repository-commits',
		params: { repo },
		query: { ref, path },
	}),
	commit: (repo: string, hash: string): RouteLocationRaw => ({ name: 'repository-commit', params: { repo, hash } }),
	branches: (repo: string): RouteLocationRaw => ({ name: 'repository-branches', params: { repo } }),
	tags: (repo: string): RouteLocationRaw => ({ name: 'repository-tags', params: { repo } }),
	diff: (repo: string, ref: string): RouteLocationRaw => ({ name: 'repository-diff', params: { repo, ref } }),
	compare: (repo: string, base: string, head: string): RouteLocationRaw => ({
		name: 'repository-compare',
		params: { repo },
		query: { base, head },
	}),
	issues: (repo: string, filters: Filters = {}): RouteLocationRaw => ({
		name: 'issues',
		params: { repo },
		query: filters,
	}),
	issue: (repo: string, rkey: string): RouteLocationRaw => ({ name: 'issue', params: { repo, rkey } }),
	pulls: (repo: string, filters: Filters = {}): RouteLocationRaw => ({
		name: 'pulls',
		params: { repo },
		query: filters,
	}),
	pull: (repo: string, rkey: string): RouteLocationRaw => ({ name: 'pull', params: { repo, rkey } }),
	pipelines: (repo: string, pipeline?: string): RouteLocationRaw => ({ name: 'pipelines', params: { repo, pipeline } }),
	artifact: (repo: string, artifact: string): RouteLocationRaw => ({ name: 'artifact', params: { repo, artifact } }),
	string: (uri: string): RouteLocationRaw => ({ name: 'string', params: { uri } }),
	infrastructure: { name: 'infrastructure' } satisfies RouteLocationRaw,
	knot: (knot: string): RouteLocationRaw => ({ name: 'knot', params: { knot } }),
	spindle: (spindle: string): RouteLocationRaw => ({ name: 'spindle', params: { spindle } }),
	labels: (scope: string): RouteLocationRaw => ({ name: 'labels', params: { scope } }),
	publicKeys: { name: 'public-keys' } satisfies RouteLocationRaw,
	settings: { name: 'settings' } satisfies RouteLocationRaw,
} as const
