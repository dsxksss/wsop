CREATE TABLE customer_files (
    id          TEXT PRIMARY KEY NOT NULL,
    customer_id TEXT NOT NULL REFERENCES customers (id) ON DELETE CASCADE,
    folder_path TEXT NOT NULL DEFAULT '/',
    filename    TEXT NOT NULL,
    size_bytes  INTEGER NOT NULL,
    mime_type   TEXT,
    storage_key TEXT NOT NULL,
    uploaded_by TEXT REFERENCES users (id),
    created_at  TEXT NOT NULL
);

CREATE INDEX idx_files_customer ON customer_files (customer_id, folder_path);
