import type { RecordLinkContext } from '@/content/links'
import { localRecordLink } from '@/content/links'
import DOMPurify from 'dompurify'
import { markdownToHtml } from 'satteri'
import type { RouteLocationRaw } from 'vue-router'

export interface MarkdownOptions extends RecordLinkContext {
	resolveRoute?: (location: RouteLocationRaw) => string
}

const ALLOWED_TAGS = [
	'a',
	'blockquote',
	'br',
	'code',
	'del',
	'em',
	'h1',
	'h2',
	'h3',
	'h4',
	'h5',
	'h6',
	'hr',
	'li',
	'ol',
	'p',
	'pre',
	'strong',
	'table',
	'tbody',
	'td',
	'th',
	'thead',
	'tr',
	'ul',
]

const LINKABLE_TEXT =
	/at:\/\/[^/\s]+\/[a-z][a-z0-9.-]+\/[a-zA-Z0-9._~:%-]+|did:[a-z0-9]+:[a-zA-Z0-9._:%-]+|@[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}|#[a-zA-Z0-9._~:-]{1,512}/gi

/** Compiles untrusted Markdown with Satteri, then applies a deliberately small HTML policy. */
export function renderMarkdown(source: string, options: MarkdownOptions = {}): string {
	const result = markdownToHtml(source, { features: { gfm: true } })
	const sanitized = DOMPurify.sanitize(result.html, {
		ALLOWED_ATTR: ['href', 'title'],
		ALLOWED_TAGS,
		ALLOW_UNKNOWN_PROTOCOLS: false,
		FORBID_ATTR: ['style'],
		FORBID_TAGS: ['form', 'iframe', 'math', 'object', 'script', 'style', 'svg', 'template'],
		ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|at|did):|#|\/|\.\.\/|\.\/)/i,
	})

	if (typeof document === 'undefined') return sanitized

	const template = document.createElement('template')
	template.innerHTML = sanitized
	linkExistingAnchors(template.content, options)
	linkTextIdentifiers(template.content, options)
	return template.innerHTML
}

function linkExistingAnchors(root: DocumentFragment, options: MarkdownOptions): void {
	for (const anchor of Array.from(root.querySelectorAll('a'))) {
		const href = anchor.getAttribute('href')
		if (!href) continue

		const local = localRecordLink(href, options)
		if (local && options.resolveRoute) {
			anchor.href = options.resolveRoute(local)
			anchor.dataset.twistedLink = 'local'
			continue
		}

		if (/^https?:/i.test(href)) {
			anchor.target = '_blank'
			anchor.rel = 'noopener noreferrer'
			continue
		}

		if (!href.startsWith('#') && !href.startsWith('mailto:')) anchor.removeAttribute('href')
	}
}

function linkTextIdentifiers(root: DocumentFragment, options: MarkdownOptions): void {
	const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
	const nodes: Text[] = []
	let current = walker.nextNode()
	while (current) {
		const parent = current.parentElement
		if (parent && !parent.closest('a, code, pre')) nodes.push(current as Text)
		current = walker.nextNode()
	}

	for (const node of nodes) {
		const value = node.nodeValue ?? ''
		const matches = [...value.matchAll(LINKABLE_TEXT)]
		if (matches.length === 0) continue

		const fragment = document.createDocumentFragment()
		let offset = 0
		for (const match of matches) {
			const matchedText = match[0]
			const text = matchedText.replace(/[.,!?;]+$/, '')
			const trailingText = matchedText.slice(text.length)
			const index = match.index ?? 0
			const local = localRecordLink(text, options)
			if (!local || !options.resolveRoute) continue

			fragment.append(value.slice(offset, index))
			const anchor = document.createElement('a')
			anchor.href = options.resolveRoute(local)
			anchor.dataset.twistedLink = 'local'
			anchor.textContent = text
			fragment.append(anchor)
			fragment.append(trailingText)
			offset = index + matchedText.length
		}

		if (offset > 0) {
			fragment.append(value.slice(offset))
			node.replaceWith(fragment)
		}
	}
}
