use axum::{
    extract::{Path, Query, State},
    Json,
};
use chrono::Utc;
use serde::Deserialize;
use serde_json::{json, Value};
use sqlx::QueryBuilder;
use uuid::Uuid;

use crate::audit::{self, RequestMeta};
use crate::auth::extractor::AuthUser;
use crate::error::{AppError, AppResult};
use crate::models::maintenance::{MaintenanceListItem, MaintenanceNote, MaintenanceRecord};
use crate::state::AppState;

const VALID_TYPES: [&str; 5] = ["deploy", "upgrade", "inspection", "incident", "other"];

fn valid_type(s: &str) -> bool {
    VALID_TYPES.contains(&s)
}

/// 内容格式标记：'text'（纯文本）/ 'markdown'（Markdown 源码）/ 'html'（旧富文本）。
/// 不传时回退到 'text'，保证向后兼容。
fn norm_format(s: &Option<String>) -> AppResult<String> {
    match s.as_deref() {
        None | Some("text") => Ok("text".to_string()),
        Some("markdown") => Ok("markdown".to_string()),
        Some("html") => Ok("html".to_string()),
        Some(_) => Err(AppError::BadRequest("无效的内容格式".into())),
    }
}

async fn fetch_assignees(db: &sqlx::SqlitePool, record_id: &str) -> AppResult<Vec<crate::models::user::UserOptionDto>> {
    let rows = sqlx::query_as::<_, (String, String)>(
        "SELECT u.id, u.username FROM users u \
         JOIN maintenance_assignments ma ON u.id = ma.user_id \
         WHERE ma.record_id = ?"
    )
    .bind(record_id)
    .fetch_all(db)
    .await?;
    Ok(rows.into_iter().map(|(id, username)| crate::models::user::UserOptionDto { id, username }).collect())
}

#[derive(Deserialize)]
pub struct ListParams {
    pub customer_id: Option<String>,
    pub status: Option<String>,
    pub assignee_id: Option<String>,
    #[serde(rename = "type")]
    pub type_: Option<String>,
}

/// GET /maintenance-records — 列表（可按 customer/status/assignee/type 过滤）。
pub async fn list(
    State(state): State<AppState>,
    user: AuthUser,
    Query(params): Query<ListParams>,
) -> AppResult<Json<Vec<MaintenanceListItem>>> {
    let mut qb = QueryBuilder::new(
        "SELECT m.id, m.customer_id, c.name AS customer_name, m.deployment_id, m.title, \
         m.type, m.status, \
         m.maintained_at, m.completed_at, m.created_at \
         FROM maintenance_records m \
         JOIN customers c ON c.id = m.customer_id \
         WHERE 1 = 1",
    );
    
    let has_assigned_scope = user.role_id != "admin" && user.permissions.data_scope == "assigned";
    if has_assigned_scope {
        qb.push(" AND m.customer_id IN (SELECT customer_id FROM customer_assignments WHERE user_id = ");
        qb.push_bind(&user.id);
        qb.push(")");
    }

    if let Some(cid) = params.customer_id.filter(|s| !s.is_empty()) {
        qb.push(" AND m.customer_id = ").push_bind(cid);
    }
    if let Some(st) = params.status.filter(|s| !s.is_empty()) {
        qb.push(" AND m.status = ").push_bind(st);
    }
    if let Some(aid) = params.assignee_id.filter(|s| !s.is_empty()) {
        qb.push(" AND m.id IN (SELECT record_id FROM maintenance_assignments WHERE user_id = ");
        qb.push_bind(aid);
        qb.push(")");
    }
    if let Some(ty) = params.type_.filter(|s| !s.is_empty()) {
        qb.push(" AND m.type = ").push_bind(ty);
    }
    qb.push(" ORDER BY m.maintained_at DESC");

    let rows = qb
        .build_query_as::<MaintenanceListItem>()
        .fetch_all(&state.db)
        .await?;

    let mut dtos = Vec::new();
    for mut row in rows {
        row.assignees = Some(fetch_assignees(&state.db, &row.id).await?);
        dtos.push(row);
    }
    Ok(Json(dtos))
}

