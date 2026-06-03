use std::env;

/// 运行配置，全部来自环境变量（见 .env.example）。
#[derive(Debug, Clone)]
pub struct Config {
    pub database_url: String,
    pub jwt_secret: String,
    pub storage_root: String,
    pub bind_addr: String,
    pub admin_username: String,
    pub admin_password: String,
    pub admin_email: String,
}

impl Config {
    pub fn from_env() -> Self {
        Self {
            database_url: env::var("DATABASE_URL")
                .unwrap_or_else(|_| "sqlite://data/wsop.db".into()),
            jwt_secret: env::var("JWT_SECRET").unwrap_or_else(|_| "dev-insecure-secret".into()),
            storage_root: env::var("STORAGE_ROOT").unwrap_or_else(|_| "storage".into()),
            bind_addr: env::var("BIND_ADDR").unwrap_or_else(|_| "127.0.0.1:8787".into()),
            admin_username: env::var("ADMIN_USERNAME").unwrap_or_else(|_| "admin".into()),
            admin_password: env::var("ADMIN_PASSWORD").unwrap_or_else(|_| "admin12345".into()),
            admin_email: env::var("ADMIN_EMAIL").unwrap_or_else(|_| "admin@example.com".into()),
        }
    }
}
