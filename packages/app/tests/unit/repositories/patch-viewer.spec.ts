import PatchViewer from '@/features/repositories/PatchViewer.vue'
import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, test, vi } from 'vitest'

const pierre = vi.hoisted(() => ({ cleanUp: vi.fn(), render: vi.fn() }))

vi.mock('@pierre/diffs', () => ({
	parsePatchFiles: vi.fn(() => [{ files: [{ name: 'README.md' }] }]),
	FileDiff: class {
		cleanUp = pierre.cleanUp
		render = pierre.render.mockImplementation(({ fileContainer }) => {
			fileContainer.textContent = 'Rendered README.md patch'
		})
	},
}))

describe('PatchViewer', () => {
	test('renders parsed patch files through Pierre and cleans up its renderer', async () => {
		const wrapper = mount(PatchViewer, {
			props: { patch: 'diff --git a/README.md b/README.md\n--- a/README.md\n+++ b/README.md' },
		})
		await flushPromises()

		expect(wrapper.text()).toContain('Rendered README.md patch')
		expect(pierre.render).toHaveBeenCalledOnce()
		wrapper.unmount()
		expect(pierre.cleanUp).toHaveBeenCalledOnce()
	})
})
