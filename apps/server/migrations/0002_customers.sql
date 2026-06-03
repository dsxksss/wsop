CREATE TABLE customers (
    id            TEXT PRIMARY KEY NOT NULL,
    name          TEXT NOT NULL,
    short_name    TEXT,
    industry      TEXT,
    contact_name  TEXT,
    contact_phone TEXT,
    contact_email TEXT,
    address       TEXT,
    notes         TEXT,
    created_by    TEXT REFERENCES users (id),
    created_at    TEXT NOT NULL,
    updated_at    TEXT NOT NULL
);

CREATE INDEX idx_customers_name ON customers (name);
