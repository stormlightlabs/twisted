import { readonly, ref } from 'vue'
import type { RouteLocationNormalizedLoaded, RouteLocationRaw } from 'vue-router'
import { links } from '@/lib/router/links'

export const RECENT_ACTIVITY_STORAGE_KEY = 'twisted.recent-activity.v1'
const MAX_RECENT_DESTINATIONS = 8

export type RecentDestinationKind = 'person' | 'repository' | 'search'

export type RecentDestination = {
	detail?: string
	kind: RecentDestinationKind
	label: string
	target: string
	visitedAt: number
	verified?: true
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
	if (destination) rememberDestination(destination)
}

/** Remembers a profile only after its identity has resolved successfully. */
export function rememberRecentPerson(target: string, handle: string): void {
	rememberDestination({
		kind: 'person',
		label: handle === 'handle.invalid' ? target : `@${handle.replace(/^@/, '')}`,
		target,
		visitedAt: Date.now(),
		verified: true,
	})
}

/** Remembers a repository using its readable name while retaining its canonical rkey. */
export function rememberRecentRepository(target: string, name: string): void {
	rememberDestination({
		detail: repositoryLabel(target),
		kind: 'repository',
		label: name.trim() || 'Repository',
		target,
		visitedAt: Date.now(),
		verified: true,
	})
}

/** Removes a failed destination that may have been saved by an older Twisted release. */
export function forgetRecentDestination(kind: Exclude<RecentDestinationKind, 'search'>, target: string): void {
	const next = recentDestinations.value.filter((item) => item.kind !== kind || item.target !== target)
	if (next.length === recentDestinations.value.length) return
	recentDestinations.value = next
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
	const query = typeof route.query.q === 'string' ? route.query.q.trim() : ''
	if (route.name === 'search' && query) {
		return { kind: 'search', label: query, target: query, visitedAt: Date.now() }
	}

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
		Number.isFinite(item.visitedAt) &&
		(item.kind === 'search' || item.verified === true)
	)
}

function rememberDestination(destination: RecentDestination): void {
	recentDestinations.value = [
		destination,
		...recentDestinations.value.filter((item) => item.kind !== destination.kind || item.target !== destination.target),
	].slice(0, MAX_RECENT_DESTINATIONS)
	persistRecentActivity()
}

function persistRecentActivity(): void {
	try {
		activeStorage?.setItem(RECENT_ACTIVITY_STORAGE_KEY, JSON.stringify(recentDestinations.value))
	} catch {
		// Recent activity remains available for the current session.
	}
}
