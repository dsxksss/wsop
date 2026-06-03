use std::path::{Path, PathBuf};

use sqlx::sqlite::{SqliteConnectOptions, SqliteJournalMode, SqlitePoolOptions};
use sqlx::SqlitePool;

use crate::error::{AppError, AppResult};

/// 把 sqlite URL 里的相对文件路径解析为相对 server crate 根目录的绝对路径，
/// 这样无论从哪个 CWD 启动，DB 都落在 apps/server 下。
fn resolve_sqlite_path(database_url: &str) -> PathBuf {
    let raw = database_url
        .strip_prefix("sqlite://")
        .or_else(|| database_url.strip_prefix("sqlite:"))
        .unwrap_or(database_url);
    let raw = raw.split('?').next().unwrap_or(raw);
    let p = Path::new(raw);
    if p.is_absolute() {
        p.to_path_buf()
    } else {
        Path::new(env!("CARGO_MANIFEST_DIR")).join(raw)
    }
}

/// 连接 SQLite（文件不存在自动创建），启用 WAL 与外键。
pub async fn connect(database_url: &str) -> AppResult<SqlitePool> {
    let path = resolve_sqlite_path(database_url);
    if let Some(parent) = path.parent() {
        if !parent.as_os_str().is_empty() {
            std::fs::create_dir_all(parent)
                .map_err(|e| AppError::Internal(format!("create db dir: {e}")))?;
        }
    }

    let opts = SqliteConnectOptions::new()
        .filename(&path)
        .create_if_missing(true)
        .journal_mode(SqliteJournalMode::Wal)
        .foreign_keys(true);

    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .connect_with(opts)
        .await?;
    Ok(pool)
}

/// 启动时执行 ./migrations 下的全部迁移（编译期内嵌）。
pub async fn migrate(pool: &SqlitePool) -> AppResult<()> {
    sqlx::migrate!("./migrations")
        .run(pool)
        .await
        .map_err(|e| AppError::Internal(format!("migrate: {e}")))
}
