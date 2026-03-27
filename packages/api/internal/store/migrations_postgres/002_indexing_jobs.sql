CREATE TABLE IF NOT EXISTS indexing_jobs (
    document_id      TEXT PRIMARY KEY,
    did              TEXT NOT NULL,
    collection       TEXT NOT NULL,
    rkey             TEXT NOT NULL,
    cid              TEXT NOT NULL,
    record_json      TEXT NOT NULL,
    source           TEXT NOT NULL DEFAULT 'read_through',
    status           TEXT NOT NULL,
    attempts         INTEGER NOT NULL DEFAULT 0,
    last_error       TEXT,
    scheduled_at     TEXT NOT NULL,
    updated_at       TEXT NOT NULL,
    lease_owner      TEXT DEFAULT '',
    lease_expires_at TEXT DEFAULT '',
    completed_at     TEXT DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_indexing_jobs_status_scheduled
    ON indexing_jobs(status, scheduled_at, updated_at);

CREATE INDEX IF NOT EXISTS idx_indexing_jobs_claim
    ON indexing_jobs(status, scheduled_at, lease_expires_at, updated_at);
