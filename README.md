# Twisted

Twisted is a Tangled client for browsing public projects, profiles, and conversations.
It is built with Ionic Vue and is intended to run as a website, installable PWA, and Capacitor app for Android and iOS.

## Repository layout

- `packages/app` contains the Ionic Vue application.
- `infra/bobbin` contains the pinned Docker Compose setup for a private Bobbin
  instance.
- `docs` contains the product and API contracts.

Root Bun scripts delegate to `packages/app`, so development commands stay the
same after the monorepo migration.

## Development

Install [Bun 1.3.14](https://bun.sh), then install the locked dependencies:

```sh
bun install --frozen-lockfile
```

Start the development server:

```sh
bun run dev
```

Run the local checks before submitting changes:

```sh
bun run format:check
bun run lint
bun run test:unit --run
bun run build
```

Use `bun run format` to apply Prettier formatting.

## Private Bobbin

See [`infra/bobbin/README.md`](infra/bobbin/README.md) for the Docker setup and
its Hydrant and Slingshot requirements. The app can use its local Caddy gateway
at `http://localhost:8090`; non-local API services must use HTTPS.

## Tests

### Browser

Start the development server at `http://localhost:5173`, then run Cypress in a
second terminal:

```sh
bun run test:e2e
```

### Live API

The smoke suite requires [Hurl 8.0.1](https://hurl.dev) and calls the public
Bobbin service:

```sh
bun run test:smoke
```
