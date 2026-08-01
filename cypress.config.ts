import { defineConfig } from 'cypress'

/** Browser-test paths and the local Vite server used by Cypress. */
const config = defineConfig({
	e2e: {
		fixturesFolder: 'tests/e2e/fixtures',
		supportFile: 'tests/e2e/support/e2e.{js,jsx,ts,tsx}',
		specPattern: 'tests/e2e/specs/**/*.cy.{js,jsx,ts,tsx}',
		videosFolder: 'tests/e2e/videos',
		screenshotsFolder: 'tests/e2e/screenshots',
		baseUrl: 'http://localhost:5173',
	},
})

export default config
