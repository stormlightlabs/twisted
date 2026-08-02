#!/bin/sh

set -eu

builder_name=twisted-bobbin

if docker buildx inspect "$builder_name" >/dev/null 2>&1; then
	docker buildx rm "$builder_name"
else
	printf '%s\n' "Bobbin build cache is already clean."
fi
