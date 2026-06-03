CREATE TABLE audit_logs (
    id          TEXT PRIMARY KEY NOT NULL,
    actor_id    TEXT REFERENCES users (id),
    action      TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id   TEXT,
    changes     TEXT,            -- JSON diff (stored as text)
    ip          TEXT,
    user_agent  TEXT,
    created_at  TEXT NOT NULL
);

CREATE INDEX idx_audit_actor ON audit_logs (actor_id);
CREATE INDEX idx_audit_entity ON audit_logs (entity_type, entity_id);
CREATE INDEX idx_audit_created ON audit_logs (created_at);
