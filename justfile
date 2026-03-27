set shell := ["/bin/zsh", "-cu"]

default:
    @just --list

dev:
    pnpm --dir apps/twisted dev

build:
    pnpm --dir apps/twisted build
    just --justfile packages/api/justfile build

lint:
    pnpm --dir apps/twisted lint

check:
    pnpm --dir apps/twisted check

test:
    pnpm --dir apps/twisted test:unit
    just --justfile packages/api/justfile test

app-build:
    pnpm --dir apps/twisted build

app-preview:
    pnpm --dir apps/twisted preview

app-test-unit:
    pnpm --dir apps/twisted test:unit

app-test-e2e:
    pnpm --dir apps/twisted test:e2e

app-cap-ios:
    pnpm --dir apps/twisted exec cap run ios

app-cap-android:
    pnpm --dir apps/twisted exec cap run android

api-build:
    just --justfile packages/api/justfile build

# Run API. Usage: just api-dev [mode], mode: local|remote|sqlite (default local)
api-dev mode="local":
    just --justfile packages/api/justfile run-api {{mode}}

# Run indexer. Usage: just api-run-indexer [mode], mode: local|remote|sqlite (default local)
api-run-indexer mode="local":
    just --justfile packages/api/justfile run-indexer {{mode}}

db-up:
    docker compose -f docker-compose.dev.yaml up -d postgres tap

db-down:
    docker compose -f docker-compose.dev.yaml down

db-psql:
    psql "postgresql://localhost/${USER:-postgres}_dev?sslmode=disable"

api-test:
    just --justfile packages/api/justfile test

api-clean:
    just --justfile packages/api/justfile clean
