CREATE TABLE IF NOT EXISTS documents (
    id            TEXT PRIMARY KEY,
    did           TEXT NOT NULL,
    collection    TEXT NOT NULL,
    rkey          TEXT NOT NULL,
    at_uri        TEXT NOT NULL,
    cid           TEXT NOT NULL,
    record_type   TEXT NOT NULL,
    title         TEXT,
    body          TEXT,
    summary       TEXT,
    repo_did      TEXT,
    repo_name     TEXT,
    author_handle TEXT,
    tags_json     TEXT,
    language      TEXT,
    created_at    TEXT,
    updated_at    TEXT,
    indexed_at    TEXT NOT NULL,
    deleted_at    TEXT
);

CREATE INDEX IF NOT EXISTS idx_documents_did ON documents(did);

CREATE INDEX IF NOT EXISTS idx_documents_collection ON documents(collection);

CREATE INDEX IF NOT EXISTS idx_documents_record_type ON documents(record_type);

CREATE INDEX IF NOT EXISTS idx_documents_repo_did ON documents(repo_did);

CREATE INDEX IF NOT EXISTS idx_documents_created_at ON documents(created_at);

CREATE INDEX IF NOT EXISTS idx_documents_deleted_at ON documents(deleted_at);

CREATE TABLE IF NOT EXISTS sync_state (
    consumer_name   TEXT PRIMARY KEY,
    cursor          TEXT NOT NULL,
    high_water_mark TEXT,
    updated_at      TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS document_embeddings (
    document_id     TEXT PRIMARY KEY REFERENCES documents(id),
    embedding       F32_BLOB(768),
    embedding_model TEXT NOT NULL,
    embedded_at     TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_embeddings_vec ON document_embeddings(
    libsql_vector_idx(embedding, 'metric=cosine')
);

CREATE TABLE IF NOT EXISTS embedding_jobs (
    document_id  TEXT PRIMARY KEY REFERENCES documents(id),
    status       TEXT NOT NULL,
    attempts     INTEGER NOT NULL DEFAULT 0,
    last_error   TEXT,
    scheduled_at TEXT NOT NULL,
    updated_at   TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_embedding_jobs_status ON embedding_jobs(status);

CREATE TABLE IF NOT EXISTS record_state (
    subject_uri TEXT PRIMARY KEY,
    state       TEXT NOT NULL,
    updated_at  TEXT NOT NULL
);