/// GET /maintenance-records/{id} — 详情（记录 + 跟进备注）。
pub async fn get(
    State(state): State<AppState>,
    user: AuthUser,
    Path(id): Path<String>,
) -> AppResult<Json<Value>> {
    let record = sqlx::query_as::<_, MaintenanceRecord>(
        "SELECT * FROM maintenance_records WHERE id = ?",
    )
    .bind(&id)
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound)?;

    let has_assigned_scope = user.role_id != "admin" && user.permissions.data_scope == "assigned";
    if has_assigned_scope {
        let is_assigned: Option<(String,)> = sqlx::query_as(
            "SELECT customer_id FROM customer_assignments WHERE customer_id = ? AND user_id = ?"
        )
        .bind(&record.customer_id)
        .bind(&user.id)
        .fetch_optional(&state.db)
        .await?;
        if is_assigned.is_none() {
            return Err(AppError::Forbidden);
        }
    }

    let notes = sqlx::query_as::<_, MaintenanceNote>(
        "SELECT n.id, n.record_id, n.author_id, u.username AS author_username, n.note, n.note_format, n.created_at \
         FROM maintenance_notes n LEFT JOIN users u ON u.id = n.author_id \
         WHERE n.record_id = ? ORDER BY n.created_at ASC",
    )
    .bind(&id)
    .fetch_all(&state.db)
    .await?;

    Ok(Json(json!({ "record": record, "notes": notes })))
}

#[derive(Deserialize)]
pub struct CreateInput {
    pub customer_id: String,
    pub deployment_id: Option<String>,
    pub title: String,
    #[serde(rename = "type")]
    pub type_: String,
    pub assignee_ids: Option<Vec<String>>,
    pub content: Option<String>,
    /// content 的格式：'text'（默认）或 'html'。
    pub content_format: Option<String>,
    /// 维护时间（ISO8601）；不传则用当前时间。
    pub maintained_at: Option<String>,
    /// 可选：直接以某状态创建（默认 in_progress）。
    pub status: Option<String>,
    pub result: Option<String>,
    /// result 的格式：'text'（默认）或 'html'。
    pub result_format: Option<String>,
}

