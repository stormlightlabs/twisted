#!/usr/bin/env bun

import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { generateIcons } from './generate'

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const defaultInput = path.join(workspaceRoot, 'packages/app/public/favicon.png')
const defaultOutput = path.join(workspaceRoot, 'packages/app/public/icons')
const arguments_ = process.argv.slice(2)
if (arguments_.at(0) === '--') arguments_.shift()

function option(name: string): string | undefined {
	const index = arguments_.indexOf(name)
	return index === -1 ? undefined : arguments_.at(index + 1)
}

const positionalInput = arguments_.at(0)?.startsWith('--') ? undefined : arguments_.at(0)
const requestedOutput = option('--output')
const input = positionalInput ? path.resolve(workspaceRoot, positionalInput) : defaultInput
const outputDirectory = requestedOutput ? path.resolve(workspaceRoot, requestedOutput) : defaultOutput
const background = option('--background') ?? '#212337'

const recipes = await generateIcons({ background, input, outputDirectory })
for (const recipe of recipes) {
	console.log(`${recipe.filename}\t${recipe.size}x${recipe.size}\t${recipe.purpose}`)
}
