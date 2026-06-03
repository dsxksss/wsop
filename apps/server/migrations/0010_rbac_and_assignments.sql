-- Disable foreign keys check temporarily to allow table recreation
PRAGMA foreign_keys = OFF;

-- 1. Create roles table
CREATE TABLE roles (
    id          TEXT PRIMARY KEY NOT NULL,
    name        TEXT NOT NULL UNIQUE,
    description TEXT,
    permissions TEXT NOT NULL, -- JSON string representing RolePermissions DTO
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
);

-- 2. Insert default roles
INSERT INTO roles (id, name, description, permissions, created_at, updated_at) VALUES 
('admin', '系统管理员', '系统最高权限，可管理所有内容与设置', '{"data_scope":"all","view_pages":["dashboard","customers","maintenance","users","audit"],"actions":["write:customers","delete:customers","write:deployments","delete:deployments","write:maintenance","delete:maintenance","write:files","delete:files","manage:users","manage:roles"]}', datetime('now'), datetime('now')),
('engineer', '运维工程师', '可管理客户、部署、维护记录及文件上传', '{"data_scope":"all","view_pages":["dashboard","customers","maintenance"],"actions":["write:customers","write:deployments","write:maintenance","write:files"]}', datetime('now'), datetime('now')),
('viewer', '只读查看者', '仅可查看信息，无修改权限', '{"data_scope":"all","view_pages":["dashboard","customers","maintenance"],"actions":[]}', datetime('now'), datetime('now'));

-- 3. Recreate users table without check constraint
CREATE TABLE new_users (
    id            TEXT PRIMARY KEY NOT NULL,
    username      TEXT NOT NULL UNIQUE,
    email         TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role          TEXT NOT NULL REFERENCES roles(id),
    is_active     INTEGER NOT NULL DEFAULT 1,
    created_at    TEXT NOT NULL
);

INSERT INTO new_users (id, username, email, password_hash, role, is_active, created_at)
SELECT id, username, email, password_hash, role, is_active, created_at FROM users;

DROP TABLE users;
ALTER TABLE new_users RENAME TO users;
CREATE INDEX idx_users_role ON users (role);

-- 4. Create customer_assignments table
CREATE TABLE customer_assignments (
    customer_id TEXT NOT NULL REFERENCES customers (id) ON DELETE CASCADE,
    user_id     TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    PRIMARY KEY (customer_id, user_id)
);

CREATE INDEX idx_customer_assignments_user ON customer_assignments (user_id);

PRAGMA foreign_keys = ON;
