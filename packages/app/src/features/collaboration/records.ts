import { parseAtUri } from '@/content'

export function recordAuthor(uri: string): string {
	return parseAtUri(uri)?.authority ?? 'Unknown author'
}

export function recordKey(uri: string): string {
	return parseAtUri(uri)?.rkey ?? uri
}

export function shortState(value: string | undefined, fallback = 'open'): string {
	return value?.split('.').at(-1) || fallback
}

export function commentMarkdown(comment: { readonly body: string | { readonly text: string } }): string {
	if (typeof comment.body === 'string') return comment.body
	return comment.body.text
}

export function formatRecordDate(value: string): string {
	return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}
