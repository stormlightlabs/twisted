import { BobbinError } from '@/api'
import CoverageNotice from '@/components/CoverageNotice.vue'
import RequestState from '@/components/RequestState.vue'
import { mount } from '@vue/test-utils'
import { describe, expect, test } from 'vitest'

describe('RequestState', () => {
	test.each([
		['invalid-request', 'Check this request'],
		['not-found', 'Record not found'],
		['rate-limited', 'Too many requests'],
		['upstream-unavailable', 'Part of Tangled is unavailable'],
		['service-unavailable', 'Tangled is unavailable'],
		['offline', 'You are offline'],
		['malformed-response', 'This content could not be displayed'],
	] as const)('renders %s as a distinct state', (kind, title) => {
		const wrapper = mount(RequestState, { props: { error: new BobbinError(kind, 'Test') } })

		expect(wrapper.get('strong').text()).toBe(title)
	})

	test('keeps refresh failures compact when content is still present', () => {
		const wrapper = mount(RequestState, { props: { error: new BobbinError('network', 'Test'), hasContent: true } })

		expect(wrapper.classes()).toContain('request-state--inline')
		expect(wrapper.get('strong').text()).toBe('Could not refresh')
	})

	test('disables retry for the Retry-After period', () => {
		const wrapper = mount(RequestState, { props: { error: new BobbinError('rate-limited', 'Test'), retryInMs: 2_400 } })

		expect(wrapper.get('button').attributes('disabled')).toBeDefined()
		expect(wrapper.get('button').text()).toBe('Retry in 3s')
	})
})

describe('CoverageNotice', () => {
	test('explains incomplete coverage without replacing available results', () => {
		const wrapper = mount({
			components: { CoverageNotice },
			template: `
				<div>
					<p id="results">Indexed result</p>
					<coverage-notice :coverage="{ ready: false, eventsProcessed: 10, lastCursor: 20 }" />
				</div>
			`,
		})

		expect(wrapper.get('#results').text()).toBe('Indexed result')
		expect(wrapper.text()).toContain('Some recent results may be missing')
	})

	test('stays hidden when indexing is ready', () => {
		const wrapper = mount(CoverageNotice, { props: { coverage: { ready: true, eventsProcessed: 10, lastCursor: 20 } } })

		expect(wrapper.html()).toBe('<!--v-if-->')
	})
})
