import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

export type IconPurpose = 'any' | 'maskable' | 'apple-touch'

export interface IconRecipe {
	filename: string
	size: number
	markScale: number
	purpose: IconPurpose
}

export const ICON_RECIPES: readonly IconRecipe[] = [
	{ filename: 'icon-192.png', size: 192, markScale: 0.78, purpose: 'any' },
	{ filename: 'icon-512.png', size: 512, markScale: 0.78, purpose: 'any' },
	{ filename: 'icon-maskable-192.png', size: 192, markScale: 0.56, purpose: 'maskable' },
	{ filename: 'icon-maskable-512.png', size: 512, markScale: 0.56, purpose: 'maskable' },
	{ filename: 'apple-touch-icon.png', size: 180, markScale: 0.74, purpose: 'apple-touch' },
] as const

export interface GenerateIconsOptions {
	background?: string
	input: string
	outputDirectory: string
}

export async function generateIcons({
	background = '#212337',
	input,
	outputDirectory,
}: GenerateIconsOptions): Promise<IconRecipe[]> {
	const source = sharp(input)
	const metadata = await source.metadata()
	if (!metadata.width || !metadata.height) throw new Error('The source icon has no measurable dimensions.')
	if (metadata.width !== metadata.height) throw new Error('The source icon must be square.')

	await mkdir(outputDirectory, { recursive: true })
	await Promise.all(
		ICON_RECIPES.map(async (recipe) => {
			const markSize = Math.round(recipe.size * recipe.markScale)
			const mark = await sharp(input)
				.resize(markSize, markSize, { fit: 'contain' })
				.png({ compressionLevel: 9 })
				.toBuffer()

			const destination = path.join(outputDirectory, recipe.filename)
			await sharp({ create: { width: recipe.size, height: recipe.size, channels: 4, background } })
				.composite([{ input: mark, gravity: 'centre' }])
				.removeAlpha()
				.png({ compressionLevel: 9 })
				.toFile(destination)

			const result = await sharp(destination).metadata()
			if (result.format !== 'png' || result.width !== recipe.size || result.height !== recipe.size || result.hasAlpha) {
				throw new Error(`Generated icon failed validation: ${destination}`)
			}
		}),
	)

	return [...ICON_RECIPES]
}
