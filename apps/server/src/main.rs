mod audit;
mod auth;
mod config;
mod db;
mod error;
mod models;
mod notify;
mod routes;
mod seed_demo;
mod state;
mod storage;

use std::sync::Arc;

use axum::extract::DefaultBodyLimit;
use chrono::Utc;
use tower_http::cors::CorsLayer;
use tower_http::trace::TraceLayer;
use tracing_subscriber::EnvFilter;
use uuid::Uuid;

use crate::config::Config;
use crate::state::AppState;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    if dotenvy::dotenv().is_err() {
        dotenvy::from_path("apps/server/.env").ok();
    }
    tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| EnvFilter::new("info,wsop_server=debug")),
        )
        .init();

    let config = Config::from_env();
    let pool = db::connect(&config.database_url).await?;
    db::migrate(&pool).await?;

    let store = Arc::new(storage::LocalFileStore::new(&config.storage_root));
    let state = AppState {
        db: pool,
        config: Arc::new(config),
        store,
    };
    seed_admin(&state).await?;

    // 开发期演示数据（仅在 SEED_DEMO 为真且无客户时填充）。
    if seed_demo::enabled() {
        if let Err(e) = seed_demo::seed_demo(&state).await {
            tracing::warn!("SEED_DEMO failed: {e}");
        }
    }

    // 维护到期提醒后台扫描（启动后先扫一次，之后每小时一次）。
    notify::spawn_scanner(state.db.clone());

    let app = routes::router(state.clone())
        .layer(DefaultBodyLimit::max(64 * 1024 * 1024)) // 允许最大 64MB 上传
        .layer(TraceLayer::new_for_http())
        .layer(CorsLayer::very_permissive());

    let addr = state.config.bind_addr.clone();
    let listener = tokio::net::TcpListener::bind(&addr).await?;
    tracing::info!("wsop-server listening on http://{addr}");
    axum::serve(listener, app).await?;
    Ok(())
}

/// 若库中没有任何用户，按配置创建初始管理员。
async fn seed_admin(state: &AppState) -> Result<(), Box<dyn std::error::Error>> {
    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM users")
        .fetch_one(&state.db)
        .await?;
    if count > 0 {
        return Ok(());
    }

    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();
    let hash = auth::password::hash_password(&state.config.admin_password)?;
    sqlx::query(
        "INSERT INTO users (id, username, email, password_hash, role, is_active, created_at) \
         VALUES (?, ?, ?, ?, 'admin', 1, ?)",
    )
    .bind(&id)
    .bind(&state.config.admin_username)
    .bind(&state.config.admin_email)
    .bind(&hash)
    .bind(&now)
    .execute(&state.db)
    .await?;

    tracing::warn!(
        "已创建初始管理员账户 '{}'（请尽快登录后修改密码）",
        state.config.admin_username
    );
    Ok(())
}