/// POST /maintenance-records — 新建维护记录（admin / engineer）。
pub async fn create(
    State(state): State<AppState>,
    user: AuthUser,
    meta: RequestMeta,
    Json(req): Json<CreateInput>,
) -> AppResult<Json<MaintenanceRecord>> {
    user.require_action("write:maintenance")?;
    
    let has_assigned_scope = user.role_id != "admin" && user.permissions.data_scope == "assigned";
    if has_assigned_scope {
        let is_assigned: Option<(String,)> = sqlx::query_as(
            "SELECT customer_id FROM customer_assignments WHERE customer_id = ? AND user_id = ?"
        )
        .bind(&req.customer_id)
        .bind(&user.id)
        .fetch_optional(&state.db)
        .await?;
        if is_assigned.is_none() {
            return Err(AppError::Forbidden);
        }
    }

    if req.title.trim().is_empty() {
        return Err(AppError::BadRequest("标题不能为空".into()));
    }
    if !valid_type(&req.type_) {
        return Err(AppError::BadRequest("无效维护类型".into()));
    }
    // 客户必须存在
    let exists: Option<(String,)> = sqlx::query_as("SELECT id FROM customers WHERE id = ?")
        .bind(&req.customer_id)
        .fetch_optional(&state.db)
        .await?;
    if exists.is_none() {
        return Err(AppError::NotFound);
    }

    let status = req.status.as_deref().unwrap_or("in_progress");
    if status != "in_progress" && status != "done" {
        return Err(AppError::BadRequest("无效状态".into()));
    }
    let content_format = norm_format(&req.content_format)?;
    let result_format = norm_format(&req.result_format)?;
    let now = Utc::now().to_rfc3339();
    let maintained_at = req.maintained_at.clone().unwrap_or_else(|| now.clone());
    let completed_at = if status == "done" {
        Some(now.clone())
    } else {
        None
    };

    let id = Uuid::new_v4().to_string();
    let mut tx = state.db.begin().await?;

    sqlx::query(
        "INSERT INTO maintenance_records \
         (id, customer_id, deployment_id, title, type, status, content, result, content_format, result_format, \
          maintained_at, completed_at, created_by, created_at, updated_at) \
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&req.customer_id)
    .bind(&req.deployment_id)
    .bind(req.title.trim())
    .bind(&req.type_)
    .bind(status)
    .bind(&req.content)
    .bind(&req.result)
    .bind(&content_format)
    .bind(&result_format)
    .bind(&maintained_at)
    .bind(&completed_at)
    .bind(&user.id)
    .bind(&now)
    .bind(&now)
    .execute(&mut *tx)
    .await?;

    if let Some(user_ids) = &req.assignee_ids {
        for user_id in user_ids {
            sqlx::query("INSERT INTO maintenance_assignments (record_id, user_id) VALUES (?, ?)")
                .bind(&id)
                .bind(user_id)
                .execute(&mut *tx)
                .await?;
        }
    }

    tx.commit().await?;

    audit::record(
        &state.db,
        Some(&user.id),
        "create",
        "maintenance_record",
        Some(&id),
        Some(json!({ "customer_id": req.customer_id, "title": req.title, "status": status })),
        &meta,
    )
    .await?;

    fetch_record(&state, &id).await.map(Json)
}

#[derive(Deserialize)]
pub struct UpdateInput {
    pub title: Option<String>,
    #[serde(rename = "type")]
    pub type_: Option<String>,
    pub deployment_id: Option<String>,
    pub assignee_ids: Option<Vec<String>>,
    pub content: Option<String>,
    /// content 的格式：'text'（默认）或 'html'。仅在提供 content 时生效。
    pub content_format: Option<String>,
    pub maintained_at: Option<String>,
}

/// PUT /maintenance-records/{id} — 编辑（admin / engineer）。仅更新提供的字段。
pub async fn update(
    State(state): State<AppState>,
    user: AuthUser,
    Path(id): Path<String>,
    meta: RequestMeta,
    Json(req): Json<UpdateInput>,
) -> AppResult<Json<MaintenanceRecord>> {
    user.require_action("write:maintenance")?;
    let mut record = fetch_record(&state, &id).await?;

    let has_assigned_scope = user.role_id != "admin" && user.permissions.data_scope == "assigned";
    if has_assigned_scope {
        let is_assigned: Option<(String,)> = sqlx::query_as(
            "SELECT customer_id FROM customer_assignments WHERE customer_id = ? AND user_id = ?"
        )
        .bind(&record.customer_id)
        .bind(&user.id)
        .fetch_optional(&state.db)
        .await?;
        if is_assigned.is_none() {
            return Err(AppError::Forbidden);
        }
    }

    if let Some(t) = req.title {
        if t.trim().is_empty() {
            return Err(AppError::BadRequest("标题不能为空".into()));
        }
        record.title = t.trim().to_string();
    }
    if let Some(ty) = req.type_ {
        if !valid_type(&ty) {
            return Err(AppError::BadRequest("无效维护类型".into()));
        }
        record.r#type = ty;
    }
    if req.deployment_id.is_some() {
        record.deployment_id = req.deployment_id;
    }
    if req.content.is_some() {
        record.content = req.content;
        // 仅在同时更新 content 时才更新其格式（默认回退 text）。
        record.content_format = norm_format(&req.content_format)?;
    }
    if let Some(m) = req.maintained_at {
        record.maintained_at = m;
    }

    let now = Utc::now().to_rfc3339();
    let mut tx = state.db.begin().await?;

    sqlx::query(
        "UPDATE maintenance_records SET title = ?, type = ?, deployment_id = ?, \
         content = ?, content_format = ?, maintained_at = ?, updated_at = ? WHERE id = ?",
    )
    .bind(&record.title)
    .bind(&record.r#type)
    .bind(&record.deployment_id)
    .bind(&record.content)
    .bind(&record.content_format)
    .bind(&record.maintained_at)
    .bind(&now)
    .bind(&id)
    .execute(&mut *tx)
    .await?;

    if let Some(user_ids) = &req.assignee_ids {
        sqlx::query("DELETE FROM maintenance_assignments WHERE record_id = ?")
            .bind(&id)
            .execute(&mut *tx)
            .await?;

        for user_id in user_ids {
            sqlx::query("INSERT INTO maintenance_assignments (record_id, user_id) VALUES (?, ?)")
                .bind(&id)
                .bind(user_id)
                .execute(&mut *tx)
                .await?;
        }
    }

    tx.commit().await?;

    audit::record(&state.db, Some(&user.id), "update", "maintenance_record", Some(&id), None, &meta)
        .await?;
    fetch_record(&state, &id).await.map(Json)
}

#[derive(Deserialize)]
pub struct CompleteInput {
    pub result: Option<String>,
    /// result 的格式：'text'（默认）或 'html'。
    pub result_format: Option<String>,
}

/// PATCH /maintenance-records/{id}/complete — 标记完成（写 result + completed_at，状态转 done）。
/// 完成后客户的维护汇总（次数 / 最近维护时间）通过实时聚合自动反映。
pub async fn complete(
    State(state): State<AppState>,
    user: AuthUser,
    Path(id): Path<String>,
    meta: RequestMeta,
    Json(req): Json<CompleteInput>,
) -> AppResult<Json<MaintenanceRecord>> {
    user.require_action("write:maintenance")?;
    let record = fetch_record(&state, &id).await?; // 确认存在

    let has_assigned_scope = user.role_id != "admin" && user.permissions.data_scope == "assigned";
    if has_assigned_scope {
        let is_assigned: Option<(String,)> = sqlx::query_as(
            "SELECT customer_id FROM customer_assignments WHERE customer_id = ? AND user_id = ?"
        )
        .bind(&record.customer_id)
        .bind(&user.id)
        .fetch_optional(&state.db)
        .await?;
        if is_assigned.is_none() {
            return Err(AppError::Forbidden);
        }
    }

    // 仅在本次提供 result 时一并更新其格式，否则保留原值。
    let result_format = match &req.result {
        Some(_) => Some(norm_format(&req.result_format)?),
        None => None,
    };
    let now = Utc::now().to_rfc3339();
    sqlx::query(
        "UPDATE maintenance_records SET status = 'done', result = COALESCE(?, result), \
         result_format = COALESCE(?, result_format), completed_at = ?, updated_at = ? WHERE id = ?",
    )
    .bind(&req.result)
    .bind(&result_format)
    .bind(&now)
    .bind(&now)
    .bind(&id)
    .execute(&state.db)
    .await?;

    audit::record(
        &state.db,
        Some(&user.id),
        "complete",
        "maintenance_record",
        Some(&id),
        None,
        &meta,
    )
    .await?;
    fetch_record(&state, &id).await.map(Json)
}

/// PATCH /maintenance-records/{id}/reopen — 撤销完成（done → in_progress，清空完成时间）。
/// 用于误点「标记完成」后回退；保留已填写的 result。
pub async fn reopen(
    State(state): State<AppState>,
    user: AuthUser,
    Path(id): Path<String>,
    meta: RequestMeta,
) -> AppResult<Json<MaintenanceRecord>> {
    user.require_action("write:maintenance")?;
    let record = fetch_record(&state, &id).await?; // 确认存在

    let has_assigned_scope = user.role_id != "admin" && user.permissions.data_scope == "assigned";
    if has_assigned_scope {
        let is_assigned: Option<(String,)> = sqlx::query_as(
            "SELECT customer_id FROM customer_assignments WHERE customer_id = ? AND user_id = ?"
        )
        .bind(&record.customer_id)
        .bind(&user.id)
        .fetch_optional(&state.db)
        .await?;
        if is_assigned.is_none() {
            return Err(AppError::Forbidden);
        }
    }

    let now = Utc::now().to_rfc3339();
    sqlx::query(
        "UPDATE maintenance_records SET status = 'in_progress', completed_at = NULL, updated_at = ? \
         WHERE id = ?",
    )
    .bind(&now)
    .bind(&id)
    .execute(&state.db)
    .await?;

    audit::record(
        &state.db,
        Some(&user.id),
        "reopen",
        "maintenance_record",
        Some(&id),
        None,
        &meta,
    )
    .await?;
    fetch_record(&state, &id).await.map(Json)
}

/// DELETE /maintenance-records/{id} — 删除（admin / engineer）。
pub async fn delete(
    State(state): State<AppState>,
    user: AuthUser,
    Path(id): Path<String>,
    meta: RequestMeta,
) -> AppResult<Json<Value>> {
    user.require_action("delete:maintenance")?;
    let record = fetch_record(&state, &id).await?;

    let has_assigned_scope = user.role_id != "admin" && user.permissions.data_scope == "assigned";
    if has_assigned_scope {
        let is_assigned: Option<(String,)> = sqlx::query_as(
            "SELECT customer_id FROM customer_assignments WHERE customer_id = ? AND user_id = ?"
        )
        .bind(&record.customer_id)
        .bind(&user.id)
        .fetch_optional(&state.db)
        .await?;
        if is_assigned.is_none() {
            return Err(AppError::Forbidden);
        }
    }

    let res = sqlx::query("DELETE FROM maintenance_records WHERE id = ?")
        .bind(&id)
        .execute(&state.db)
        .await?;
    if res.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }
    audit::record(&state.db, Some(&user.id), "delete", "maintenance_record", Some(&id), None, &meta)
        .await?;
    Ok(Json(json!({ "ok": true })))
}

#[derive(Deserialize)]
pub struct NoteInput {
    pub note: String,
    /// note 的格式：'text'（默认）或 'html'。
    pub note_format: Option<String>,
}

/// POST /maintenance-records/{id}/notes — 追加跟进备注（admin / engineer）。
pub async fn add_note(
    State(state): State<AppState>,
    user: AuthUser,
    Path(id): Path<String>,
    meta: RequestMeta,
    Json(req): Json<NoteInput>,
) -> AppResult<Json<MaintenanceNote>> {
    user.require_action("write:maintenance")?;
    if req.note.trim().is_empty() {
        return Err(AppError::BadRequest("备注不能为空".into()));
    }
    let record = fetch_record(&state, &id).await?; // 确认记录存在

    let has_assigned_scope = user.role_id != "admin" && user.permissions.data_scope == "assigned";
    if has_assigned_scope {
        let is_assigned: Option<(String,)> = sqlx::query_as(
            "SELECT customer_id FROM customer_assignments WHERE customer_id = ? AND user_id = ?"
        )
        .bind(&record.customer_id)
        .bind(&user.id)
        .fetch_optional(&state.db)
        .await?;
        if is_assigned.is_none() {
            return Err(AppError::Forbidden);
        }
    }

    let note_format = norm_format(&req.note_format)?;
    let note_id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();
    sqlx::query(
        "INSERT INTO maintenance_notes (id, record_id, author_id, note, note_format, created_at) \
         VALUES (?, ?, ?, ?, ?, ?)",
    )
    .bind(&note_id)
    .bind(&id)
    .bind(&user.id)
    .bind(req.note.trim())
    .bind(&note_format)
    .bind(&now)
    .execute(&state.db)
    .await?;

    audit::record(
        &state.db,
        Some(&user.id),
        "create",
        "maintenance_note",
        Some(&note_id),
        Some(json!({ "record_id": id })),
        &meta,
    )
    .await?;

    let note = sqlx::query_as::<_, MaintenanceNote>(
        "SELECT n.id, n.record_id, n.author_id, u.username AS author_username, n.note, n.note_format, n.created_at \
         FROM maintenance_notes n LEFT JOIN users u ON u.id = n.author_id WHERE n.id = ?",
    )
    .bind(&note_id)
    .fetch_one(&state.db)
    .await?;
    Ok(Json(note))
}

/// 读取一条维护记录（不存在 -> 404）。
async fn fetch_record(state: &AppState, id: &str) -> AppResult<MaintenanceRecord> {
    let mut record = sqlx::query_as::<_, MaintenanceRecord>("SELECT * FROM maintenance_records WHERE id = ?")
        .bind(id)
        .fetch_optional(&state.db)
        .await?
        .ok_or(AppError::NotFound)?;
    record.assignees = Some(fetch_assignees(&state.db, id).await?);
    Ok(record)
}
