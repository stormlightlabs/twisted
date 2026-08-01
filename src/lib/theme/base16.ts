export const BASE16_SLOTS = [
	'base00',
	'base01',
	'base02',
	'base03',
	'base04',
	'base05',
	'base06',
	'base07',
	'base08',
	'base09',
	'base0A',
	'base0B',
	'base0C',
	'base0D',
	'base0E',
	'base0F',
] as const

export type Base16Slot = (typeof BASE16_SLOTS)[number]
export type Base16Palette = Record<Base16Slot, string>

/** A normalized Base16 scheme accepted by the application. */
export interface Base16Scheme {
	id: string
	name: string
	author?: string
	variant: 'light' | 'dark'
	palette: Base16Palette
}

export type ThemeTokens = Record<`--${string}`, string>

const HEX_COLOR = /^#[\da-f]{6}$/i

/** Parses current Tinted YAML-as-JSON and legacy flat Base16 JSON shapes. */
export function parseBase16Scheme(input: unknown): Base16Scheme {
	if (!isRecord(input)) {
		throw new TypeError('A Base16 scheme must be a JSON object')
	}
	if (input.system !== undefined && input.system !== 'base16') {
		throw new TypeError('The imported scheme is not Base16')
	}

	const name = readName(input)
	const paletteSource = isRecord(input.palette) ? input.palette : input
	const palette = Object.fromEntries(
		BASE16_SLOTS.map((slot) => [slot, readColor(paletteSource, slot)]),
	) as Base16Palette
	const variant = input.variant === 'light' || input.variant === 'dark' ? input.variant : inferVariant(palette)
	const suppliedId = typeof input.id === 'string' ? input.id : typeof input.slug === 'string' ? input.slug : name
	const id = slugify(suppliedId)

	if (id.length === 0) {
		throw new TypeError('The imported scheme needs a stable id or name')
	}

	return {
		id,
		name,
		author: typeof input.author === 'string' && input.author.trim() ? input.author.trim() : undefined,
		variant,
		palette,
	}
}

/** Maps Base16 palette slots to stable application and Ionic semantic tokens. */
export function mapSchemeToTokens(scheme: Base16Scheme): ThemeTokens {
	const palette = scheme.palette
	const background = palette.base00
	const surface = palette.base01
	const text = readableFrom(background, [palette.base05, palette.base06, palette.base07, palette.base04], 4.5)
	const muted = readableFrom(background, [palette.base04, palette.base05, palette.base06, palette.base03], 4.5)
	const accent = readableFrom(
		background,
		[palette.base0D, palette.base0C, palette.base0E, palette.base0B, palette.base07, text],
		4.5,
	)
	const accentContrast = highestContrast(accent, [background, palette.base07, '#000000', '#ffffff'])
	const border = readableFrom(surface, [palette.base03, palette.base04, palette.base05], 3)

	return {
		'--app-background': background,
		'--app-surface': surface,
		'--app-surface-raised': palette.base02,
		'--app-border': border,
		'--app-text': text,
		'--app-text-muted': muted,
		'--app-accent': accent,
		'--app-accent-contrast': accentContrast,
		'--app-danger': readableFrom(background, [palette.base08, palette.base09, text], 4.5),
		'--app-warning': readableFrom(background, [palette.base0A, palette.base09, text], 4.5),
		'--app-success': readableFrom(background, [palette.base0B, palette.base0C, text], 4.5),
		'--app-focus': readableFrom(background, [palette.base0C, palette.base0D, palette.base0E, palette.base07, text], 3),
		'--ion-background-color': background,
		'--ion-background-color-rgb': hexToRgbTriplet(background),
		'--ion-text-color': text,
		'--ion-text-color-rgb': hexToRgbTriplet(text),
		'--ion-color-primary': accent,
		'--ion-color-primary-rgb': hexToRgbTriplet(accent),
		'--ion-color-primary-contrast': accentContrast,
		'--ion-color-primary-contrast-rgb': hexToRgbTriplet(accentContrast),
		'--ion-color-primary-shade': mixHex(accent, '#000000', 0.12),
		'--ion-color-primary-tint': mixHex(accent, '#ffffff', 0.14),
		'--ion-toolbar-background': surface,
		'--ion-toolbar-color': text,
		'--ion-item-background': surface,
		'--ion-card-background': surface,
	}
}

/** Applies a validated scheme without exposing palette slots to components. */
export function applyScheme(scheme: Base16Scheme, root: HTMLElement = document.documentElement): void {
	for (const [property, value] of Object.entries(mapSchemeToTokens(scheme))) {
		root.style.setProperty(property, value)
	}
	root.dataset.theme = scheme.id
	root.style.colorScheme = scheme.variant

	if (root === document.documentElement) {
		document.querySelector('meta[name="theme-color"]')?.setAttribute('content', scheme.palette.base00)
	}
}

/** WCAG contrast ratio for two six-digit hexadecimal colors. */
export function contrastRatio(foreground: string, background: string): number {
	const lighter = Math.max(relativeLuminance(foreground), relativeLuminance(background))
	const darker = Math.min(relativeLuminance(foreground), relativeLuminance(background))
	return (lighter + 0.05) / (darker + 0.05)
}

function readName(input: Record<string, unknown>): string {
	const value = typeof input.name === 'string' ? input.name : input.scheme
	if (typeof value !== 'string' || value.trim().length === 0) {
		throw new TypeError('The imported scheme needs a name')
	}
	return value.trim()
}

function readColor(input: Record<string, unknown>, slot: Base16Slot): string {
	const value = input[slot]
	if (typeof value !== 'string') {
		throw new TypeError(`The imported scheme is missing ${slot}`)
	}
	const normalized = value.startsWith('#') ? value : `#${value}`
	if (!HEX_COLOR.test(normalized)) {
		throw new TypeError(`${slot} must be a six-digit hexadecimal color`)
	}
	return normalized.toLowerCase()
}

function inferVariant(palette: Base16Palette): 'light' | 'dark' {
	return relativeLuminance(palette.base00) > relativeLuminance(palette.base05) ? 'light' : 'dark'
}

function readableFrom(background: string, candidates: string[], minimum: number): string {
	return (
		candidates.find((color) => contrastRatio(color, background) >= minimum) ?? highestContrast(background, candidates)
	)
}

function highestContrast(background: string, candidates: string[]): string {
	return candidates.reduce((best, color) =>
		contrastRatio(color, background) > contrastRatio(best, background) ? color : best,
	)
}

function relativeLuminance(color: string): number {
	const [red, green, blue] = hexToRgb(color).map((channel) => {
		const value = channel / 255
		return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
	})
	return 0.2126 * red + 0.7152 * green + 0.0722 * blue
}

function hexToRgb(color: string): [number, number, number] {
	const value = color.replace('#', '')
	return [
		Number.parseInt(value.slice(0, 2), 16),
		Number.parseInt(value.slice(2, 4), 16),
		Number.parseInt(value.slice(4, 6), 16),
	]
}

function hexToRgbTriplet(color: string): string {
	return hexToRgb(color).join(', ')
}

function mixHex(color: string, mix: string, amount: number): string {
	const source = hexToRgb(color)
	const target = hexToRgb(mix)
	return `#${source
		.map((channel, index) =>
			Math.round(channel + (target[index] - channel) * amount)
				.toString(16)
				.padStart(2, '0'),
		)
		.join('')}`
}

function slugify(value: string): string {
	return value
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '')
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}
