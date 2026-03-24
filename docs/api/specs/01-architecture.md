---
title: "Spec 01 — Architecture"
updated: 2026-03-22
---

## 1. Purpose

Build a Go-based search service for Tangled content on AT Protocol that:

- ingests Tangled records through **Tap** (already deployed on Railway)
- denormalizes them into internal search documents
- indexes them in **Turso/libSQL**
- exposes a search API with **keyword**, **semantic**, and **hybrid** retrieval modes
- exposes index-backed summary APIs for data the public Tangled APIs do not answer efficiently, such as followers

## 2. Functional Goals

The system shall:

- index Tangled-specific ATProto collections under the `sh.tangled.*` namespace
- support initial backfill and continuous incremental sync via Tap
- support lexical retrieval using Turso's Tantivy-backed FTS
- support semantic retrieval using vector embeddings
- support hybrid ranking combining lexical and semantic signals
- expose stable HTTP APIs for search, document lookup, and graph/profile summaries
- support deployment on **Railway**

## 3. Non-Functional Goals

The system shall prioritize:

- **correctness of sync** — cursors never advance ahead of committed data
- **operational simplicity** — single binary, subcommand-driven
- **incremental delivery** — keyword search ships before embeddings
- **small deployable services** — process groups, not microservices
- **reindexability** — any document or collection can be re-normalized and re-indexed
- **low coupling** — sync, indexing, and serving are independent concerns

## 4. Out of Scope (v1)

- code-aware symbol search
- sourcegraph-style structural search
- personalized ranking
- access control beyond public/private visibility flags in indexed records
- full analytics pipeline
- custom ANN infrastructure outside Turso/libSQL

## 5. Design Principles

1. **Tap owns synchronization correctness.** The application does not consume the raw firehose. Tap handles connection, cryptographic verification, backfill, and filtering.

2. **The indexer owns denormalization.** Raw ATProto records are never queried directly by the public API.

3. **The public API serves denormalized projections.** Search ranking and graph summaries depend on the indexed document model, not transport.

4. **Keyword search is the baseline.** Semantic and hybrid search are layered on top.

5. **Embeddings are asynchronous.** Ingestion is never blocked on vector generation unless explicitly configured.

6. **Twister complements public Tangled APIs.** Repo detail stays on knots/PDSes; the index adds discovery and cross-network summaries.

## 6. External Systems

- **AT Protocol network** — source of all Tangled content
- **Tap** — filtered event delivery from the AT Protocol firehose (deployed on Railway)
- **Turso/libSQL** — relational storage, Tantivy-backed FTS, and native vector search
- **Ollama** — local embedding model server (nomic-embed-text or EmbeddingGemma); deployed as a Railway sidecar service
- **Railway** — deployment platform for Twister services, Tap, and Ollama

## 7. Architecture Summary

```text
ATProto Firehose / PDS
        │
        ▼
   Tap (Railway)
        │ WebSocket / webhook JSON events
        ▼
  Go Indexer Service
   ├─ decode Tap events
   ├─ normalize records → documents
   ├─ upsert documents
   ├─ schedule embeddings
   └─ persist sync cursor
        │
        ▼
    Turso/libSQL
   ├─ documents table
   ├─ document_embeddings table
   ├─ FTS index (Tantivy-backed)
   ├─ vector index (DiskANN)
   └─ sync_state table
        │
        ▼
   Go Search API
   ├─ keyword search (fts_match / fts_score)
   ├─ semantic search (vector_top_k)
   ├─ hybrid search (weighted merge)
   ├─ profile and graph summaries
   └─ document fetch
```

## 8. Runtime Units

| Unit           | Role                                         | Deployment                 |
| -------------- | -------------------------------------------- | -------------------------- |
| `api`          | HTTP search, graph summary, and document API | Railway service (public)   |
| `indexer`      | Tap consumer, normalizer, DB writer          | Railway service (internal) |
| `embed-worker` | Async embedding generation via Ollama        | Optional Railway service   |
| `ollama`       | Local embedding model server                 | Railway service (internal) |
| `tap`          | ATProto sync                                 | Railway (already deployed) |

## 9. Repository Structure

