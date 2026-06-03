CREATE TABLE maintenance_notes (
    id         TEXT PRIMARY KEY NOT NULL,
    record_id  TEXT NOT NULL REFERENCES maintenance_records (id) ON DELETE CASCADE,
    author_id  TEXT REFERENCES users (id),
    note       TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE INDEX idx_notes_record ON maintenance_notes (record_id);
