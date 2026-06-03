-- Drop the old 1-to-1 wemol info table
DROP TABLE IF EXISTS customer_wemol_info;

-- Add Wemol Info columns directly to deployments table
ALTER TABLE deployments ADD COLUMN approval_no TEXT;
ALTER TABLE deployments ADD COLUMN submitted_at TEXT;
ALTER TABLE deployments ADD COLUMN department TEXT;
ALTER TABLE deployments ADD COLUMN purpose TEXT;
ALTER TABLE deployments ADD COLUMN concurrency_limit INTEGER;
ALTER TABLE deployments ADD COLUMN user_count INTEGER;
ALTER TABLE deployments ADD COLUMN license_expiry TEXT;
ALTER TABLE deployments ADD COLUMN module_count INTEGER;
ALTER TABLE deployments ADD COLUMN modules TEXT;

-- Drop and recreate remote connections table for 1-to-many relationship
DROP TABLE IF EXISTS customer_remote_connections;

CREATE TABLE customer_remote_connections (
    id              TEXT PRIMARY KEY NOT NULL,
    customer_id     TEXT NOT NULL REFERENCES customers (id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    wemol_username  TEXT,
    wemol_password  TEXT,
    connection_info TEXT,
    created_at      TEXT NOT NULL,
    updated_at      TEXT NOT NULL
);

CREATE INDEX idx_remote_connections_customer ON customer_remote_connections (customer_id);