```text
main.go

internal/
  api/          # HTTP handlers, middleware, routes
  config/       # Config struct, env parsing
  embed/        # Embedding provider abstraction, worker
  index/        # FTS and vector index management
  ingest/       # Tap event consumer, ingestion loop
  normalize/    # Per-collection record → document adapters
  observability/# Structured logging, metrics
  ranking/      # Score normalization, hybrid merge
  search/       # Search orchestration (keyword, semantic, hybrid)
  store/        # DB access layer, migrations, domain types
  tapclient/    # Tap WebSocket/webhook client
```

## 10. Binary Subcommands

```bash
twister api           # Start HTTP search API
twister indexer       # Start Tap consumer / indexer
twister embed-worker  # Start async embedding worker
twister reindex       # Re-normalize and upsert documents
twister reembed       # Re-generate embeddings
twister backfill      # Bootstrap index from seed users
twister healthcheck   # One-shot health probe
```

## 11. Technology Choices

### Embedding: Ollama (self-hosted)

Embeddings are generated locally via Ollama rather than an external API service. This eliminates per-token costs, external service dependencies, and data egress concerns.

**Recommended models (in order of preference):**

| Model | Parameters | Dimensions | Quantized Size | Notes |
|-------|-----------|------------|----------------|-------|
| nomic-embed-text-v1.5 | 137M | 768 (Matryoshka: 64–768) | ~262 MB (F16) | 8192 context, battle-tested, Railway template exists |
| EmbeddingGemma | 308M | 768 | <200 MB (quantized) | Best-in-class MTEB for size, released Sept 2025 |
| all-minilm | 23M | 384 | ~46 MB | Budget option, lower quality |

**Go integration:** Use the official Ollama Go client (`github.com/ollama/ollama/api`) with the `Embed()` method. The embed-worker calls Ollama over Railway's internal network (`ollama.railway.internal:11434`).

**Railway deployment:** Ollama runs as a separate Railway service (~1–2 GB RAM, 1–2 vCPU, ~$10–30/mo). The nomic-embed Railway template provides a proven starting point. No cold starts on always-on services; model loads in 2–10 seconds on first request after deploy.

### Language: Go

Go is the implementation language for the API server, indexer, embedding worker, and CLI commands. Rationale: straightforward long-running services, excellent HTTP support, good concurrency model, small container footprint.

### Sync Layer: Tap

Tap is the only supported sync source in v1. It handles firehose connection, cryptographic verification, backfill, and filtering, then delivers simple JSON events via WebSocket or webhook.

**Tap is already deployed on Railway.** Twister connects to it as a WebSocket client.

#### Tap Capabilities

- Validates repo structure, MST integrity, and identity signatures
- Automatic backfill fetches full repo history from PDS when repos are added
- Filtered output by DID list, collection, or full network mode
- Ordering guarantees: historical events (`live: false`) delivered before live events (`live: true`)

#### Tap Delivery Modes

| Mode                       | Config                  | Behavior                                          |
| -------------------------- | ----------------------- | ------------------------------------------------- |
| WebSocket + acks (default) | —                       | Client acks each event; no data loss              |
| Fire-and-forget            | `TAP_DISABLE_ACKS=true` | Events marked acked on receipt; simpler but lossy |
| Webhook                    | `TAP_WEBHOOK_URL=...`   | Events POSTed as JSON; acked on HTTP 200          |

#### Tap API Endpoints (reference)

| Endpoint              | Method | Purpose                               |
| --------------------- | ------ | ------------------------------------- |
| `/health`             | GET    | Health check                          |
| `/channel`            | WS     | WebSocket event stream                |
| `/repos/add`          | POST   | Add DIDs to track                     |
| `/repos/remove`       | POST   | Stop tracking a repo                  |
| `/info/:did`          | GET    | Repo state, rev, record count, errors |
| `/stats/repo-count`   | GET    | Total tracked repos                   |
| `/stats/record-count` | GET    | Total tracked records                 |
| `/stats/cursors`      | GET    | Firehose and list repos cursors       |

#### Key Tap Configuration

| Variable                 | Default | Purpose                                                                            |
| ------------------------ | ------- | ---------------------------------------------------------------------------------- |
| `TAP_SIGNAL_COLLECTION`  | —       | Auto-track repos with records in this collection                                   |
| `TAP_COLLECTION_FILTERS` | —       | Comma-separated collection filters (e.g., `sh.tangled.repo,sh.tangled.repo.issue`) |
| `TAP_ADMIN_PASSWORD`     | —       | Basic auth for API access                                                          |
| `TAP_DISABLE_ACKS`       | `false` | Fire-and-forget mode                                                               |
| `TAP_WEBHOOK_URL`        | —       | Webhook delivery URL                                                               |

