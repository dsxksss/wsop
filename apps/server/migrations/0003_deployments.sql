CREATE TABLE deployments (
    id           TEXT PRIMARY KEY NOT NULL,
    customer_id  TEXT NOT NULL REFERENCES customers (id) ON DELETE CASCADE,
    product      TEXT NOT NULL,
    version      TEXT,
    environment  TEXT,
    go_live_date TEXT,
    status       TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'retired')),
    notes        TEXT,
    created_at   TEXT NOT NULL,
    updated_at   TEXT NOT NULL
);

CREATE INDEX idx_deployments_customer ON deployments (customer_id);
