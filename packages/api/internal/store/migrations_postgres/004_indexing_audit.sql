CREATE TABLE IF NOT EXISTS indexing_audit (
    id          BIGSERIAL PRIMARY KEY,
    source      TEXT NOT NULL,
    document_id TEXT NOT NULL,
    collection  TEXT NOT NULL,
    cid         TEXT NOT NULL,
    decision    TEXT NOT NULL,
    attempt     INTEGER NOT NULL DEFAULT 0,
    error       TEXT,
    created_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_indexing_audit_created
    ON indexing_audit(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_indexing_audit_document
    ON indexing_audit(document_id, created_at DESC);