### Storage and Search: Turso/libSQL

Turso/libSQL is used for relational metadata storage, Tantivy-backed full-text search, and native vector search.

#### Go SDK Options

| Package                                            | CGo | Embedded Replicas | Remote |
| -------------------------------------------------- | --- | ----------------- | ------ |
| `github.com/tursodatabase/go-libsql`               | Yes | Yes               | Yes    |
| `github.com/tursodatabase/libsql-client-go/libsql` | No  | No                | Yes    |

Both register as `database/sql` drivers under `"libsql"`. They cannot be imported in the same binary.

**Recommendation:** Use `libsql-client-go` (pure Go, remote-only) unless embedded replicas are needed for local read performance.

#### Connection Patterns

```go
// Remote only (pure Go, no CGo)
import _ "github.com/tursodatabase/libsql-client-go/libsql"
db, err := sql.Open("libsql", "libsql://your-db.turso.io?authToken=TOKEN")

// Embedded replica (CGo required)
import "github.com/tursodatabase/go-libsql"
connector, err := libsql.NewEmbeddedReplicaConnector(
    "local.db", "libsql://your-db.turso.io",
    libsql.WithAuthToken("TOKEN"),
    libsql.WithSyncInterval(time.Minute),
)
db := sql.OpenDB(connector)
```

#### Full-Text Search (Tantivy-backed)

Turso FTS is **not** standard SQLite FTS5. It uses Tantivy under the hood.

```sql
-- Create FTS index with per-column tokenizers and weights
CREATE INDEX idx_docs_fts ON documents USING fts (
    title WITH tokenizer=default,
    body WITH tokenizer=default,
    summary WITH tokenizer=default,
    repo_name WITH tokenizer=simple,
    author_handle WITH tokenizer=raw
) WITH (weights='title=3.0,repo_name=2.5,author_handle=2.0,summary=1.5,body=1.0');

-- Filter by match
SELECT id, title FROM documents
WHERE fts_match(title, body, summary, repo_name, author_handle, 'search query');

-- BM25 scoring
SELECT id, title, fts_score(title, body, summary, repo_name, author_handle, 'search query') AS score
FROM documents
ORDER BY score DESC;

-- Highlighting
SELECT fts_highlight(title, '<b>', '</b>', 'search query') AS highlighted
FROM documents;
```

**Available tokenizers:** `default` (Unicode-aware), `raw` (exact match), `simple` (whitespace+punctuation), `whitespace`, `ngram` (2-3 char n-grams).

**Query syntax (Tantivy):** `database AND search`, `database NOT nosql`, `"exact phrase"`, `data*` (prefix), `title:database` (field-specific), `title:database^2` (boosting).

**Limitations:** No snippet function (use highlighting). No automatic segment merging (manual `OPTIMIZE INDEX` required).
No read-your-writes within a transaction. No MATCH operator (use `fts_match()` function).

#### Vector Search

```sql
-- Vector column type
embedding F32_BLOB(768)

-- Insert
INSERT INTO document_embeddings (document_id, embedding, ...)
VALUES (?, vector32(?), ...);  -- ? is JSON array '[0.1, 0.2, ...]'

-- Brute-force similarity search
SELECT d.id, vector_distance_cos(e.embedding, vector32(?)) AS distance
FROM documents d
JOIN document_embeddings e ON d.id = e.document_id
ORDER BY distance ASC LIMIT 20;

-- Create ANN index (DiskANN)
CREATE INDEX idx_embeddings ON document_embeddings(
    libsql_vector_idx(embedding, 'metric=cosine')
);

-- ANN search via index
SELECT d.id, d.title
FROM vector_top_k('idx_embeddings', vector32(?), 20) AS v
JOIN document_embeddings e ON e.rowid = v.id
JOIN documents d ON d.id = e.document_id;
```

**Vector types:** `F32_BLOB` (recommended), `F16_BLOB`, `F64_BLOB`, `F8_BLOB`, `F1BIT_BLOB`.

**Distance functions:** `vector_distance_cos` (cosine), `vector_distance_l2` (Euclidean).

**Max dimensions:** 65,536. Dimension is fixed at table creation.

### Deployment: Railway

Railway is the deployment platform. It supports health checks, autodeploy, per-service scaling, and internal networking. Tap is already deployed here. Twister deploys as separate Railway services (api, indexer, embed-worker) within the same project.
