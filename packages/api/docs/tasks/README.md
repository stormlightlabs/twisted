---
title: "Twister — Task Index"
updated: 2026-03-22
---

# Twister Tasks

Assumes Go, Tap (deployed on Railway), Turso/libSQL, and Railway for deployment.

## Delivery Strategy

Build in four phases:

1. **MVP** — ingestion, keyword search, deployment, operational tooling, graph backfill
2. **Semantic Search** — embeddings, vector retrieval
3. **Hybrid Search** — weighted merge of keyword + semantic
4. **Quality Polish** — ranking refinement, advanced filters, analytics

Ship keyword search before embeddings. That gives a testable, inspectable baseline before introducing model behavior.

## Phases

| Phase | Title | Document | Status |
| ----- | ----- | -------- | ------ |
| 1 | MVP | [phase-1-mvp.md](phase-1-mvp.md) | In progress (M0–M2 complete) |
| 2 | Semantic Search | [phase-2-semantic.md](phase-2-semantic.md) | Not started |
| 3 | Hybrid Search | [phase-3-hybrid.md](phase-3-hybrid.md) | Not started |
| 4 | Quality Polish | [phase-4-quality.md](phase-4-quality.md) | Not started |

## MVP Complete When

- Tap ingests tracked `sh.tangled.*` records
- Documents normalize into a stable store
- Keyword search works publicly
- API and indexer are deployed on Railway
- Restart does not lose sync position
- Reindex exists for repair
- Graph backfill populates initial content from seed users
