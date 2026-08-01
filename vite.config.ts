import legacy from '@vitejs/plugin-legacy'
import vue from '@vitejs/plugin-vue'
import path from 'node:path'
import { defineConfig } from 'vitest/config'

/** Shared Vite application and Vitest unit-test configuration. */
const config = defineConfig({
	plugins: [vue(), legacy()],
	resolve: { alias: { '@': path.resolve(__dirname, './src') } },
	test: {
		clearMocks: true,
		globals: true,
		environment: 'jsdom',
		include: ['tests/unit/**/*.spec.ts'],
		restoreMocks: true,
		setupFiles: ['./tests/unit/setup.ts'],
	},
})

export default config
