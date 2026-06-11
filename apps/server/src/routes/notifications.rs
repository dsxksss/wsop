use axum::{
    extract::{Path, Query, State},
    Json,
};
use chrono::Utc;
use serde::Deserialize;
use serde_json::{json, Value};

use crate::auth::extractor::AuthUser;
use crate::error::{AppError, AppResult};
use crate::models::notification::NotificationDto;
use crate::state::AppState;

#[derive(Deserialize)]
pub struct ListParams {
    pub unread: Option<String>,
}

/// GET /notifications — 当前用户的通知列表（最新 100 条，可选只看未读）。
pub async fn list(
    State(state): State<AppState>,
    user: AuthUser,
    Query(params): Query<ListParams>,
) -> AppResult<Json<Vec<NotificationDto>>> {
    let only_unread = params.unread.as_deref() == Some("1");
    let mut sql = String::from(
        "SELECT n.id, n.user_id, n.type, n.title, n.body, n.customer_id, \
         c.name AS customer_name, n.read_at, n.created_at \
         FROM notifications n \
         LEFT JOIN customers c ON c.id = n.customer_id \
         WHERE n.user_id = ?",
    );
    if only_unread {
        sql.push_str(" AND n.read_at IS NULL");
    }
    sql.push_str(" ORDER BY n.created_at DESC LIMIT 100");

    let rows = sqlx::query_as::<_, NotificationDto>(&sql)
        .bind(&user.id)
        .fetch_all(&state.db)
        .await?;
    Ok(Json(rows))
}

/// GET /notifications/unread-count — 未读数（前端轮询）。
pub async fn unread_count(
    State(state): State<AppState>,
    user: AuthUser,
) -> AppResult<Json<Value>> {
    let count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM notifications WHERE user_id = ? AND read_at IS NULL",
    )
    .bind(&user.id)
    .fetch_one(&state.db)
    .await?;
    Ok(Json(json!({ "count": count })))
}

/// PATCH /notifications/{id}/read — 标记单条已读。
pub async fn mark_read(
    State(state): State<AppState>,
    user: AuthUser,
    Path(id): Path<String>,
) -> AppResult<Json<Value>> {
    let res = sqlx::query(
        "UPDATE notifications SET read_at = ? WHERE id = ? AND user_id = ? AND read_at IS NULL",
    )
    .bind(Utc::now().to_rfc3339())
    .bind(&id)
    .bind(&user.id)
    .execute(&state.db)
    .await?;
    if res.rows_affected() == 0 {
        // 已读或不属于当前用户都视为幂等成功，但完全不存在时报 404。
        let exists: i64 =
            sqlx::query_scalar("SELECT COUNT(*) FROM notifications WHERE id = ? AND user_id = ?")
                .bind(&id)
                .bind(&user.id)
                .fetch_one(&state.db)
                .await?;
        if exists == 0 {
            return Err(AppError::NotFound);
        }
    }
    Ok(Json(json!({ "ok": true })))
}

/// POST /notifications/read-all — 全部标记已读。
pub async fn mark_all_read(
    State(state): State<AppState>,
    user: AuthUser,
) -> AppResult<Json<Value>> {
    sqlx::query("UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL")
        .bind(Utc::now().to_rfc3339())
        .bind(&user.id)
        .execute(&state.db)
        .await?;
    Ok(Json(json!({ "ok": true })))
}
