import vue from '@vitejs/plugin-vue'
import path from 'node:path'
import { defineConfig } from 'vitest/config'

/** Shared Vite application and Vitest unit-test configuration. */
const config = defineConfig({
	plugins: [vue()],
	resolve: { alias: { '@': path.resolve(__dirname, './src') } },
	build: { target: 'esnext' },
	server: { headers: { 'Cross-Origin-Embedder-Policy': 'require-corp', 'Cross-Origin-Opener-Policy': 'same-origin' } },
	preview: { headers: { 'Cross-Origin-Embedder-Policy': 'require-corp', 'Cross-Origin-Opener-Policy': 'same-origin' } },
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
