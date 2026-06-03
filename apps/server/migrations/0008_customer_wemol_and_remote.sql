CREATE TABLE customer_wemol_info (
    customer_id        TEXT PRIMARY KEY NOT NULL REFERENCES customers (id) ON DELETE CASCADE,
    approval_no        TEXT,
    submitted_at       TEXT,
    department         TEXT,
    purpose            TEXT,
    concurrency_limit  INTEGER,
    user_count         INTEGER,
    license_expiry     TEXT,
    module_count       INTEGER,
    modules            TEXT,
    updated_at         TEXT NOT NULL
);

CREATE TABLE customer_remote_connections (
    customer_id     TEXT PRIMARY KEY NOT NULL REFERENCES customers (id) ON DELETE CASCADE,
    wemol_username  TEXT,
    wemol_password  TEXT,
    connection_info TEXT,
    updated_at      TEXT NOT NULL
);
