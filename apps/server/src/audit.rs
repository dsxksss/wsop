use axum::extract::FromRequestParts;
use axum::http::header::USER_AGENT;
use axum::http::request::Parts;
use chrono::Utc;
use sqlx::SqlitePool;
use uuid::Uuid;

use crate::error::AppResult;

/// 请求元信息（IP / UA），用于审计。任意 state 均可提取。
#[derive(Debug, Clone, Default)]
pub struct RequestMeta {
    pub ip: Option<String>,
    pub user_agent: Option<String>,
}

impl<S: Send + Sync> FromRequestParts<S> for RequestMeta {
    type Rejection = std::convert::Infallible;

    async fn from_request_parts(parts: &mut Parts, _state: &S) -> Result<Self, Self::Rejection> {
        let user_agent = parts
            .headers
            .get(USER_AGENT)
            .and_then(|v| v.to_str().ok())
            .map(str::to_string);
        let ip = parts
            .headers
            .get("x-forwarded-for")
            .and_then(|v| v.to_str().ok())
            .map(|s| s.split(',').next().unwrap_or(s).trim().to_string());
        Ok(RequestMeta { ip, user_agent })
    }
}

/// 写一条审计日志。失败只记录日志、不阻断主流程的调用方可忽略其返回。
pub async fn record(
    db: &SqlitePool,
    actor_id: Option<&str>,
    action: &str,
    entity_type: &str,
    entity_id: Option<&str>,
    changes: Option<serde_json::Value>,
    meta: &RequestMeta,
) -> AppResult<()> {
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();
    let changes_text = changes.map(|v| v.to_string());

    sqlx::query(
        "INSERT INTO audit_logs \
         (id, actor_id, action, entity_type, entity_id, changes, ip, user_agent, created_at) \
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(id)
    .bind(actor_id)
    .bind(action)
    .bind(entity_type)
    .bind(entity_id)
    .bind(changes_text)
    .bind(meta.ip.as_deref())
    .bind(meta.user_agent.as_deref())
    .bind(now)
    .execute(db)
    .await?;
    Ok(())
}
