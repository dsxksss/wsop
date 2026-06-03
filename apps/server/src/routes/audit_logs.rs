use axum::{
    extract::{Query, State},
    Json,
};
use serde::Deserialize;
use sqlx::QueryBuilder;

use crate::auth::extractor::AdminUser;
use crate::error::AppResult;
use crate::models::audit_log::AuditLog;
use crate::state::AppState;

#[derive(Deserialize)]
pub struct AuditParams {
    pub entity_type: Option<String>,
    pub action: Option<String>,
    pub actor_id: Option<String>,
    pub limit: Option<i64>,
}

/// GET /audit-logs — 审计日志查询（admin），按时间倒序，默认最近 200 条。
pub async fn list(
    State(state): State<AppState>,
    _admin: AdminUser,
    Query(params): Query<AuditParams>,
) -> AppResult<Json<Vec<AuditLog>>> {
    let limit = params.limit.unwrap_or(200).clamp(1, 1000);

    let mut qb = QueryBuilder::new(
        "SELECT a.id, a.actor_id, u.username AS actor_username, a.action, a.entity_type, \
         a.entity_id, a.changes, a.ip, a.user_agent, a.created_at \
         FROM audit_logs a LEFT JOIN users u ON u.id = a.actor_id WHERE 1 = 1",
    );
    if let Some(et) = params.entity_type.filter(|s| !s.is_empty()) {
        qb.push(" AND a.entity_type = ").push_bind(et);
    }
    if let Some(ac) = params.action.filter(|s| !s.is_empty()) {
        qb.push(" AND a.action = ").push_bind(ac);
    }
    if let Some(actor) = params.actor_id.filter(|s| !s.is_empty()) {
        qb.push(" AND a.actor_id = ").push_bind(actor);
    }
    qb.push(" ORDER BY a.created_at DESC LIMIT ").push_bind(limit);

    let rows = qb.build_query_as::<AuditLog>().fetch_all(&state.db).await?;
    Ok(Json(rows))
}
