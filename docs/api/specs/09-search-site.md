---
title: "Spec 09 — Search Site"
updated: 2026-03-23
---

A minimal static site that serves as both the public Twister API documentation and a live search showcase. Dark mode only, no framework or build step.

## 1. Purpose

- Give developers a browsable reference for the Twister search API
- Give anyone a way to try search against live indexed Tangled content
- Provide a shareable public URL before the mobile app ships

## 2. Scope

In scope:

- Static HTML/CSS/JS (Alpine.js, no bundler)
- API reference pages generated from the spec docs
- Live search input wired to `GET /search`
- Result rendering with type-aware cards (repo, issue, PR, profile, string)
- Filter controls for collection, type, author, language, state
- Pagination
- Responsive layout (mobile-friendly, single breakpoint)

Out of scope:

- Auth, OAuth, or any write operations
- Semantic or hybrid mode toggle (keyword only for MVP)
- Server-side rendering or static-site generator
- Analytics or telemetry

## 3. Pages

| Route             | Content                                                                     |
| ----------------- | --------------------------------------------------------------------------- |
| `/`               | Search input + results (the homepage is the search page)                    |
| `/docs`           | API overview: base URL, auth (none for public), rate limits, response shape |
| `/docs/search`    | `GET /search` — parameters, filters, response contract, examples            |
| `/docs/documents` | `GET /documents/{id}` — request/response, examples                          |
| `/docs/health`    | `GET /healthz`, `GET /readyz` — purpose and expected responses              |

## 4. Search Page Behavior

1. Text input with a submit button. No debounce search-as-you-type for MVP.
2. On submit, fetch `GET {API_BASE}/search?q={query}&limit=20` (plus any active filters).
3. Render results as a vertical list of cards.
4. Each card shows: `record_type` badge, `title`, `body_snippet` (with `<mark>` highlights preserved), `author_handle`, `repo_name` (when present), `updated_at` relative time.
5. Clicking a result opens the canonical Tangled URL (`https://tangled.org/{handle}/{repo}` for repos, etc.) in a new tab.
6. "Load more" button appends the next page (`offset += limit`).
7. Empty state: "No results" message.
8. Error state: inline message if the API is unreachable.
9. Filter bar above results: dropdowns/inputs for `type`, `language`, `author`. Filters are query params so URLs are shareable.

## 5. API Docs Pages

Hand-written HTML mirroring the contracts in spec 05 (search) and spec 08 (app integration). Each page includes:

- Endpoint signature (method, path)
- Parameter table (name, type, default, description)
- Example request (curl)
- Example response (JSON block with syntax highlighting via `<pre><code>`)

No generated docs tooling. The pages are static and updated manually when the API changes.

## 6. Styling

Minimal CSS, no utility framework.

### Tokens

```css
:root {
  --bg: #0e0e0e;
  --surface: #1a1a1a;
  --border: #2a2a2a;
  --text: #e0e0e0;
  --text-dim: #888;
  --accent: #7aa2f7;
  --mark-bg: #7aa2f733;
  --mono: "Google Sans Mono", monospace;
  --sans: "Google Sans", sans-serif;
  --radius: 6px;
}
```

### Rules

- Dark theming.
- `Google Sans` for body text. `Google Sans Mono` for code, JSON, and badges.
- Fonts loaded via Google Fonts `<link>`. System fallbacks: `sans-serif`, `monospace`.
- Max content width: `720px`, centered.
- Cards: `var(--surface)` background, `var(--border)` border, `var(--radius)` corners.
- `<mark>` tags in snippets styled with `var(--mark-bg)` background and `var(--accent)` text.
- Code blocks: `var(--surface)` background, horizontal scroll, no wrapping.
- Links: `var(--accent)`, no underline, underline on hover.
- Inputs and buttons: `var(--surface)` background, `var(--border)` border, `var(--text)` text.
- One breakpoint at `640px` for mobile: full-width cards, stacked filter bar.

## 7. Package Design

The site lives in `internal/view/` as a self-contained Go package. It owns the templates, static assets, and HTTP handlers. The `api` package mounts `view.Handler()` into its router — nothing else leaks out.

### Exports

The package exposes a single constructor:

```go
// Handler returns an http.Handler that serves the site pages and static assets.
func Handler() http.Handler
```

The `api` package calls `view.Handler()` and mounts it as a fallback after API routes.

### Package Structure

```text
internal/view/
  view.go               # Handler(), route setup, embed directives
  templates/
    layout.html         # Shared shell (head, nav, footer)
    index.html          # Search page
    docs/
      index.html        # API overview
      search.html       # GET /search docs
      documents.html    # GET /documents/{id} docs
      health.html       # Health endpoints docs
  static/
    style.css           # All styles, single file
    search.js           # Search fetch, render, pagination, filters
```

### Embedding

`view.go` uses `//go:embed` to bundle `templates/` and `static/`. Templates are parsed once at init. Static assets are served under `/static/` via `http.FileServer`.

### Routing

`view.Handler()` returns a mux that handles:

| Pattern | Handler |
| --- | --- |
| `GET /` | Render `index.html` |
| `GET /docs` | Render `docs/index.html` |
| `GET /docs/search` | Render `docs/search.html` |
| `GET /docs/documents` | Render `docs/documents.html` |
| `GET /docs/health` | Render `docs/health.html` |
| `GET /static/*` | Serve embedded CSS/JS files |

## 9. Configuration

Since the site is served by the same origin as the API, search requests use relative paths (`/search?q=...`). No `API_BASE` config needed — the browser's origin is the API.

## 10. Local Development

Run `twister api` locally. The site is served at `http://localhost:8080/` alongside the API endpoints. No separate dev server or file server required.

The API docs pages render without any indexed data. The search page needs a running indexer and populated database to return results.

## 11. Constraints

- No dependencies besides Alpine via CDN.
- Total site weight target: under 50 KB excluding fonts.
- Works in modern browsers (last 2 versions of Chrome, Firefox, Safari).
- All fetch calls include error handling for network failures and non-200 responses.
- No CORS concerns — the site and API share an origin.
