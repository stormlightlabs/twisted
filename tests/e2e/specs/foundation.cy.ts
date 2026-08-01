describe('Twisted foundation', () => {
	it('loads the app and intercepts a Bobbin XRPC query', () => {
		cy.interceptBobbin('sh.tangled.bobbin.getCoverage', 'xrpc/coverage.json')
		cy.visit('/')
		cy.contains('h1', 'Read Tangled from anywhere.')

		cy.window().then(async (window) => {
			const response = await window.fetch('/xrpc/sh.tangled.bobbin.getCoverage')
			expect(await response.json()).to.deep.equal({ ready: true, eventsProcessed: 100, lastCursor: 120 })
		})
		cy.wait('@sh.tangled.bobbin.getCoverage')
	})
})
