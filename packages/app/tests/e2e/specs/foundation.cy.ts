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
			expect(document.fonts.check('16px "Instrument Sans Variable"')).to.equal(true)
		})
		cy.get('h1').should('have.css', 'font-family').and('contain', 'Instrument Sans Variable')
		cy.get('.public-trail__number').first().should('have.css', 'font-family').and('contain', 'Azeret Mono Variable')
	})

	it('persists theme and service settings independently', () => {
		cy.visit('/settings')
		cy.contains('label', 'Catppuccin Latte').click()
		cy.get('html').should('have.attr', 'data-theme', 'catppuccin-latte')
		cy.get('#service-url').clear().type('https://bobbin.example.com/')
		cy.contains('button', 'Save Bobbin').click()
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
		cy.contains('strong', 'Check this request')
		cy.get('.mobile-tabs').contains('Home').click()
		cy.location('pathname').should('equal', '/home')
		cy.contains('h1', 'Pick up where you left off.')
		cy.get('.mobile-tabs').should('be.visible')
		cy.get('.mobile-tabs').contains('Search').click()
		cy.location('pathname').should('equal', '/search')
		cy.get('.mobile-tabs a[aria-current="page"]').should('contain.text', 'Search')
	})

	it('uses the full desktop width on landing and restores the app menu after entry', () => {
		cy.viewport(1440, 900)
		cy.visit('/')
		cy.get('ion-menu').should('not.exist')
		cy.get('#main-content').then(($content) => {
			expect($content[0].getBoundingClientRect().left).to.be.lessThan(2)
		})
		cy.get('.public-trail').should('be.visible')
		cy.get('.mobile-tabs').should('not.exist')
		cy.contains('a', 'a repository').click()
		cy.location('pathname').should('equal', '/repositories')
		cy.get('ion-menu').then(($menu) => {
			cy.get('#main-content').then(($content) => {
				const menuRight = $menu[0].getBoundingClientRect().right
				const contentLeft = $content[0].getBoundingClientRect().left
				expect(Math.abs(menuRight - contentLeft)).to.be.lessThan(2)
			})
		})
		cy.get('.mobile-tabs').should('not.be.visible')
		cy.document().then((document) => {
			expect(document.documentElement.scrollWidth).to.be.at.most(document.documentElement.clientWidth)
		})
	})

	it('offers recovery links for unknown deep links', () => {
		cy.visit('/not/a/twisted/domain', { failOnStatusCode: false })
		cy.contains('h1', 'This thread ends here.')
		cy.contains('a', 'Search Tangled').should('have.attr', 'href', '/search')
	})

	it('keeps a repository useful through rate limits and empty list cursors', () => {
		const repo = 'at://did:plc:xg2vq45muivyy3xwatcehspu/sh.tangled.repo/e2e-recovery'
		let languageAttempts = 0
		cy.intercept('GET', '**/xrpc/sh.tangled.repo.getRepo*', {
			body: {
				uri: repo,
				cid: 'bafyreicrfpnvmlnd7x5nvfsytxpehmpirnzx7u6kzwxebtdkd5npjxbsmy',
				value: {
					$type: 'sh.tangled.repo',
					createdAt: '2026-05-08T04:35:08Z',
					knot: 'knot1.tangled.sh',
					name: 'tempest',
					repoDid: 'did:plc:35u5warrxshfvhnjsurjprn6',
				},
			},
		})
		cy.intercept('GET', '**/xrpc/sh.tangled.repo.languages*', (request) => {
			languageAttempts += 1
			request.reply(
				languageAttempts === 1
					? { statusCode: 429, headers: { 'retry-after': '0' }, body: { error: 'RateLimitExceeded' } }
					: { body: { ref: 'HEAD', languages: [] } },
			)
		})
		cy.intercept('GET', '**/xrpc/sh.tangled.repo.tree*', { body: { ref: 'HEAD', files: [] } })
		cy.intercept('GET', '**/xrpc/sh.tangled.feed.countStars*', { body: { count: 0, distinctAuthors: 0 } })
		cy.intercept('GET', '**/xrpc/sh.tangled.repo.countIssues*', { body: { count: 0, distinctAuthors: 0 } })
		cy.intercept('GET', '**/xrpc/sh.tangled.repo.countPulls*', { body: { count: 0, distinctAuthors: 0 } })
		cy.intercept('GET', '**/xrpc/sh.tangled.repo.listCollaborators*', { body: { items: [], cursor: null } })
		cy.intercept('GET', '**/xrpc/sh.tangled.label.listDefinitions*', { body: { items: [], cursor: null } })
		cy.intercept('GET', '**/xrpc/sh.tangled.git.listRefUpdates*', { body: { items: [], cursor: null } })

		cy.visit(`/repositories/${encodeURIComponent(repo)}`)
		cy.contains('h1', 'tempest', { timeout: 10_000 }).should('be.visible')
		cy.contains('No language summary is available for the current source.', { timeout: 10_000 }).should('exist')
		cy.contains('No public collaborators are listed.').should('exist')
		cy.get('.request-state').then(($states) => {
			const malformedPanels = [...$states]
				.filter((state) => state.textContent?.includes('This content could not be displayed'))
				.map((state) => state.closest('section')?.querySelector('h2')?.textContent?.trim() ?? 'Repository totals')
			expect(malformedPanels).to.deep.equal([])
		})
		cy.contains('Too many requests').should('not.exist')
		cy.then(() => expect(languageAttempts).to.equal(2))
	})
})
