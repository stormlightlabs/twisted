const repo = 'at://did:plc:xg2vq45muivyy3xwatcehspu/sh.tangled.repo/e2e'
const actor = 'did:plc:xg2vq45muivyy3xwatcehspu'

describe('Complete read-only journeys', () => {
	beforeEach(() => {
		cy.clearLocalStorage()
	})

	it('keeps every primary route family usable at 320 CSS pixels without live Bobbin requests', () => {
		cy.viewport(320, 640)
		cy.intercept('GET', '**/xrpc/**', {
			statusCode: 503,
			body: { error: 'UpstreamUnavailable', message: 'Deterministic browser-test failure' },
		}).as('bobbinFailure')

		const routes = [
			'/search?q=twisted',
			`/profiles/${encodeURIComponent(actor)}`,
			`/profiles/${encodeURIComponent(actor)}/activity/comments`,
			`/profiles/${encodeURIComponent(actor)}/relationships/follows`,
			`/repositories/${encodeURIComponent(repo)}`,
			`/repositories/${encodeURIComponent(repo)}/source?ref=main`,
			`/repositories/${encodeURIComponent(repo)}/issues`,
			`/repositories/${encodeURIComponent(repo)}/pulls`,
			`/repositories/${encodeURIComponent(repo)}/pipelines`,
			'/strings?scope=did%3Aplc%3Atest',
			'/infrastructure',
			'/settings',
		]

		for (const route of routes) {
			cy.visit(route)
			cy.get('#page-content').should('exist')
			cy.get('.mobile-tabs').should('be.visible')
			cy.document().then((document) => {
				expect(document.documentElement.scrollWidth, route).to.be.at.most(document.documentElement.clientWidth)
				for (const element of document.querySelectorAll('#page-content > *, #page-content fieldset')) {
					expect(element.getBoundingClientRect().right, `${route}: ${element.tagName}`).to.be.at.most(
						document.documentElement.clientWidth,
					)
				}
			})
		}
	})

	it('identifies invalid embedded records without depending on Bobbin', () => {
		cy.interceptBobbin('sh.tangled.bobbin.getCoverage', 'xrpc/coverage.json')
		cy.interceptBobbin('sh.tangled.search.query', 'xrpc/invalid-search.json')
		cy.visit('/search?q=broken')
		cy.contains('This content could not be displayed').should('be.visible')
		cy.contains('The response was incomplete or in an unexpected format.').should('be.visible')
	})

	it('labels the offline shell and keeps navigation available', () => {
		cy.viewport(390, 844)
		cy.visit('/home', {
			onBeforeLoad(window) {
				Object.defineProperty(window.navigator, 'onLine', { configurable: true, get: () => false })
			},
		})
		cy.contains('[role="alert"]', 'You’re offline').should('be.visible')
		cy.contains('live Tangled data needs an internet connection').should('be.visible')
		cy.get('.mobile-tabs').contains('Search').click()
		cy.location('pathname').should('equal', '/search')
	})

	it('supports keyboard focus, skip navigation, reduced motion, and 200% text sizing', () => {
		cy.viewport(640, 720)
		cy.visit('/settings', {
			onBeforeLoad(window) {
				Object.defineProperty(window, 'matchMedia', {
					configurable: true,
					value: (query: string) => ({
						matches: query.includes('prefers-reduced-motion'),
						media: query,
						onchange: null,
						addEventListener: () => undefined,
						removeEventListener: () => undefined,
						addListener: () => undefined,
						removeListener: () => undefined,
						dispatchEvent: () => false,
					}),
				})
			},
		})
		cy.get('.skip-link').focus().should('be.visible').and('have.text', 'Skip to content')
		cy.get('html').invoke('attr', 'style', 'font-size: 200%')
		cy.get('input[name="theme"]').first().focus()
		cy.focused().should('have.attr', 'name', 'theme')
		cy.get('.theme-grid label').first().should('have.css', 'outline-style', 'solid')
		cy.document().then((document) => {
			expect(document.documentElement.scrollWidth).to.be.at.most(document.documentElement.clientWidth)
			for (const element of document.querySelectorAll('#page-content > *, #page-content fieldset')) {
				expect(element.getBoundingClientRect().right).to.be.at.most(document.documentElement.clientWidth)
			}
		})
	})

	it('exposes install metadata and zoom-safe viewport settings', () => {
		cy.visit('/')
		cy.get('link[rel="manifest"]').should('have.attr', 'href', '/manifest.webmanifest')
		cy.get('link[rel="apple-touch-icon"]').should('have.attr', 'href', '/icons/apple-touch-icon.png')
		cy.get('meta[name="viewport"]')
			.should('have.attr', 'content')
			.and('not.contain', 'user-scalable=no')
			.and('not.contain', 'maximum-scale')
		cy.request('/manifest.webmanifest')
			.its('body')
			.should('include', {
				display: 'standalone',
				id: '/',
				name: 'Twisted — Tightly knit social coding',
				short_name: 'Twisted',
			})
	})
})
