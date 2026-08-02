import router from '@/lib/router'
import { renderMarkdown } from '@/content'
import { describe, expect, test } from 'vitest'

const resolveRoute = (location: Parameters<typeof router.resolve>[0]) => router.resolve(location).href

describe('renderMarkdown', () => {
	test('removes executable HTML, SVG, styles, and unsafe links', () => {
		const html = renderMarkdown(`
# Safe heading

<script>alert('script')</script>
<svg onload="alert('svg')"><script>alert('nested')</script></svg>
<style>body { display: none }</style>
<p style="position: fixed" onclick="alert('attribute')">Text</p>
[unsafe](javascript:alert('link'))
![tracking pixel](https://tracker.example/pixel.png)
		`)
		const container = document.createElement('div')
		container.innerHTML = html

		expect(html).toContain('<h1>Safe heading</h1>')
		expect(html).toContain('<p>Text</p>')
		expect(container.querySelector('script, svg, style, img')).toBeNull()
		expect(container.querySelector('[style], [onclick]')).toBeNull()
		expect(container.querySelector('a[href^="javascript:"]')).toBeNull()
	})

	test('routes identifiers, references, and Tangled links to local views', () => {
		const repo = 'at://did:plc:owner/sh.tangled.repo/key'
		const html = renderMarkdown(
			`[Repository](${repo}) [Tangled](https://tangled.org/owner/repo)\n\nContact did:plc:reader or @reader.example about #3m.issue.`,
			{ repo, resolveRoute },
		)
		const container = document.createElement('div')
		container.innerHTML = html
		const anchors = [...container.querySelectorAll('a')]

		expect(anchors).toHaveLength(5)
		expect(anchors.every((anchor) => anchor.dataset.twistedLink === 'local')).toBe(true)
		expect(anchors.map((anchor) => anchor.getAttribute('href'))).toEqual([
			router.resolve({ name: 'repository', params: { repo } }).href,
			router.resolve({ name: 'search', query: { q: 'https://tangled.org/owner/repo' } }).href,
			router.resolve({ name: 'profile', params: { actor: 'did:plc:reader' } }).href,
			router.resolve({ name: 'profile', params: { actor: 'reader.example' } }).href,
			router.resolve({ name: 'issue', params: { repo, rkey: '3m.issue' } }).href,
		])
	})

	test('opens ordinary web links safely and removes unsupported relative targets', () => {
		const html = renderMarkdown('[docs](https://docs.tangled.org) [relative](../secrets) [section](#usage)')
		const container = document.createElement('div')
		container.innerHTML = html
		const [external, relative, section] = [...container.querySelectorAll('a')]

		expect(external.getAttribute('target')).toBe('_blank')
		expect(external.getAttribute('rel')).toBe('noopener noreferrer')
		expect(relative.hasAttribute('href')).toBe(false)
		expect(section.getAttribute('href')).toBe('#usage')
	})
})
