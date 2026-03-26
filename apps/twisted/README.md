# Twisted App

Ionic Vue client for Twisted — a Tangled browser and search app for Android & iOS.

## Requirements

- Node.js 20+
- pnpm
- The Twister API running locally if you want local API overrides

## Running locally

```sh
# From the repo root, install dependencies
pnpm install

# Local overrides live in .env.local
cp apps/twisted/.env.example apps/twisted/.env.local

# Start the Vite dev server
cd apps/twisted
pnpm dev
```

The dev server runs at `http://localhost:5173` by default.

## Environment variables

Committed `.env` defaults point at production:

- `VITE_TWISTER_API_BASE_URL=https://twister.stormlightlabs.org`
- `VITE_OAUTH_CLIENT_ID=https://twister.stormlightlabs.org/oauth/client-metadata.json`
- `VITE_OAUTH_REDIRECT_URI=https://twister.stormlightlabs.org/oauth-callback`

Use `.env.local` for local overrides:

| Variable                    | Local example                                      | Description                                                                                                     |
| --------------------------- | -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `VITE_TWISTER_API_BASE_URL` | `http://localhost:8080`                            | Base URL of the Twister API. All app requests (AT Protocol, Jetstream, Constellation) are proxied through this. |
| `VITE_OAUTH_CLIENT_ID`      | `http://127.0.0.1:8080/oauth/client-metadata.json` | Public OAuth metadata URL for local dev auth flows.                                                             |
| `VITE_OAUTH_REDIRECT_URI`   | `http://127.0.0.1:5173/oauth-callback`             | Redirect URI used by the local Vite app during OAuth testing.                                                   |

Production builds hide auth entry points for now. Dev builds keep OAuth enabled.

> All upstream requests — knot XRPC, PDS records, handle resolution, DID documents,
> Constellation backlink counts, and the Jetstream activity stream — are routed
> through the Twister API. The app makes no direct calls to external services.

## Building for mobile

```sh
# Build the web assets
pnpm build

# Sync to native projects
pnpm cap sync

# Open in Xcode / Android Studio
pnpm cap open ios
pnpm cap open android
```
