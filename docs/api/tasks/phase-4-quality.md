---
title: "Phase 4 — Ranking and Quality Polish"
updated: 2026-03-22
---

# Phase 4 — Ranking and Quality Polish

Improve search quality without changing the core architecture.

## M11 — Ranking and Quality Polish

refs: [specs/05-search.md](../specs/05-search.md)

### Deliverables

- Boosted field weighting refinement
- Recency boost
- Collection-aware ranking
- Better snippets/highlights
- Issue/PR state filtering
- Star count as ranking signal
- Optional query analytics

### Tasks

- [ ] Tune FTS index weights based on real query results
- [ ] Add small recency boost to ranking (e.g., decay function on `created_at`)
- [ ] Add collection-aware ranking adjustments (repos ranked differently from comments)
- [ ] Index `sh.tangled.repo.issue.comment` and `sh.tangled.repo.pull.comment` (P2 collections)
- [ ] Aggregate `sh.tangled.feed.star` counts per repo and use as ranking signal
- [ ] Implement `state` filter (open/closed/merged) using `record_state` table
- [ ] Improve snippets: better truncation, multi-field highlights
- [ ] Add curated relevance test fixtures (expected queries → expected top results)
- [ ] Run `OPTIMIZE INDEX idx_documents_fts` as maintenance task
- [ ] Optional: log queries for analytics (anonymized)

### Verification

- [ ] Exact repo lookups reliably rank the repo first
- [ ] Recent active content gets a reasonable small boost without overwhelming exact relevance
- [ ] Snippets show useful matched context
- [ ] Ranking regression tests catch obvious degradations
- [ ] State filter correctly excludes closed/merged items when requested

### Exit Criteria

Search quality is noticeably improved and more predictable.
