#!/usr/bin/env bun

import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { generateIcons, generateThemeLogos } from './generate'

type CommandOptions = { background: string; foreground: string; input: string; outputDirectory: string }

function option(arguments_: readonly string[], name: string): string | undefined {
	const index = arguments_.indexOf(name)
	return index === -1 ? undefined : arguments_.at(index + 1)
}

function parseOptions(rawArguments: readonly string[]): CommandOptions {
	const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
	const arguments_ = rawArguments.at(0) === '--' ? rawArguments.slice(1) : [...rawArguments]
	const positionalInput = arguments_.at(0)?.startsWith('--') ? undefined : arguments_.at(0)
	const requestedOutput = option(arguments_, '--output')

	return {
		background: option(arguments_, '--background') ?? '#212337',
		foreground: option(arguments_, '--foreground') ?? '#ebfafa',
		input: positionalInput
			? path.resolve(workspaceRoot, positionalInput)
			: path.join(workspaceRoot, 'packages/app/public/base.svg'),
		outputDirectory: requestedOutput
			? path.resolve(workspaceRoot, requestedOutput)
			: path.join(workspaceRoot, 'packages/app/public/icons'),
	}
}

/** Runs the icon generator command with explicit arguments for testability. */
export async function main(rawArguments: readonly string[] = process.argv.slice(2)): Promise<void> {
	const options = parseOptions(rawArguments)
	const [recipes, logos] = await Promise.all([
		generateIcons(options),
		generateThemeLogos(options.input, options.outputDirectory),
	])
	for (const recipe of recipes) {
		console.log(`${recipe.filename}\t${recipe.size}x${recipe.size}\t${recipe.purpose}`)
	}
	for (const logo of logos) console.log(`${logo.filename}\t${logo.variant}\t${logo.color}`)
}

function isMainModule(): boolean {
	return process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
}

if (isMainModule()) await main()
