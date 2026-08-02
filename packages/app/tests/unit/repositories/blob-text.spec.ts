import { presentBlobText } from '@/features/repositories/blobText'
import { MAX_TEXT_BLOB_BYTES } from '@/lib/api'
import { describe, expect, test } from 'vitest'

describe('repository blob text', () => {
	test('splits UTF-8 source into stable display lines', () => {
		expect(presentBlobText({ path: 'hello.ts', ref: 'main', content: 'one\ntwo', encoding: 'utf-8' })).toEqual({
			kind: 'text',
			lines: ['one', 'two'],
		})
	})

	test('refuses binary and oversized previews', () => {
		expect(presentBlobText({ path: 'image.png', ref: 'main', isBinary: true }).kind).toBe('download')
		expect(presentBlobText({ path: 'large.txt', ref: 'main', size: MAX_TEXT_BLOB_BYTES + 1 }).kind).toBe('download')
	})
})
