#!/bin/sh

set -eu

builder_name=twisted-bobbin
compose_file=infra/bobbin/compose.yaml
bobbin_env_file=${BOBBIN_ENV_FILE:-infra/bobbin/.env.example}

if ! docker buildx inspect "$builder_name" >/dev/null 2>&1; then
	docker buildx create \
		--name "$builder_name" \
		--driver docker-container \
		--bootstrap >/dev/null
fi

docker compose \
	--env-file "$bobbin_env_file" \
	-f "$compose_file" \
	build --builder "$builder_name" bobbin
