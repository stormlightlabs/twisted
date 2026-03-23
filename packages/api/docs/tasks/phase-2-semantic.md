---
title: "Phase 2 — Semantic Search"
updated: 2026-03-22
---

# Phase 2 — Semantic Search

Add embedding generation and vector-based retrieval on top of the keyword baseline.

---

## M8 — Embedding Pipeline

refs: [specs/03-data-model.md](../specs/03-data-model.md), [specs/05-search.md](../specs/05-search.md)

### Goal

Add asynchronous embedding generation without blocking ingestion.

### Why Now

Only after keyword search is stable should semantic complexity be added.

### Deliverables

- `embedding_jobs` table operational (schema from M1)
- `embed-worker` subcommand
- Embedding provider abstraction (OpenAI, Voyage, Ollama)
- Retry and dead-letter behavior
- `twister reembed` command

### Tasks

- [ ] Define embedding provider interface:

  ```go
  type EmbeddingProvider interface {
      Embed(ctx context.Context, texts []string) ([][]float32, error)
      Model() string
      Dimension() int
  }
  ```

- [ ] Implement OpenAI provider (or preferred provider)
- [ ] Implement embedding input text composition (see spec 04-data-pipeline.md, section 5):
  `title\nrepo_name\nauthor_handle\ntags\nsummary\nbody`
- [ ] Add job enqueueing: on document upsert, insert `embedding_jobs` row with `status=pending`
- [ ] Implement `embed-worker` loop:
  1. Poll for `pending` jobs (batch by `EMBEDDING_BATCH_SIZE`)
  2. Compose input text per document
  3. Call embedding provider
  4. Store vectors in `document_embeddings` with `vector32(?)`
  5. Mark job `completed`
  6. On failure: increment `attempts`, set `last_error`, backoff
  7. After max attempts: mark `dead`
- [ ] Create DiskANN vector index: `CREATE INDEX idx_embeddings_vec ON document_embeddings(libsql_vector_idx(embedding, 'metric=cosine'))`
- [ ] Implement `reembed` command (re-generate all embeddings, useful for model migration)
- [ ] Skip deleted documents in embedding pipeline
- [ ] Add health check endpoint for embed-worker (port 9091)

### Verification

- [ ] Creating a new searchable document enqueues an embedding job
- [ ] Worker processes the job and stores a vector in `document_embeddings`
- [ ] Failed embedding calls retry with bounded attempts
- [ ] Keyword search still works when embed-worker is down
- [ ] `reembed` regenerates embeddings for all eligible documents

### Exit Criteria

Embeddings are produced asynchronously and stored durably.

---

## M9 — Semantic Search

refs: [specs/05-search.md](../specs/05-search.md)

### Goal

Expose vector-based semantic retrieval.

### Why Now

Natural next step once embeddings exist. Turso/libSQL has native vector search with `vector_top_k`.

### Deliverables

- `GET /search/semantic` endpoint
- Query-time embedding (convert query text → vector)
- Vector similarity search via `vector_top_k`
- Response parity with keyword search

### Tasks

- [ ] Implement query embedding: call embedding provider with user's query text
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

### Verification

- [ ] Semantically similar queries retrieve expected documents even with little lexical overlap
- [ ] Documents without embeddings are omitted from semantic results
- [ ] Semantic search returns the same JSON schema as keyword search
- [ ] Latency is acceptable under small test load
- [ ] Filters work correctly with semantic results

### Exit Criteria

The API supports true semantic search over Tangled documents.
