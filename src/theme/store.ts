import { computed, readonly, ref } from 'vue'
import { applyScheme, contrastRatio, mapSchemeToTokens, parseBase16Scheme } from './base16'
import type { Base16Scheme } from './base16'
import { BUNDLED_SCHEMES, DEFAULT_SCHEME_ID } from './schemes'

export const THEME_STORAGE_KEY = 'twisted.theme.v1'

interface ThemePreferences {
	selectedId: string
	imports: Base16Scheme[]
}

type ThemeStorage = Pick<Storage, 'getItem' | 'setItem'>

/** Reads preferences defensively and discards invalid imports or selections. */
export function loadThemePreferences(
	storage: ThemeStorage | undefined,
	bundled: readonly Base16Scheme[] = BUNDLED_SCHEMES,
): ThemePreferences {
	const fallback = { selectedId: DEFAULT_SCHEME_ID, imports: [] }
	if (storage === undefined) {
		return fallback
	}

	try {
		const raw = storage.getItem(THEME_STORAGE_KEY)
		if (raw === null) {
			return fallback
		}
		const saved = JSON.parse(raw) as unknown
		if (!isRecord(saved)) {
			return fallback
		}

		const bundledIds = new Set(bundled.map(({ id }) => id))
		const imports = Array.isArray(saved.imports)
			? saved.imports.flatMap((candidate) => {
					try {
						const imported = parseBase16Scheme(candidate)
						return bundledIds.has(imported.id) || !hasAccessibleControls(imported) ? [] : [imported]
					} catch {
						return []
					}
				})
			: []
		const availableIds = new Set([...bundledIds, ...imports.map(({ id }) => id)])
		const selectedId =
			typeof saved.selectedId === 'string' && availableIds.has(saved.selectedId) ? saved.selectedId : DEFAULT_SCHEME_ID

		return { selectedId, imports }
	} catch {
		return fallback
	}
}

export function saveThemePreferences(storage: ThemeStorage, preferences: ThemePreferences): void {
	storage.setItem(THEME_STORAGE_KEY, JSON.stringify(preferences))
}

const bundledSchemes = [...BUNDLED_SCHEMES]
const importedSchemes = ref<Base16Scheme[]>([])
const selectedId = ref(DEFAULT_SCHEME_ID)
const schemes = computed(() => [...bundledSchemes, ...importedSchemes.value])
const activeScheme = computed(() => schemes.value.find(({ id }) => id === selectedId.value) ?? BUNDLED_SCHEMES[0])

function persist(): void {
	if (typeof window !== 'undefined') {
		saveThemePreferences(window.localStorage, { selectedId: selectedId.value, imports: importedSchemes.value })
	}
}

function applyActiveScheme(): void {
	if (typeof document !== 'undefined') {
		applyScheme(activeScheme.value)
	}
}

/** Initializes the singleton theme state before Vue mounts to avoid an unthemed frame. */
export function initializeTheme(): void {
	const preferences = loadThemePreferences(typeof window === 'undefined' ? undefined : window.localStorage)
	importedSchemes.value = preferences.imports
	selectedId.value = preferences.selectedId
	applyActiveScheme()
}

export function useTheme() {
	function selectTheme(id: string): boolean {
		if (!schemes.value.some((scheme) => scheme.id === id)) {
			return false
		}
		selectedId.value = id
		applyActiveScheme()
		persist()
		return true
	}

	function importTheme(input: unknown): Base16Scheme {
		const imported = parseBase16Scheme(input)
		if (bundledSchemes.some(({ id }) => id === imported.id)) {
			throw new TypeError(`A bundled theme already uses the id “${imported.id}”`)
		}
		if (!hasAccessibleControls(imported)) {
			throw new TypeError('The imported theme does not provide enough contrast for readable controls')
		}
		importedSchemes.value = [...importedSchemes.value.filter(({ id }) => id !== imported.id), imported]
		selectedId.value = imported.id
		applyActiveScheme()
		persist()
		return imported
	}

	return {
		schemes: readonly(schemes),
		activeScheme: readonly(activeScheme),
		selectedId: readonly(selectedId),
		selectTheme,
		importTheme,
	}
}

function hasAccessibleControls(scheme: Base16Scheme): boolean {
	const tokens = mapSchemeToTokens(scheme)
	return (
		contrastRatio(tokens['--app-text'], tokens['--app-background']) >= 4.5 &&
		contrastRatio(tokens['--app-text-muted'], tokens['--app-background']) >= 4.5 &&
		contrastRatio(tokens['--app-accent'], tokens['--app-background']) >= 4.5 &&
		contrastRatio(tokens['--app-accent-contrast'], tokens['--app-accent']) >= 4.5 &&
		contrastRatio(tokens['--app-border'], tokens['--app-surface']) >= 3
	)
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}
