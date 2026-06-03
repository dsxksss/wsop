-- Disable foreign keys check temporarily to allow table recreation
PRAGMA foreign_keys = OFF;

-- 1. Create maintenance_assignments table
CREATE TABLE maintenance_assignments (
    record_id TEXT NOT NULL REFERENCES maintenance_records (id) ON DELETE CASCADE,
    user_id   TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    PRIMARY KEY (record_id, user_id)
);

CREATE INDEX idx_maintenance_assignments_user ON maintenance_assignments (user_id);

-- 2. Migrate existing assignee_id into assignments table
INSERT INTO maintenance_assignments (record_id, user_id)
SELECT id, assignee_id FROM maintenance_records WHERE assignee_id IS NOT NULL AND assignee_id != '';

-- 3. Recreate maintenance_records table without assignee_id column
CREATE TABLE new_maintenance_records (
    id            TEXT PRIMARY KEY NOT NULL,
    customer_id   TEXT NOT NULL REFERENCES customers (id) ON DELETE CASCADE,
    deployment_id TEXT REFERENCES deployments (id) ON DELETE SET NULL,
    title         TEXT NOT NULL,
    type          TEXT NOT NULL CHECK (type IN ('deploy', 'upgrade', 'inspection', 'incident', 'other')),
    status        TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'done')),
    content       TEXT,
    result        TEXT,
    maintained_at TEXT NOT NULL,
    completed_at  TEXT,
    created_by    TEXT REFERENCES users (id),
    created_at    TEXT NOT NULL,
    updated_at    TEXT NOT NULL
);

INSERT INTO new_maintenance_records (id, customer_id, deployment_id, title, type, status, content, result, maintained_at, completed_at, created_by, created_at, updated_at)
SELECT id, customer_id, deployment_id, title, type, status, content, result, maintained_at, completed_at, created_by, created_at, updated_at FROM maintenance_records;

DROP TABLE maintenance_records;
ALTER TABLE new_maintenance_records RENAME TO maintenance_records;

CREATE INDEX idx_maint_customer ON maintenance_records (customer_id);
CREATE INDEX idx_maint_status ON maintenance_records (status);

PRAGMA foreign_keys = ON;
