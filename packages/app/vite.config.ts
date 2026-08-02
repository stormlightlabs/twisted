import vue from '@vitejs/plugin-vue'
import path from 'node:path'
import { defineConfig } from 'vitest/config'
import { VitePWA } from 'vite-plugin-pwa'

/** Shared Vite application and Vitest unit-test configuration. */
const config = defineConfig({
	plugins: [
		vue(),
		VitePWA({
			injectRegister: false,
			manifest: false,
			registerType: 'prompt',
			workbox: {
				cleanupOutdatedCaches: true,
				clientsClaim: false,
				globPatterns: [
					'index.html',
					'manifest.webmanifest',
					'favicon.png',
					'icons/*.png',
					'assets/index-*.{css,js}',
					'assets/*-normal-*.woff2',
				],
				maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
				navigateFallback: 'index.html',
				navigateFallbackDenylist: [/^\/xrpc\//],
				runtimeCaching: [
					{ urlPattern: ({ url }) => url.pathname.startsWith('/xrpc/'), handler: 'NetworkOnly', method: 'GET' },
					{
						urlPattern: ({ request, sameOrigin }) =>
							sameOrigin && ['font', 'image', 'script', 'style'].includes(request.destination),
						handler: 'CacheFirst',
						method: 'GET',
						options: {
							cacheName: 'twisted-application-assets',
							expiration: { maxAgeSeconds: 30 * 24 * 60 * 60, maxEntries: 160, purgeOnQuotaError: true },
						},
					},
				],
				skipWaiting: false,
			},
		}),
	],
	resolve: { alias: { '@': path.resolve(__dirname, './src') } },
	optimizeDeps: { exclude: ['satteri', '@bruits/satteri-wasm32-wasi'] },
	build: { target: 'esnext' },
	server: { headers: { 'Cross-Origin-Embedder-Policy': 'require-corp', 'Cross-Origin-Opener-Policy': 'same-origin' } },
	preview: { headers: { 'Cross-Origin-Embedder-Policy': 'require-corp', 'Cross-Origin-Opener-Policy': 'same-origin' } },
	test: {
		watch: false,
		clearMocks: true,
		globals: true,
		environment: 'jsdom',
		include: ['tests/unit/**/*.spec.ts'],
		restoreMocks: true,
		setupFiles: ['./tests/unit/setup.ts'],
	},
})

export default config
