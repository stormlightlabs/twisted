# Self-hosted Bobbin

This directory runs a private Bobbin instance from Tangled core commit
`25d3c23eacc81ec27e50ace3eaf608aa13e5d89f` to keep builds repeatable while Bobbin's unpublished contracts are still changing.

Bobbin keeps its indexes in memory. It rebuilds them from Hydrant after every
restart and uses Slingshot for identity resolution and individual record
lookups. Tangled does not currently offer public Hydrant or Slingshot instances,
so you must supply both service URLs.

Build Bobbin with its isolated BuildKit builder:

```sh
bun run infra:bobbin:build
```

The finished image remains available to Docker. Remove the builder and its
Rust compilation cache after the build:

```sh
bun run infra:bobbin:clean
```

This command removes only the `twisted-bobbin` builder but does not prune
images, containers, volumes, or another project's build cache.

Copy `.env.example` to `.env`, review the upstream URLs, then start the
previously built image:

```sh
docker compose --env-file infra/bobbin/.env \
  -f infra/bobbin/compose.yaml up --no-build -d
```

Set `BOBBIN_ENV_FILE` when the build should validate Compose with a different
environment file. The default is `.env.example`; its upstream URLs are not
contacted during the image build.

The Caddy gateway exposes `http://localhost:8090` by default and adds the CORS
headers required by the web app. Set that address in Twisted's API service
setting for local development. Put the gateway behind HTTPS before exposing it
outside the host.

Check ingestion progress with:

```sh
curl http://localhost:8090/xrpc/sh.tangled.bobbin.getCoverage
```

`ready: false` means Bobbin is still replaying Hydrant events. Lists, counts,
and search can be incomplete during that period, although single-record lookups
can already work through Slingshot.

## Stop and restart

Stop both Bobbin and its Caddy gateway without removing either container:

```sh
docker compose --env-file infra/bobbin/.env \
  -f infra/bobbin/compose.yaml stop
```

Start the stopped containers again:

```sh
docker compose --env-file infra/bobbin/.env \
  -f infra/bobbin/compose.yaml start
```

Use `restart` when the environment file has not changed. Docker does not reload
environment variables during a restart. After changing `.env`, recreate Bobbin
while leaving the built image intact:

```sh
docker compose --env-file infra/bobbin/.env \
  -f infra/bobbin/compose.yaml up --no-build -d --force-recreate bobbin
```

The example configuration uses the public Microcosm Slingshot service. The
KLBR Hydrant origin currently returns `404` for the `/stream` path required by
this pinned Bobbin build, so indexed lists, counts, and search remain incomplete
until that endpoint becomes compatible or another Hydrant is configured.

To adopt a newer Bobbin release, update the commit in `compose.yaml`, review
`bobbin/example.toml` and `bobbin/crates/xrpc/src/lib.rs` at that commit, then
run the app's unit and smoke suites before deploying it.
