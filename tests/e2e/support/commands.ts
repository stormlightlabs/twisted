declare global {
	// Cypress exposes custom commands by augmenting its global namespace.
	// eslint-disable-next-line @typescript-eslint/no-namespace
	namespace Cypress {
		interface Chainable {
			/** Intercepts one read-only Bobbin XRPC query with a deterministic fixture. */
			interceptBobbin(nsid: string, fixture: string): Chainable<null>
		}
	}
}

Cypress.Commands.add('interceptBobbin', (nsid: string, fixture: string) => {
	cy.intercept('GET', `**/xrpc/${nsid}*`, { fixture }).as(nsid)
})

export {}
