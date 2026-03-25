# Twister API Smoke Checks

Python smoke checks for Twister API endpoints, managed with uv.

## Usage

From the repo root:

```sh
# Run all
uv run --project packages/scripts/api twister-api-smoke
# Run specific checks (healthz | readyz | search | documents | indexing | activity)
uv run --project packages/scripts/api twister-api-smoke --check healthz
```

## Options

- `--verbose` for detailed output of API responses (JSON)
- `--base-url` (or env `TWISTER_API_BASE_URL`, default `http://localhost:8080`)
- `--query` for search check (default `twisted`)
- `--document-id` for documents check
- `--actor-handle` for indexing check (default `desertthunder.dev`)
- `--repo-at-uri` for repo fixture indexing/search checks
- `--profile-at-uri` for profile fixture indexing/search checks
