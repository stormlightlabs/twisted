# Twisted

Twisted is a read-only client for public data on [Tangled](https://tangled.org).
It is built with Ionic Vue and is intended to run as a website, installable PWA, and Capacitor app for Android and iOS.

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
