import DiscussionSection from '@/features/collaboration/DiscussionSection.vue'
import type { BobbinClient } from '@/lib/api'
import { BOBBIN_CLIENT_PROVIDER, BobbinError } from '@/lib/api'
import { IonicVue } from '@ionic/vue'
import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { describe, expect, test, vi } from 'vitest'

const subject = 'at://did:plc:author/sh.tangled.repo.issue/3mho6hukiei22'
const routes = [
	{ path: '/', component: { template: '<div />' } },
	{ path: '/profiles/:actor', name: 'profile', component: { template: '<div />' } },
]

function canonicalComment(author: string, rkey: string, text: string) {
	return {
		uri: `at://${author}/sh.tangled.feed.comment/${rkey}`,
		value: {
			$type: 'sh.tangled.feed.comment',
			body: { $type: 'sh.tangled.markup.markdown', text },
			createdAt: '2026-08-01T00:00:00.000Z',
			subject: { uri: subject, cid: 'bafyreicrfpnvmlnd7x5nvfsytxpehmpirnzx7u6kzwxebtdkd5npjxbsmy' },
		},
	}
}

describe('DiscussionSection', () => {
	test('sanitizes comments and keeps comment pagination independent from reaction failures', async () => {
		const listComments = vi
			.fn()
			.mockResolvedValueOnce({
				items: [canonicalComment('did:plc:first', '3mho6hukiei23', '**Safe** <img src=x onerror=alert(1)>')],
				cursor: 'comments-2',
			})
			.mockResolvedValueOnce({ items: [canonicalComment('did:plc:second', '3mho6hukiei24', 'Second page')] })
		const client = {
			listComments,
			listReactions: vi.fn().mockRejectedValue(new BobbinError('upstream-unavailable', 'reactions unavailable')),
			countComments: vi.fn().mockResolvedValue({ count: 2, distinctAuthors: 2 }),
			countReactions: vi.fn().mockResolvedValue({ count: 0, distinctAuthors: 0 }),
		} as unknown as BobbinClient
		const router = createRouter({ history: createMemoryHistory(), routes })
		await router.push('/')
		await router.isReady()
		const host = defineComponent({
			components: { DiscussionSection },
			template: '<discussion-section :subject="subject" />',
			setup: () => ({ subject }),
		})
		const wrapper = mount(host, {
			global: { plugins: [IonicVue, router], provide: { [BOBBIN_CLIENT_PROVIDER]: () => client } },
		})
		await flushPromises()

		expect(wrapper.text()).toContain('2 from 2 people')
		expect(wrapper.text()).toContain('Safe')
		expect(wrapper.text()).toContain('Part of Tangled is unavailable')
		expect(wrapper.find('.discussion-list img').exists()).toBe(false)

		const more = wrapper.findAll('button').find((button) => button.text() === 'Load more comments')
		expect(more).toBeDefined()
		await more!.trigger('click')
		await flushPromises()

		expect(listComments).toHaveBeenLastCalledWith(
			subject,
			expect.objectContaining({ cursor: 'comments-2', limit: 20, order: 'asc' }),
		)
		expect(wrapper.text()).toContain('Second page')
		expect(wrapper.text()).toContain('Part of Tangled is unavailable')
	})
})
