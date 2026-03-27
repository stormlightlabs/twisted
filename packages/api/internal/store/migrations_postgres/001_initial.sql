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
    web_url       TEXT DEFAULT '',
    deleted_at    TEXT,
    search_vector TSVECTOR GENERATED ALWAYS AS (
        setweight(to_tsvector('simple', COALESCE(title, '')), 'A') ||
        setweight(to_tsvector('simple', COALESCE(author_handle, '')), 'A') ||
        setweight(to_tsvector('simple', COALESCE(repo_name, '')), 'B') ||
        setweight(to_tsvector('simple', COALESCE(summary, '')), 'B') ||
        setweight(to_tsvector('simple', COALESCE(body, '')), 'C') ||
        setweight(to_tsvector('simple', COALESCE(tags_json, '')), 'D')
    ) STORED
);

CREATE INDEX IF NOT EXISTS idx_documents_did ON documents(did);
CREATE INDEX IF NOT EXISTS idx_documents_collection ON documents(collection);
CREATE INDEX IF NOT EXISTS idx_documents_record_type ON documents(record_type);
CREATE INDEX IF NOT EXISTS idx_documents_repo_did ON documents(repo_did);
CREATE INDEX IF NOT EXISTS idx_documents_created_at ON documents(created_at);
CREATE INDEX IF NOT EXISTS idx_documents_deleted_at ON documents(deleted_at);
CREATE INDEX IF NOT EXISTS idx_documents_search_vector ON documents USING GIN(search_vector);

CREATE TABLE IF NOT EXISTS sync_state (
    consumer_name   TEXT PRIMARY KEY,
    cursor          TEXT NOT NULL,
    high_water_mark TEXT,
    updated_at      TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS identity_handles (
    did        TEXT PRIMARY KEY,
    handle     TEXT NOT NULL,
    is_active  BOOLEAN NOT NULL DEFAULT TRUE,
    status     TEXT,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_identity_handles_handle ON identity_handles(handle);

CREATE TABLE IF NOT EXISTS record_state (
    subject_uri TEXT PRIMARY KEY,
    state       TEXT NOT NULL,
    updated_at  TEXT NOT NULL
);
