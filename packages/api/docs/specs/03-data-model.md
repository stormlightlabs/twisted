---
title: "Spec 03 — Data Model"
updated: 2026-03-22
---

## 1. Search Document

A **search document** is the internal denormalized representation used for retrieval. It is derived from one or more ATProto records via normalization.

### Stable Identifier

```sh
id = did + "|" + collection + "|" + rkey
```

Example: `did:plc:abc123|sh.tangled.repo|3kb3fge5lm32x`

### Required Fields

| Field           | Type    | Description                                                                |
| --------------- | ------- | -------------------------------------------------------------------------- |
| `id`            | TEXT PK | Stable composite identifier                                                |
| `did`           | TEXT    | Author DID                                                                 |
| `collection`    | TEXT    | ATProto collection NSID                                                    |
| `rkey`          | TEXT    | Record key (TID)                                                           |
| `at_uri`        | TEXT    | Full AT-URI                                                                |
| `cid`           | TEXT    | Content identifier (hash)                                                  |
| `record_type`   | TEXT    | Normalized type label (e.g., `repo`, `issue`, `pull`, `string`, `profile`) |
| `title`         | TEXT    | Normalized title                                                           |
| `body`          | TEXT    | Normalized body text                                                       |
| `summary`       | TEXT    | Short summary / description                                                |
| `repo_did`      | TEXT    | DID of the repo owner (resolved from at-uri for issues/PRs)                |
| `repo_name`     | TEXT    | Repository name (resolved)                                                 |
| `author_handle` | TEXT    | Author handle (resolved via identity)                                      |
| `tags_json`     | TEXT    | JSON array of tags/topics                                                  |
| `language`      | TEXT    | Detected or declared language                                              |
| `created_at`    | TEXT    | Record creation timestamp (ISO 8601)                                       |
| `updated_at`    | TEXT    | Last record update timestamp                                               |
| `indexed_at`    | TEXT    | When this document was last indexed                                        |
| `deleted_at`    | TEXT    | Soft-delete timestamp (tombstone)                                          |

### Derived Fields (not stored in documents table)

| Field            | Location                               | Description                    |
| ---------------- | -------------------------------------- | ------------------------------ |
| Embedding vector | `document_embeddings` table            | F32_BLOB(N)                    |
| FTS index        | Turso FTS index                        | Tantivy-backed full-text index |
| Star count       | Aggregated from `sh.tangled.feed.star` | Ranking signal                 |

## 2. Core Documents Table

```sql
CREATE TABLE documents (
    id          TEXT PRIMARY KEY,
    did         TEXT NOT NULL,
    collection  TEXT NOT NULL,
    rkey        TEXT NOT NULL,
    at_uri      TEXT NOT NULL,
    cid         TEXT NOT NULL,
    record_type TEXT NOT NULL,
    title       TEXT,
    body        TEXT,
    summary     TEXT,
    repo_did    TEXT,
    repo_name   TEXT,
    author_handle TEXT,
    tags_json   TEXT,
    language    TEXT,
    created_at  TEXT,
    updated_at  TEXT,
    indexed_at  TEXT NOT NULL,
    deleted_at  TEXT
);

CREATE INDEX idx_documents_did ON documents(did);
CREATE INDEX idx_documents_collection ON documents(collection);
CREATE INDEX idx_documents_record_type ON documents(record_type);
CREATE INDEX idx_documents_repo_did ON documents(repo_did);
CREATE INDEX idx_documents_created_at ON documents(created_at);
CREATE INDEX idx_documents_deleted_at ON documents(deleted_at);
```

## 3. FTS Index

```sql
CREATE INDEX idx_documents_fts ON documents USING fts (
    title WITH tokenizer=default,
    body WITH tokenizer=default,
    summary WITH tokenizer=default,
    repo_name WITH tokenizer=simple,
    author_handle WITH tokenizer=raw,
    tags_json WITH tokenizer=simple
) WITH (weights='title=3.0,repo_name=2.5,author_handle=2.0,summary=1.5,tags_json=1.2,body=1.0');
```

## 4. Embeddings Table

```sql
CREATE TABLE document_embeddings (
    document_id     TEXT PRIMARY KEY REFERENCES documents(id),
    embedding       F32_BLOB(768),
    embedding_model TEXT NOT NULL,
    embedded_at     TEXT NOT NULL
);

CREATE INDEX idx_embeddings_vec ON document_embeddings(
    libsql_vector_idx(embedding, 'metric=cosine')
);
```

The vector dimension (768) is configurable by model. Changing models requires a new column or table migration.

## 5. Sync State Table

```sql
CREATE TABLE sync_state (
    consumer_name   TEXT PRIMARY KEY,
    cursor          TEXT NOT NULL,
    high_water_mark TEXT,
    updated_at      TEXT NOT NULL
);
```

Stores the Tap event ID that has been successfully committed. On restart, the indexer resumes from this cursor.

## 6. Embedding Jobs Table

```sql
CREATE TABLE embedding_jobs (
    document_id  TEXT PRIMARY KEY REFERENCES documents(id),
    status       TEXT NOT NULL,  -- 'pending', 'processing', 'completed', 'failed'
    attempts     INTEGER NOT NULL DEFAULT 0,
    last_error   TEXT,
    scheduled_at TEXT NOT NULL,
    updated_at   TEXT NOT NULL
);

CREATE INDEX idx_embedding_jobs_status ON embedding_jobs(status);
```

## 7. Issue/PR State Cache (optional)

To support filtering search results by issue state or PR status without joining back to the raw records:

```sql
CREATE TABLE record_state (
    subject_uri TEXT PRIMARY KEY,  -- at-uri of the issue or PR
    state       TEXT NOT NULL,     -- 'open', 'closed', 'merged'
    updated_at  TEXT NOT NULL
);
```

Updated when `sh.tangled.repo.issue.state` or `sh.tangled.repo.pull.status` events are ingested.
