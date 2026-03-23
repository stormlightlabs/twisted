CREATE TABLE IF NOT EXISTS identity_handles (
    did        TEXT PRIMARY KEY,
    handle     TEXT NOT NULL,
    is_active  INTEGER NOT NULL DEFAULT 1,
    status     TEXT,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_identity_handles_handle ON identity_handles(handle);
