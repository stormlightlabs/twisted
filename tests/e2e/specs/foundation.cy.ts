describe('Twisted foundation', () => {
	beforeEach(() => {
		cy.clearLocalStorage()
	})

	it('loads the app and intercepts a Bobbin XRPC query', () => {
		cy.interceptBobbin('sh.tangled.bobbin.getCoverage', 'xrpc/coverage.json')
		cy.visit('/')
		cy.contains('h1', 'Follow the thread.')

		cy.window().then(async (window) => {
			const response = await window.fetch('/xrpc/sh.tangled.bobbin.getCoverage')
			expect(await response.json()).to.deep.equal({ ready: true, eventsProcessed: 100, lastCursor: 120 })
		})
		cy.wait('@sh.tangled.bobbin.getCoverage')
	})

	it('persists theme and service settings independently', () => {
		cy.visit('/settings')
		cy.contains('label', 'Catppuccin Latte').click()
		cy.get('html').should('have.attr', 'data-theme', 'catppuccin-latte')
		cy.get('#service-url').clear().type('https://bobbin.example.com/')
		cy.contains('button', 'Save service').click()
		cy.reload()

		cy.get('html').should('have.attr', 'data-theme', 'catppuccin-latte')
		cy.get('#service-url').should('have.value', 'https://bobbin.example.com')
		cy.window().then((window) => {
			expect(window.localStorage.getItem('twisted.theme.v1')).to.contain('catppuccin-latte')
			expect(window.localStorage.getItem('twisted.bobbin-service.v1')).to.equal('https://bobbin.example.com')
		})
	})

	it('keeps recovery and navigation usable at a native-sized viewport', () => {
		cy.viewport(390, 844)
		cy.visit('/profiles/not%20valid')
		cy.contains('h2', 'This identifier is not supported')
		cy.contains('a', 'Return home').should('be.visible').click()
		cy.contains('h1', 'Follow the thread.')
	})

	it('offers recovery links for unknown deep links', () => {
		cy.visit('/not/a/twisted/domain', { failOnStatusCode: false })
		cy.contains('h1', 'This thread ends here.')
		cy.contains('a', 'Search Tangled').should('have.attr', 'href', '/search')
	})
})
