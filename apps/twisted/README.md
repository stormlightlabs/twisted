# Twisted App

Ionic Vue client for Twisted — a Tangled browser and search app for Android & iOS.

## Requirements

- Node.js 20+
- pnpm
- The Twister API running locally

## Running locally

```sh
# From the repo root, install dependencies
pnpm install

# Copy env file and point it at your local Twister API
cp apps/twisted/.env.example apps/twisted/.env

# Start the Vite dev server
cd apps/twisted
pnpm dev
```

The dev server runs at `http://localhost:5173` by default.

## Environment variables

| Variable                    | Default                 | Description                                                                                                     |
| --------------------------- | ----------------------- | --------------------------------------------------------------------------------------------------------------- |
| `VITE_TWISTER_API_BASE_URL` | `http://localhost:8080` | Base URL of the Twister API. All app requests (AT Protocol, Jetstream, Constellation) are proxied through this. |

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
