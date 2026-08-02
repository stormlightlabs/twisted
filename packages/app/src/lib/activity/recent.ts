import { readonly, ref } from 'vue'
import type { RouteLocationNormalizedLoaded, RouteLocationRaw } from 'vue-router'
import { links } from '@/lib/router/links'

export const RECENT_ACTIVITY_STORAGE_KEY = 'twisted.recent-activity.v1'
const MAX_RECENT_DESTINATIONS = 8

export type RecentDestinationKind = 'person' | 'repository' | 'search'

export interface RecentDestination {
	kind: RecentDestinationKind
	label: string
	target: string
	visitedAt: number
}

type RecentStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

const recentDestinations = ref<RecentDestination[]>([])
let activeStorage: RecentStorage | undefined

export function initializeRecentActivity(storage: RecentStorage | undefined): void {
	activeStorage = storage
	recentDestinations.value = loadRecentActivity(storage)
}

export function loadRecentActivity(storage: Pick<Storage, 'getItem'> | undefined): RecentDestination[] {
	if (!storage) return []
	try {
		const saved = storage.getItem(RECENT_ACTIVITY_STORAGE_KEY)
		if (saved === null) return []
		const value = JSON.parse(saved) as unknown
		if (!Array.isArray(value)) return []
		return value.filter(isRecentDestination).slice(0, MAX_RECENT_DESTINATIONS)
	} catch {
		return []
	}
}

export function rememberRecentRoute(route: RouteLocationNormalizedLoaded): void {
	const destination = destinationFromRoute(route)
	if (!destination) return

	recentDestinations.value = [
		destination,
		...recentDestinations.value.filter((item) => item.kind !== destination.kind || item.target !== destination.target),
	].slice(0, MAX_RECENT_DESTINATIONS)
	persistRecentActivity()
}

export function clearRecentActivity(): void {
	recentDestinations.value = []
	try {
		activeStorage?.removeItem(RECENT_ACTIVITY_STORAGE_KEY)
	} catch {
		// The dashboard still clears when browser storage is unavailable.
	}
}

export function recentDestinationLink(destination: RecentDestination): RouteLocationRaw {
	if (destination.kind === 'person') return links.profile(destination.target)
	if (destination.kind === 'repository') return links.repository(destination.target)
	return links.search(destination.target)
}

export function useRecentActivity() {
	return { recentDestinations: readonly(recentDestinations), clearRecentActivity }
}

function destinationFromRoute(route: RouteLocationNormalizedLoaded): RecentDestination | undefined {
	const actor = routeParameter(route.params.actor)
	if (
		actor &&
		isActorIdentifier(actor) &&
		['profile', 'actor-activity', 'actor-relationships'].includes(String(route.name))
	) {
		return {
			kind: 'person',
			label: actor.startsWith('did:') ? actor : `@${actor.replace(/^@/, '')}`,
			target: actor,
			visitedAt: Date.now(),
		}
	}

	const repository = routeParameter(route.params.repo)
	if (repository?.startsWith('at://')) {
		return { kind: 'repository', label: repositoryLabel(repository), target: repository, visitedAt: Date.now() }
	}

	const query = typeof route.query.q === 'string' ? route.query.q.trim() : ''
	if (route.name === 'search' && query) {
		return { kind: 'search', label: query, target: query, visitedAt: Date.now() }
	}

	return undefined
}

function isActorIdentifier(value: string): boolean {
	return (
		/^did:[a-z0-9]+:[^\s/]+$/i.test(value) ||
		/^(?=.{1,253}$)[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}$/i.test(value.replace(/^@/, ''))
	)
}

function routeParameter(value: unknown): string | undefined {
	if (typeof value === 'string' && value.trim()) return value
	if (Array.isArray(value)) return value.join('/')
	return undefined
}

function repositoryLabel(repository: string): string {
	const part = repository.split('/').filter(Boolean).at(-1)
	try {
		return part ? decodeURIComponent(part) : 'Repository'
	} catch {
		return part ?? 'Repository'
	}
}

function isRecentDestination(value: unknown): value is RecentDestination {
	if (typeof value !== 'object' || value === null) return false
	const item = value as Record<string, unknown>
	return (
		['person', 'repository', 'search'].includes(String(item.kind)) &&
		typeof item.label === 'string' &&
		item.label.length > 0 &&
		typeof item.target === 'string' &&
		item.target.length > 0 &&
		typeof item.visitedAt === 'number' &&
		Number.isFinite(item.visitedAt)
	)
}

function persistRecentActivity(): void {
	try {
		activeStorage?.setItem(RECENT_ACTIVITY_STORAGE_KEY, JSON.stringify(recentDestinations.value))
	} catch {
		// Recent activity remains available for the current session.
	}
}
