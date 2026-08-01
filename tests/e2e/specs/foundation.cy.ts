describe('Twisted foundation', () => {
	beforeEach(() => {
		cy.clearLocalStorage()
	})

	it('loads the app and intercepts a Bobbin XRPC query', () => {
		cy.interceptBobbin('sh.tangled.bobbin.getCoverage', 'xrpc/coverage.json')
		cy.visit('/')
		cy.contains('h1', 'See where the work leads.')

		cy.window().then(async (window) => {
			const response = await window.fetch('/xrpc/sh.tangled.bobbin.getCoverage')
			expect(await response.json()).to.deep.equal({ ready: true, eventsProcessed: 100, lastCursor: 120 })
		})
		cy.wait('@sh.tangled.bobbin.getCoverage')
	})

	it('loads the self-hosted variable typefaces', () => {
		cy.visit('/')
		cy.document().then(async (document) => {
			await document.fonts.ready
			expect(document.fonts.check('16px "Commissioner Variable"')).to.equal(true)
			expect(document.fonts.check('16px "Azeret Mono Variable"')).to.equal(true)
		})
		cy.get('h1').should('have.css', 'font-family').and('contain', 'Commissioner Variable')
		cy.get('.public-trail__number').first().should('have.css', 'font-family').and('contain', 'Azeret Mono Variable')
	})

	it('persists theme and service settings independently', () => {
		cy.visit('/settings')
		cy.contains('label', 'Catppuccin Latte').click()
		cy.get('html').should('have.attr', 'data-theme', 'catppuccin-latte')
		cy.get('#service-url').clear().type('https://bobbin.example.com/')
		cy.contains('button', 'Save data source').click()
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
		cy.visit('/repositories/not%20valid')
		cy.get('.mobile-tabs').should('be.visible')
		cy.get('.mobile-tabs a').should('have.length', 4)
		cy.get('ion-menu-button').should('be.visible')
		cy.contains('h2', 'This identifier is not supported')
		cy.contains('a', 'Return home').should('be.visible').click()
		cy.contains('h1', 'See where the work leads.')
		cy.get('.public-trail').should('exist')
		cy.get('.home-page').then(($page) => {
			expect($page[0].scrollWidth).to.be.at.most($page[0].clientWidth)
		})
		cy.get('.mobile-tabs').contains('Search').click()
		cy.location('pathname').should('equal', '/search')
		cy.get('.mobile-tabs a[aria-current="page"]').should('contain.text', 'Search')
	})

	it('aligns the persistent desktop menu with the routed content', () => {
		cy.viewport(1440, 900)
		cy.visit('/')
		cy.get('ion-menu').then(($menu) => {
			cy.get('#main-content').then(($content) => {
				const menuRight = $menu[0].getBoundingClientRect().right
				const contentLeft = $content[0].getBoundingClientRect().left
				expect(Math.abs(menuRight - contentLeft)).to.be.lessThan(2)
			})
		})
		cy.get('.mobile-tabs').should('not.be.visible')
		cy.get('.public-trail').should('be.visible')
		cy.document().then((document) => {
			expect(document.documentElement.scrollWidth).to.be.at.most(document.documentElement.clientWidth)
		})
	})

	it('offers recovery links for unknown deep links', () => {
		cy.visit('/not/a/twisted/domain', { failOnStatusCode: false })
		cy.contains('h1', 'This thread ends here.')
		cy.contains('a', 'Search Tangled').should('have.attr', 'href', '/search')
	})
})
