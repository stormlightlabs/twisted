---
title: "Phase 2 — Semantic Search"
updated: 2026-03-23
---

# Phase 2 — Semantic Search

Add embedding generation and vector-based retrieval on top of the keyword baseline, using self-hosted Ollama for embeddings instead of external API services.

## M8 — Ollama Sidecar and Embedding Pipeline

refs: [specs/01-architecture.md](../specs/01-architecture.md), [specs/03-data-model.md](../specs/03-data-model.md), [specs/05-search.md](../specs/05-search.md)

### Goal

Deploy Ollama as a Railway sidecar and add asynchronous embedding generation without blocking ingestion.

### Deliverables

- Ollama Railway service running nomic-embed-text-v1.5 (or EmbeddingGemma)
- `embedding_jobs` table operational (schema from M1)
- `embed-worker` subcommand
- Ollama-backed embedding provider (with interface for future alternatives)
- Retry and dead-letter behavior
- `twister reembed` command

### Tasks

- [ ] Deploy Ollama on Railway:
  - Use the nomic-embed Railway template as a starting point
  - Configure as internal service (no public URL)
  - Pre-pull `nomic-embed-text` model on startup
  - Health check: `GET /api/tags` on port 11434
  - Resource budget: 1–2 GB RAM, 1–2 vCPU
- [ ] Define embedding provider interface:

  ```go
  type EmbeddingProvider interface {
      Embed(ctx context.Context, texts []string) ([][]float32, error)
      Model() string
      Dimension() int
  }
  ```

- [ ] Implement Ollama provider using the official Go client:

  ```go
  import "github.com/ollama/ollama/api"

  // OllamaProvider calls Ollama's /api/embed endpoint
  // over Railway internal networking (ollama.railway.internal:11434)
  type OllamaProvider struct {
      client *api.Client
      model  string  // "nomic-embed-text"
      dim    int     // 768
  }
  ```

  - Configure via `OLLAMA_URL` env var (default: `http://ollama.railway.internal:11434`)
  - Support batch embedding (Ollama accepts multiple inputs per request)
  - Timeout per request (default: 30s)
  - Connection health check on startup
- [ ] Implement embedding input text composition (see spec 04-data-pipeline.md, section 5):
  `title\nrepo_name\nauthor_handle\ntags\nsummary\nbody`
- [ ] Add job enqueueing: on document upsert, insert `embedding_jobs` row with `status=pending`
- [ ] Implement `embed-worker` loop:
  1. Poll for `pending` jobs (batch by `EMBEDDING_BATCH_SIZE`, default: 32)
  2. Compose input text per document
  3. Call Ollama provider
  4. Store vectors in `document_embeddings` with `vector32(?)`
  5. Mark job `completed`
  6. On failure: increment `attempts`, set `last_error`, backoff
  7. After max attempts: mark `dead`
- [ ] Create DiskANN vector index (see spec 03 for tuning params):
  ```sql
  CREATE INDEX idx_embeddings_vec ON document_embeddings(
      libsql_vector_idx(embedding, 'metric=cosine')
  );
  ```
- [ ] Implement `reembed` command (re-generate all embeddings, useful for model migration)
- [ ] Skip deleted documents in embedding pipeline
- [ ] Add health check endpoint for embed-worker (port 9091)
- [ ] Add Ollama connectivity check to embed-worker readiness probe

### Model Selection Notes

**nomic-embed-text-v1.5** is the default recommendation:
- 137M parameters, 768-dimension vectors
- Matryoshka support (can truncate to 64/128/256/512 dims for storage tradeoff)
- 8192 token context window
- ~262 MB at F16 quantization, ~500 MB RAM at runtime
- Battle-tested with llama.cpp/Ollama, Railway template exists

**EmbeddingGemma** is the quality alternative:
- 308M parameters, 768-dimension vectors
- Best MTEB scores for models under 500M parameters
- <200 MB quantized, similar RAM footprint
- Released Sept 2025, less deployment track record

**all-minilm** is the budget fallback:
- 23M parameters, 384-dimension vectors (requires schema change)
- ~46 MB model, minimal resources
- Suitable for testing or cost-constrained environments

### Verification

- [ ] Ollama service starts on Railway and responds to health checks
- [ ] Creating a new searchable document enqueues an embedding job
- [ ] Worker processes the job and stores a vector in `document_embeddings`
- [ ] Failed embedding calls retry with bounded attempts
- [ ] Keyword search still works when embed-worker or Ollama is down
- [ ] `reembed` regenerates embeddings for all eligible documents
- [ ] Ollama connectivity failure is surfaced in embed-worker health check

### Exit Criteria

Embeddings are produced asynchronously via self-hosted Ollama and stored durably in Turso.

## M9 — Semantic Search

refs: [specs/05-search.md](../specs/05-search.md)

### Goal

Expose vector-based semantic retrieval.

### Deliverables

- `GET /search/semantic` endpoint
- Query-time embedding (convert query text → vector via Ollama)
- Vector similarity search via `vector_top_k`
- Response parity with keyword search

### Tasks

- [ ] Implement query embedding: call Ollama provider with user's query text
- [ ] Cache query embeddings for identical queries within a short TTL (optional, reduces Ollama load)
- [ ] Implement semantic search repository:

  ```sql
  SELECT d.id, d.title, d.summary, d.repo_name, d.author_handle,
         d.collection, d.record_type, d.created_at, d.updated_at
  FROM vector_top_k('idx_embeddings_vec', vector32(?), ?) AS v
  JOIN document_embeddings e ON e.rowid = v.id
  JOIN documents d ON d.id = e.document_id
  WHERE d.deleted_at IS NULL;
  ```

- [ ] Normalize distance to relevance score: `score = 1.0 - (distance / 2.0)`
- [ ] Apply same filters as keyword search (collection, author, repo, type)
- [ ] Add timeout and cost controls (limit vector search to reasonable K)
- [ ] Wire `/search/semantic` handler
- [ ] Return `matched_by: ["semantic"]` in results
- [ ] Graceful degradation: if Ollama is unreachable, return 503 for semantic search while keyword search remains available

### Verification

- [ ] Semantically similar queries retrieve expected documents even with little lexical overlap
- [ ] Documents without embeddings are omitted from semantic results
- [ ] Semantic search returns the same JSON schema as keyword search
- [ ] Latency is acceptable under small test load
- [ ] Filters work correctly with semantic results
- [ ] Semantic search degrades gracefully when Ollama is down

### Exit Criteria

The API supports true semantic search over Tangled documents, powered entirely by self-hosted infrastructure.
