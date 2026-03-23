---
title: "Phase 3 — Hybrid Search"
updated: 2026-03-22
---

# Phase 3 — Hybrid Search

Merge lexical and semantic search into the default high-quality retrieval mode.

---

## M10 — Hybrid Search

refs: [specs/05-search.md](../specs/05-search.md)

### Deliverables

- `GET /search/hybrid` endpoint
- Weighted score blending (keyword 0.65 + semantic 0.35)
- Score normalization
- Result deduplication
- `matched_by` metadata showing which modes contributed

### Tasks

- [ ] Implement hybrid search orchestrator:
  1. Fetch top N keyword results (N=50 or configurable)
  2. Fetch top N semantic results
  3. Normalize keyword scores (min-max within result set)
  4. Semantic scores already normalized (0–1)
  5. Merge on `document_id`
  6. For documents in both sets: `hybrid_score = 0.65 * keyword + 0.35 * semantic`
  7. For documents in one set: use available score (other = 0)
  8. Sort by hybrid_score descending
  9. Deduplicate
  10. Apply limit/offset
- [ ] Populate `matched_by` field: `["keyword"]`, `["semantic"]`, or `["keyword", "semantic"]`
- [ ] Make weights configurable via `HYBRID_KEYWORD_WEIGHT` / `HYBRID_SEMANTIC_WEIGHT`
- [ ] Wire `/search/hybrid` handler
- [ ] Make `/search?mode=hybrid` work

### Verification

- [ ] Hybrid returns documents found by either source
- [ ] Duplicates are merged correctly (no duplicate IDs in results)
- [ ] Exact-match queries still favor lexical relevance
- [ ] Exploratory natural-language queries improve over keyword-only results
- [ ] Score ordering is stable across repeated runs on the same corpus
- [ ] `matched_by` accurately reflects which modes produced each result

### Exit Criteria

Hybrid search becomes the preferred default search mode.
