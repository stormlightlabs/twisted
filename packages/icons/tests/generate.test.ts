import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll, describe, expect, test } from 'bun:test'
import sharp from 'sharp'
import { generateIcons, getIconRecipes } from '../src/generate'

const workspaceRoot = path.resolve(import.meta.dir, '../../..')
const source = path.join(workspaceRoot, 'packages/app/public/favicon.png')
const temporaryDirectories: string[] = []

afterAll(async () => {
	await Promise.all(temporaryDirectories.map((directory) => rm(directory, { recursive: true, force: true })))
})

describe('generateIcons', () => {
	test('creates every PWA recipe at its declared dimensions', async () => {
		const outputDirectory = await mkdtemp(path.join(tmpdir(), 'twisted-icons-'))
		temporaryDirectories.push(outputDirectory)

		await generateIcons({ input: source, outputDirectory })

		for (const recipe of getIconRecipes()) {
			const metadata = await sharp(path.join(outputDirectory, recipe.filename)).metadata()
			expect(metadata).toMatchObject({ format: 'png', width: recipe.size, height: recipe.size, hasAlpha: false })
		}
	})

	test('keeps every generated PWA icon in the web manifest', async () => {
		const manifestPath = path.join(workspaceRoot, 'packages/app/public/manifest.webmanifest')
		const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as {
			icons: Array<{ purpose: string; sizes: string; src: string; type: string }>
		}
		const manifestIcons = new Map(manifest.icons.map((icon) => [path.basename(icon.src), icon]))

		for (const recipe of getIconRecipes().filter(({ purpose }) => purpose !== 'apple-touch')) {
			expect(manifestIcons.get(recipe.filename)).toEqual({
				purpose: recipe.purpose,
				sizes: `${recipe.size}x${recipe.size}`,
				src: `/icons/${recipe.filename}`,
				type: 'image/png',
			})
		}
	})
})
