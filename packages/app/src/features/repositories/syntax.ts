import bash from '@shikijs/langs/bash'
import c from '@shikijs/langs/c'
import cpp from '@shikijs/langs/cpp'
import css from '@shikijs/langs/css'
import diff from '@shikijs/langs/diff'
import go from '@shikijs/langs/go'
import html from '@shikijs/langs/html'
import javascript from '@shikijs/langs/javascript'
import json from '@shikijs/langs/json'
import markdown from '@shikijs/langs/markdown'
import python from '@shikijs/langs/python'
import rust from '@shikijs/langs/rust'
import toml from '@shikijs/langs/toml'
import typescript from '@shikijs/langs/typescript'
import vue from '@shikijs/langs/vue'
import yaml from '@shikijs/langs/yaml'
import { createHighlighterCore } from 'shiki/core'
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript'
import type { ThemedToken, ThemeRegistrationRaw } from 'shiki'

type SyntaxLanguage =
	| 'bash'
	| 'c'
	| 'cpp'
	| 'css'
	| 'diff'
	| 'go'
	| 'html'
	| 'javascript'
	| 'json'
	| 'markdown'
	| 'python'
	| 'rust'
	| 'toml'
	| 'typescript'
	| 'vue'
	| 'yaml'

const EXTENSIONS: Readonly<Record<string, SyntaxLanguage>> = {
	bash: 'bash',
	c: 'c',
	cc: 'cpp',
	cpp: 'cpp',
	css: 'css',
	diff: 'diff',
	go: 'go',
	h: 'c',
	hpp: 'cpp',
	htm: 'html',
	html: 'html',
	js: 'javascript',
	json: 'json',
	md: 'markdown',
	mdx: 'markdown',
	patch: 'diff',
	py: 'python',
	rs: 'rust',
	sh: 'bash',
	toml: 'toml',
	ts: 'typescript',
	vue: 'vue',
	xhtml: 'html',
	yaml: 'yaml',
	yml: 'yaml',
}

const FILENAMES: Readonly<Record<string, SyntaxLanguage>> = { Dockerfile: 'bash', Makefile: 'bash' }

const theme = {
	name: 'twisted-css-variables',
	type: 'dark',
	colors: { 'editor.background': 'var(--app-background)', 'editor.foreground': 'var(--app-text)' },
	settings: [],
	tokenColors: [
		{ scope: ['comment', 'punctuation.definition.comment'], settings: { foreground: 'var(--app-text-muted)' } },
		{ scope: ['keyword', 'storage', 'variable.language'], settings: { foreground: 'var(--app-danger)' } },
		{ scope: ['string', 'constant.other.symbol'], settings: { foreground: 'var(--app-success)' } },
		{ scope: ['constant', 'support.constant'], settings: { foreground: 'var(--app-warning)' } },
		{ scope: ['entity.name.function', 'support.function'], settings: { foreground: 'var(--app-accent)' } },
		{ scope: ['entity.name.type', 'support.type'], settings: { foreground: 'var(--app-warning)' } },
	],
} satisfies ThemeRegistrationRaw

let highlighterPromise: ReturnType<typeof createHighlighter> | undefined

async function createHighlighter() {
	return createHighlighterCore({
		engine: createJavaScriptRegexEngine(),
		langs: [bash, c, cpp, css, diff, go, html, javascript, json, markdown, python, rust, toml, typescript, vue, yaml],
		themes: [theme],
	})
}

/** Selects a bundled Shiki grammar from a repository path, falling back to plain text. */
export function languageForPath(path: string): SyntaxLanguage | 'text' {
	const filename = path.split('/').at(-1) ?? path
	const extension = filename.includes('.') ? filename.split('.').at(-1)?.toLowerCase() : undefined
	return FILENAMES[filename] ?? (extension ? EXTENSIONS[extension] : undefined) ?? 'text'
}

/** Tokenizes source with Shiki's CSS-variable theme so the active Base16 scheme remains authoritative. */
export async function highlightSource(source: string, path: string): Promise<ThemedToken[][]> {
	highlighterPromise ??= createHighlighter()
	const highlighter = await highlighterPromise
	return highlighter.codeToTokens(source, { lang: languageForPath(path), theme: theme.name }).tokens
}
