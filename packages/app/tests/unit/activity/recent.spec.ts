import {
	RECENT_ACTIVITY_STORAGE_KEY,
	clearRecentActivity,
	initializeRecentActivity,
	loadRecentActivity,
	forgetRecentDestination,
	rememberRecentPerson,
	rememberRecentRepository,
	rememberRecentRoute,
	useRecentActivity,
} from '@/lib/activity/recent'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

function memoryStorage(initial: Record<string, string> = {}) {
	const values = new Map(Object.entries(initial))
	return {
		getItem: vi.fn((key: string) => values.get(key) ?? null),
		setItem: vi.fn((key: string, value: string) => values.set(key, value)),
		removeItem: vi.fn((key: string) => values.delete(key)),
	}
}

function recentRouter() {
	const component = { template: '<div />' }
	return createRouter({
		history: createMemoryHistory(),
		routes: [
			{ path: '/search', name: 'search', component },
			{ path: '/profiles/:actor', name: 'profile', component },
			{ path: '/repositories/:repo', name: 'repository', component },
		],
	})
}

describe('recent activity', () => {
	beforeEach(() => initializeRecentActivity(memoryStorage()))
	afterEach(() => clearRecentActivity())

	test('keeps only successfully resolved people and repositories', async () => {
		const router = recentRouter()
		await router.push('/profiles/person.example')
		rememberRecentRoute(router.currentRoute.value)
		await router.push('/search?q=twisted')
		rememberRecentRoute(router.currentRoute.value)
		rememberRecentPerson('person.example', 'person.example')
		rememberRecentRepository('at://did:plc:person/sh.tangled.repo/3mrepo', 'Twisted')

		expect(useRecentActivity().recentDestinations.value).toMatchObject([
			{ kind: 'repository', label: 'Twisted', detail: '3mrepo' },
			{ kind: 'person', label: '@person.example', target: 'person.example' },
			{ kind: 'search', label: 'twisted', target: 'twisted' },
		])
	})

	test('drops unresolved legacy history and forgets failed destinations', () => {
		const storage = memoryStorage({
			[RECENT_ACTIVITY_STORAGE_KEY]: JSON.stringify([
				{ kind: 'person', label: '@desertthunder.defv', target: 'desertthunder.defv', visitedAt: 1 },
				{ kind: 'search', label: 'twisted', target: 'twisted', visitedAt: 2 },
			]),
		})
		initializeRecentActivity(storage)
		expect(useRecentActivity().recentDestinations.value).toMatchObject([{ kind: 'search', label: 'twisted' }])

		rememberRecentPerson('person.example', 'person.example')
		forgetRecentDestination('person', 'person.example')
		expect(useRecentActivity().recentDestinations.value).toMatchObject([{ kind: 'search' }])
	})

	test('ignores malformed saved data and unsupported route values', async () => {
		const storage = memoryStorage({ [RECENT_ACTIVITY_STORAGE_KEY]: '[{"kind":"person"}]' })
		expect(loadRecentActivity(storage)).toEqual([])

		initializeRecentActivity(storage)
		const router = recentRouter()
		await router.push('/repositories/not-valid')
		rememberRecentRoute(router.currentRoute.value)
		expect(useRecentActivity().recentDestinations.value).toEqual([])
	})

	test('clears persisted history', () => {
		const storage = memoryStorage()
		initializeRecentActivity(storage)
		clearRecentActivity()
		expect(storage.removeItem).toHaveBeenCalledWith(RECENT_ACTIVITY_STORAGE_KEY)
	})
})
