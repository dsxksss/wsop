use std::sync::Arc;

use sqlx::SqlitePool;

use crate::config::Config;
use crate::storage::LocalFileStore;

/// 共享应用状态：DB 连接池 + 配置 + 文件存储。作为 axum 的 Router state。
#[derive(Clone)]
pub struct AppState {
    pub db: SqlitePool,
    pub config: Arc<Config>,
    pub store: Arc<LocalFileStore>,
}
