import RecordHeader from '@/components/RecordHeader.vue'
import UnknownRecord from '@/components/UnknownRecord.vue'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

const profile = { template: '<div />' }
const router = createRouter({
	history: createMemoryHistory(),
	routes: [
		{ path: '/', name: 'home', component: profile },
		{ path: '/profiles/:actor', name: 'profile', component: profile },
	],
})
let copiedText = ''

describe('RecordHeader', () => {
	beforeEach(async () => {
		await router.push('/')
		copiedText = ''
		Object.defineProperty(navigator, 'clipboard', {
			configurable: true,
			value: { write: vi.fn().mockResolvedValue(undefined) },
		})
		Object.defineProperty(document, 'execCommand', {
			configurable: true,
			value: vi.fn(() => {
				copiedText = document.querySelector('textarea')?.value ?? ''
				return true
			}),
		})
	})
	afterEach(() => vi.unstubAllGlobals())

	test('copies the full identifier and exposes only canonical Tangled links', async () => {
		const uri = 'at://did:plc:abc/sh.tangled.repo.issue/3m.test'
		const wrapper = mount(RecordHeader, {
			global: { plugins: [router] },
			props: {
				uri,
				collection: 'sh.tangled.repo.issue',
				author: 'did:plc:abc',
				canonicalUrl: 'https://tangled.org/owner/repo/issues/3m.test',
			},
		})

		await wrapper.get('button').trigger('click')
		await flushPromises()
		expect(copiedText).toBe(uri)
		expect(wrapper.get('button').text()).toContain('Copied')
		expect(wrapper.get('.record-header__canonical').attributes()).toMatchObject({
			href: 'https://tangled.org/owner/repo/issues/3m.test',
			rel: 'noopener noreferrer',
			target: '_blank',
		})
	})

	test('does not render a non-Tangled canonical URL', () => {
		const wrapper = mount(RecordHeader, {
			global: { plugins: [router] },
			props: {
				uri: 'at://did:plc:abc/example.record/key',
				collection: 'example.record',
				canonicalUrl: 'https://example.com/phishing',
			},
		})

		expect(wrapper.find('.record-header__canonical').exists()).toBe(false)
	})
})

describe('UnknownRecord', () => {
	test('keeps unknown validated values inspectable as text', () => {
		const wrapper = mount(UnknownRecord, {
			global: { plugins: [router] },
			props: {
				uri: 'at://did:plc:abc/example.record/key',
				collection: 'example.record',
				value: { content: '<img src=x onerror=alert(1)>', count: 2 },
			},
		})

		expect(wrapper.get('pre').text()).toContain('<img src=x onerror=alert(1)>')
		expect(wrapper.find('pre img').exists()).toBe(false)
	})
})
