import ActorDidTypeahead from '@/components/ActorDidTypeahead.vue'
import AppDatePicker from '@/components/AppDatePicker.vue'
import type { BobbinClient } from '@/lib/api'
import { BOBBIN_CLIENT_PROVIDER } from '@/lib/api'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, test, vi } from 'vitest'

describe('search filter controls', () => {
	afterEach(() => vi.useRealTimers())

	test('selects a date from the custom calendar', async () => {
		const wrapper = mount(AppDatePicker, { props: { id: 'from', label: 'From', modelValue: '2026-08-02' } })

		await wrapper.get('#from').trigger('click')
		const day = wrapper.findAll('.date-picker__days button').find((button) => button.text() === '3')
		expect(day).toBeDefined()
		await day!.trigger('click')

		expect(wrapper.emitted('update:modelValue')).toEqual([['2026-08-03']])
	})

	test('resolves an actor suggestion to its DID', async () => {
		vi.useFakeTimers()
		const searchActorsTypeahead = vi
			.fn()
			.mockResolvedValue([{ did: 'did:plc:person', handle: 'person.example', displayName: 'A Person' }])
		const client = { searchActorsTypeahead } as unknown as BobbinClient
		const wrapper = mount(ActorDidTypeahead, {
			props: { id: 'author', label: 'Author', modelValue: '' },
			global: { provide: { [BOBBIN_CLIENT_PROVIDER]: () => client } },
		})

		await wrapper.get('#author').trigger('focus')
		await wrapper.get('#author').setValue('person')
		await vi.advanceTimersByTimeAsync(225)
		await flushPromises()
		await wrapper.get('[role="option"] button').trigger('click')

		expect(searchActorsTypeahead).toHaveBeenCalledWith('person', expect.objectContaining({ signal: expect.anything() }))
		expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual(['did:plc:person'])
	})
})
