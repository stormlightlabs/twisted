CREATE TABLE IF NOT EXISTS indexing_jobs (
    document_id  TEXT PRIMARY KEY,
    did          TEXT NOT NULL,
    collection   TEXT NOT NULL,
    rkey         TEXT NOT NULL,
    cid          TEXT NOT NULL,
    record_json  TEXT NOT NULL,
    status       TEXT NOT NULL,
    attempts     INTEGER NOT NULL DEFAULT 0,
    last_error   TEXT,
    scheduled_at TEXT NOT NULL,
    updated_at   TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_indexing_jobs_status_scheduled
    ON indexing_jobs(status, scheduled_at, updated_at);
