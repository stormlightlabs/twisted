import SettingsPage from '@/views/SettingsPage.vue'
import { DEFAULT_SCHEME_ID, THEME_STORAGE_KEY, useTheme } from '@/lib/theme'
import { mountIonicRoute } from './support/mount'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'

const saved = new Map<string, string>()

describe('SettingsPage', () => {
	beforeEach(() => {
		Object.defineProperty(window, 'localStorage', {
			configurable: true,
			value: {
				getItem: (key: string) => saved.get(key) ?? null,
				removeItem: (key: string) => saved.delete(key),
				setItem: (key: string, value: string) => saved.set(key, value),
			},
		})
	})

	afterEach(() => {
		useTheme().selectTheme(DEFAULT_SCHEME_ID)
		localStorage.removeItem(THEME_STORAGE_KEY)
	})

	test('edits and applies all Base16 slots without a file importer', async () => {
		const wrapper = await mountIonicRoute(SettingsPage)

		expect(wrapper.find('input[type="file"]').exists()).toBe(false)
		expect(wrapper.findAll('.palette-field input[type="color"]')).toHaveLength(16)
		expect(wrapper.findAll('.palette-field input[type="text"]')).toHaveLength(16)

		await wrapper.get('#theme-name').setValue('Unit Test Theme')
		await wrapper.get('.theme-builder').trigger('submit')

		expect(wrapper.get('.theme-builder [role="status"]').text()).toContain('was saved and applied')
		expect(wrapper.text()).toContain('Download JSON')
		expect(wrapper.text()).toContain('Download YAML')
	})
})
