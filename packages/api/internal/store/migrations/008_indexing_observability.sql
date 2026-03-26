ALTER TABLE indexing_jobs
    ADD COLUMN source TEXT NOT NULL DEFAULT 'read_through';

ALTER TABLE indexing_jobs
    ADD COLUMN lease_owner TEXT DEFAULT '';

ALTER TABLE indexing_jobs
    ADD COLUMN lease_expires_at TEXT DEFAULT '';

ALTER TABLE indexing_jobs
    ADD COLUMN completed_at TEXT DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_indexing_jobs_claim
    ON indexing_jobs(status, scheduled_at, lease_expires_at, updated_at);

CREATE TABLE IF NOT EXISTS indexing_audit (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
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
