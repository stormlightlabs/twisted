import { DEFAULT_BOBBIN_SERVICE } from '@/api'
import { SERVICE_STORAGE_KEY, loadBobbinService, saveBobbinService } from '@/settings/service'
import { THEME_STORAGE_KEY } from '@/theme'
import { describe, expect, test, vi } from 'vitest'

describe('Bobbin service persistence', () => {
	test.each([null, 'http://api.example.com', 'not a URL'])(
		'recovers the default from absent or invalid data',
		(saved) => {
			expect(loadBobbinService({ getItem: () => saved })).toBe(DEFAULT_BOBBIN_SERVICE)
		},
	)

	test('persists a normalized HTTPS service independently from the theme', () => {
		const storage = { getItem: vi.fn(), setItem: vi.fn(), removeItem: vi.fn() }

		expect(saveBobbinService(storage, 'https://bobbin.example.com/')).toBe('https://bobbin.example.com')
		expect(storage.setItem).toHaveBeenCalledWith(SERVICE_STORAGE_KEY, 'https://bobbin.example.com')
		expect(storage.setItem).not.toHaveBeenCalledWith(THEME_STORAGE_KEY, expect.anything())
	})

	test('removes the override when the default is selected', () => {
		const storage = { getItem: vi.fn(), setItem: vi.fn(), removeItem: vi.fn() }

		saveBobbinService(storage, DEFAULT_BOBBIN_SERVICE)
		expect(storage.removeItem).toHaveBeenCalledWith(SERVICE_STORAGE_KEY)
	})
})
