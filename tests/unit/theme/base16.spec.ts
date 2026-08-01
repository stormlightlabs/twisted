import {
	BUNDLED_SCHEMES,
	DEFAULT_SCHEME_ID,
	THEME_STORAGE_KEY,
	applyScheme,
	contrastRatio,
	loadThemePreferences,
	mapSchemeToTokens,
	parseBase16Scheme,
	useTheme,
} from '@/theme'
import { describe, expect, test } from 'vitest'

const eldritch = BUNDLED_SCHEMES.find(({ id }) => id === DEFAULT_SCHEME_ID)!

describe('Base16 themes', () => {
	test('parses legacy flat JSON and normalizes colors', () => {
		const flat = {
			scheme: 'Test Light',
			author: 'Twisted tests',
			...Object.fromEntries(
				Array.from({ length: 16 }, (_, index) => [
					`base${index.toString(16).padStart(2, '0').toUpperCase()}`,
					index === 0 ? 'fefefe' : '123456',
				]),
			),
		}

		expect(parseBase16Scheme(flat)).toMatchObject({
			id: 'test-light',
			name: 'Test Light',
			author: 'Twisted tests',
			variant: 'light',
		})
	})

	test.each([
		[null, 'JSON object'],
		[{ name: 'Incomplete', palette: { base00: '#000000' } }, 'base01'],
		[{ ...eldritch, palette: { ...eldritch.palette, base0F: 'pink' } }, 'base0F'],
		[{ ...eldritch, system: 'base24' }, 'not Base16'],
	])('rejects an invalid or incomplete scheme', (input, message) => {
		expect(() => parseBase16Scheme(input)).toThrow(message)
	})

	test('maps palette slots to semantic Ionic and application tokens', () => {
		const tokens = mapSchemeToTokens(eldritch)

		expect(tokens['--app-background']).toBe(eldritch.palette.base00)
		expect(tokens['--ion-background-color']).toBe(tokens['--app-background'])
		expect(tokens['--ion-color-primary']).toBe(tokens['--app-accent'])
		expect(tokens['--ion-color-primary-rgb']).toMatch(/^\d+, \d+, \d+$/)
	})

	test.each(BUNDLED_SCHEMES)('$name has accessible application-owned color pairs', (scheme) => {
		const tokens = mapSchemeToTokens(scheme)

		expect(contrastRatio(tokens['--app-text'], tokens['--app-background'])).toBeGreaterThanOrEqual(4.5)
		expect(contrastRatio(tokens['--app-text-muted'], tokens['--app-background'])).toBeGreaterThanOrEqual(4.5)
		expect(contrastRatio(tokens['--app-accent'], tokens['--app-background'])).toBeGreaterThanOrEqual(4.5)
		expect(contrastRatio(tokens['--app-accent-contrast'], tokens['--app-accent'])).toBeGreaterThanOrEqual(4.5)
		expect(contrastRatio(tokens['--app-border'], tokens['--app-surface'])).toBeGreaterThanOrEqual(3)
		expect(contrastRatio(tokens['--app-focus'], tokens['--app-background'])).toBeGreaterThanOrEqual(3)
	})

	test('applies only a validated scheme to the document root', () => {
		applyScheme(eldritch)

		expect(document.documentElement.dataset.theme).toBe(DEFAULT_SCHEME_ID)
		expect(document.documentElement.style.getPropertyValue('--app-background')).toBe(eldritch.palette.base00)
		expect(document.documentElement.style.colorScheme).toBe('dark')
	})

	test('does not replace the active theme when an import is invalid', () => {
		const { activeScheme, importTheme } = useTheme()
		const activeId = activeScheme.value.id

		expect(() => importTheme({ name: 'Incomplete', base00: '#000000' })).toThrow('base01')
		expect(activeScheme.value.id).toBe(activeId)
	})

	test('does not replace the active theme with an unreadable complete palette', () => {
		const { activeScheme, importTheme } = useTheme()
		const activeId = activeScheme.value.id
		const unreadable = {
			id: 'unreadable',
			name: 'Unreadable',
			variant: 'dark',
			palette: Object.fromEntries(
				Array.from({ length: 16 }, (_, index) => [
					`base${index.toString(16).padStart(2, '0').toUpperCase()}`,
					'#222222',
				]),
			),
		}

		expect(() => importTheme(unreadable)).toThrow('enough contrast')
		expect(activeScheme.value.id).toBe(activeId)
	})
})

describe('theme persistence recovery', () => {
	test.each([null, '{broken', JSON.stringify({ selectedId: 'missing', imports: [] })])(
		'recovers the reviewed default from absent or corrupt data',
		(saved) => {
			const storage = { getItem: () => saved }

			expect(loadThemePreferences(storage)).toEqual({ selectedId: DEFAULT_SCHEME_ID, imports: [] })
		},
	)

	test('loads a valid imported scheme and drops invalid imports', () => {
		const imported = { ...eldritch, id: 'personal-eldritch', name: 'Personal Eldritch' }
		const storage = {
			getItem: (key: string) =>
				key === THEME_STORAGE_KEY
					? JSON.stringify({ selectedId: imported.id, imports: [imported, { name: 'Broken' }] })
					: null,
		}

		const loaded = loadThemePreferences(storage)
		expect(loaded.selectedId).toBe(imported.id)
		expect(loaded.imports).toHaveLength(1)
		expect(loaded.imports[0].name).toBe('Personal Eldritch')
	})
})
