import { MAX_TEXT_BLOB_BYTES } from '@/lib/api'
import type { ShTangledRepoBlob } from '@atcute/tangled'

export type BlobTextResult =
	{ kind: 'text'; lines: string[] } | { kind: 'download'; reason: 'binary' | 'large' | 'unavailable' }

export function presentBlobText(blob: ShTangledRepoBlob.$output): BlobTextResult {
	if (blob.isBinary) return { kind: 'download', reason: 'binary' }
	if (blob.fileTooLarge || (blob.size ?? 0) > MAX_TEXT_BLOB_BYTES) return { kind: 'download', reason: 'large' }
	if (blob.content === undefined) return { kind: 'download', reason: 'unavailable' }

	let text: string
	if (blob.encoding === 'base64') {
		const estimatedBytes = Math.floor((blob.content.length * 3) / 4)
		if (estimatedBytes > MAX_TEXT_BLOB_BYTES) return { kind: 'download', reason: 'large' }
		try {
			const bytes = Uint8Array.from(atob(blob.content), (character) => character.charCodeAt(0))
			text = new TextDecoder().decode(bytes)
		} catch {
			return { kind: 'download', reason: 'unavailable' }
		}
	} else {
		if (blob.content.length > MAX_TEXT_BLOB_BYTES) return { kind: 'download', reason: 'large' }
		text = blob.content
		if (new TextEncoder().encode(text).byteLength > MAX_TEXT_BLOB_BYTES) {
			return { kind: 'download', reason: 'large' }
		}
	}

	return { kind: 'text', lines: text.split('\n') }
}
