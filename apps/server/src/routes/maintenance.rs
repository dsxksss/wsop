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
    _user: AuthUser,
    Query(params): Query<ListParams>,
) -> AppResult<Json<Vec<MaintenanceListItem>>> {
    let mut qb = QueryBuilder::new(
        "SELECT m.id, m.customer_id, c.name AS customer_name, m.deployment_id, m.title, \
         m.type, m.status, m.assignee_id, u.username AS assignee_username, \
         m.maintained_at, m.completed_at, m.created_at \
         FROM maintenance_records m \
         JOIN customers c ON c.id = m.customer_id \
         LEFT JOIN users u ON u.id = m.assignee_id \
         WHERE 1 = 1",
    );
    if let Some(cid) = params.customer_id.filter(|s| !s.is_empty()) {
        qb.push(" AND m.customer_id = ").push_bind(cid);
    }
    if let Some(st) = params.status.filter(|s| !s.is_empty()) {
        qb.push(" AND m.status = ").push_bind(st);
    }
    if let Some(aid) = params.assignee_id.filter(|s| !s.is_empty()) {
        qb.push(" AND m.assignee_id = ").push_bind(aid);
    }
    if let Some(ty) = params.type_.filter(|s| !s.is_empty()) {
        qb.push(" AND m.type = ").push_bind(ty);
    }
    qb.push(" ORDER BY m.maintained_at DESC");

    let rows = qb
        .build_query_as::<MaintenanceListItem>()
        .fetch_all(&state.db)
        .await?;
    Ok(Json(rows))
}

/// GET /maintenance-records/{id} — 详情（记录 + 跟进备注）。
pub async fn get(
    State(state): State<AppState>,
    _user: AuthUser,
    Path(id): Path<String>,
) -> AppResult<Json<Value>> {
    let record = sqlx::query_as::<_, MaintenanceRecord>(
        "SELECT * FROM maintenance_records WHERE id = ?",
    )
    .bind(&id)
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound)?;

    let notes = sqlx::query_as::<_, MaintenanceNote>(
        "SELECT n.id, n.record_id, n.author_id, u.username AS author_username, n.note, n.created_at \
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
    pub assignee_id: Option<String>,
    pub content: Option<String>,
    /// 维护时间（ISO8601）；不传则用当前时间。
    pub maintained_at: Option<String>,
    /// 可选：直接以某状态创建（默认 in_progress）。
    pub status: Option<String>,
    pub result: Option<String>,
}

/// POST /maintenance-records — 新建维护记录（admin / engineer）。
pub async fn create(
    State(state): State<AppState>,
    user: AuthUser,
    meta: RequestMeta,
    Json(req): Json<CreateInput>,
) -> AppResult<Json<MaintenanceRecord>> {
    user.require_write()?;
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
    let now = Utc::now().to_rfc3339();
    let maintained_at = req.maintained_at.clone().unwrap_or_else(|| now.clone());
    let completed_at = if status == "done" {
        Some(now.clone())
    } else {
        None
    };

    let id = Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO maintenance_records \
         (id, customer_id, deployment_id, title, type, status, assignee_id, content, result, \
          maintained_at, completed_at, created_by, created_at, updated_at) \
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&req.customer_id)
    .bind(&req.deployment_id)
    .bind(req.title.trim())
    .bind(&req.type_)
    .bind(status)
    .bind(&req.assignee_id)
    .bind(&req.content)
    .bind(&req.result)
    .bind(&maintained_at)
    .bind(&completed_at)
    .bind(&user.id)
    .bind(&now)
    .bind(&now)
    .execute(&state.db)
    .await?;

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
    pub assignee_id: Option<String>,
    pub content: Option<String>,
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
    user.require_write()?;
    let mut record = fetch_record(&state, &id).await?;

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
    if req.assignee_id.is_some() {
        record.assignee_id = req.assignee_id;
    }
    if req.content.is_some() {
        record.content = req.content;
    }
    if let Some(m) = req.maintained_at {
        record.maintained_at = m;
    }

    let now = Utc::now().to_rfc3339();
    sqlx::query(
        "UPDATE maintenance_records SET title = ?, type = ?, deployment_id = ?, assignee_id = ?, \
         content = ?, maintained_at = ?, updated_at = ? WHERE id = ?",
    )
    .bind(&record.title)
    .bind(&record.r#type)
    .bind(&record.deployment_id)
    .bind(&record.assignee_id)
    .bind(&record.content)
    .bind(&record.maintained_at)
    .bind(&now)
    .bind(&id)
    .execute(&state.db)
    .await?;

    audit::record(&state.db, Some(&user.id), "update", "maintenance_record", Some(&id), None, &meta)
        .await?;
    fetch_record(&state, &id).await.map(Json)
}

#[derive(Deserialize)]
pub struct CompleteInput {
    pub result: Option<String>,
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
    user.require_write()?;
    fetch_record(&state, &id).await?; // 确认存在

    let now = Utc::now().to_rfc3339();
    sqlx::query(
        "UPDATE maintenance_records SET status = 'done', result = COALESCE(?, result), \
         completed_at = ?, updated_at = ? WHERE id = ?",
    )
    .bind(&req.result)
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

/// DELETE /maintenance-records/{id} — 删除（admin / engineer）。
pub async fn delete(
    State(state): State<AppState>,
    user: AuthUser,
    Path(id): Path<String>,
    meta: RequestMeta,
) -> AppResult<Json<Value>> {
    user.require_write()?;
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
}

/// POST /maintenance-records/{id}/notes — 追加跟进备注（admin / engineer）。
pub async fn add_note(
    State(state): State<AppState>,
    user: AuthUser,
    Path(id): Path<String>,
    meta: RequestMeta,
    Json(req): Json<NoteInput>,
) -> AppResult<Json<MaintenanceNote>> {
    user.require_write()?;
    if req.note.trim().is_empty() {
        return Err(AppError::BadRequest("备注不能为空".into()));
    }
    fetch_record(&state, &id).await?; // 确认记录存在

    let note_id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();
    sqlx::query(
        "INSERT INTO maintenance_notes (id, record_id, author_id, note, created_at) \
         VALUES (?, ?, ?, ?, ?)",
    )
    .bind(&note_id)
    .bind(&id)
    .bind(&user.id)
    .bind(req.note.trim())
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
        "SELECT n.id, n.record_id, n.author_id, u.username AS author_username, n.note, n.created_at \
         FROM maintenance_notes n LEFT JOIN users u ON u.id = n.author_id WHERE n.id = ?",
    )
    .bind(&note_id)
    .fetch_one(&state.db)
    .await?;
    Ok(Json(note))
}

/// 读取一条维护记录（不存在 -> 404）。
async fn fetch_record(state: &AppState, id: &str) -> AppResult<MaintenanceRecord> {
    sqlx::query_as::<_, MaintenanceRecord>("SELECT * FROM maintenance_records WHERE id = ?")
        .bind(id)
        .fetch_optional(&state.db)
        .await?
        .ok_or(AppError::NotFound)
}
