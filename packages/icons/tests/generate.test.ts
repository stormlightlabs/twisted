import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll, describe, expect, test } from 'bun:test'
import sharp from 'sharp'
import { generateIcons, ICON_RECIPES } from '../src/generate'

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

		for (const recipe of ICON_RECIPES) {
			const metadata = await sharp(path.join(outputDirectory, recipe.filename)).metadata()
			expect(metadata).toMatchObject({ format: 'png', width: recipe.size, height: recipe.size, hasAlpha: false })
		}
	})
})
