import { highlightSource, languageForPath } from '@/features/repositories/syntax'

describe('repository syntax highlighting', () => {
	it('selects grammars from common repository paths', () => {
		expect(languageForPath('src/main.ts')).toBe('typescript')
		expect(languageForPath('components/App.vue')).toBe('vue')
		expect(languageForPath('Makefile')).toBe('bash')
		expect(languageForPath('LICENSE')).toBe('text')
	})

	it('returns escaped, theme-aware Shiki tokens', async () => {
		const lines = await highlightSource('const answer: number = 42\n<script>', 'answer.ts')
		expect(lines).toHaveLength(2)
		expect(
			lines
				.flat()
				.map((token) => token.content)
				.join(''),
		).toContain('<script>')
		expect(lines.flat().some((token) => token.color?.startsWith('var(--app-'))).toBe(true)
	})
})
