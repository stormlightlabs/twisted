CREATE TABLE IF NOT EXISTS jetstream_events (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    time_us     INTEGER NOT NULL,
    did         TEXT NOT NULL,
    kind        TEXT NOT NULL,
    collection  TEXT,
    rkey        TEXT,
    operation   TEXT,
    payload     TEXT NOT NULL,
    received_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_jetstream_events_time_us
    ON jetstream_events(time_us DESC);
