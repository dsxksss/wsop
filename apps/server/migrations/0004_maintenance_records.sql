CREATE TABLE maintenance_records (
    id            TEXT PRIMARY KEY NOT NULL,
    customer_id   TEXT NOT NULL REFERENCES customers (id) ON DELETE CASCADE,
    deployment_id TEXT REFERENCES deployments (id) ON DELETE SET NULL,
    title         TEXT NOT NULL,
    type          TEXT NOT NULL CHECK (type IN ('deploy', 'upgrade', 'inspection', 'incident', 'other')),
    status        TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'done')),
    assignee_id   TEXT REFERENCES users (id),
    content       TEXT,
    result        TEXT,
    maintained_at TEXT NOT NULL,
    completed_at  TEXT,
    created_by    TEXT REFERENCES users (id),
    created_at    TEXT NOT NULL,
    updated_at    TEXT NOT NULL
);

CREATE INDEX idx_maint_customer ON maintenance_records (customer_id);
CREATE INDEX idx_maint_status ON maintenance_records (status);
CREATE INDEX idx_maint_assignee ON maintenance_records (assignee_id);
