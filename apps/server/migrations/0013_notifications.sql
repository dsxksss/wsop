-- 应用级设置（key-value），目前仅维护提醒阈值（月数）。
CREATE TABLE app_settings (
    key        TEXT PRIMARY KEY NOT NULL,
    value      TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
INSERT INTO app_settings (key, value, updated_at) VALUES ('maintenance_due_months', '6', datetime('now'));

-- 站内通知。
CREATE TABLE notifications (
    id          TEXT PRIMARY KEY NOT NULL,
    user_id     TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    type        TEXT NOT NULL, -- 'maintenance_due' 等
    title       TEXT NOT NULL,
    body        TEXT,
    customer_id TEXT REFERENCES customers (id) ON DELETE CASCADE,
    read_at     TEXT,
    created_at  TEXT NOT NULL
);
CREATE INDEX idx_notifications_user_unread ON notifications (user_id, read_at);
CREATE INDEX idx_notifications_cust_type ON notifications (customer_id, type, created_at);
