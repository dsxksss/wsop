use axum::{
    extract::{Path, Query, State},
    Json,
};
use chrono::Utc;
use serde::Deserialize;
use serde_json::{json, Value};
use uuid::Uuid;

use crate::audit::{self, RequestMeta};
use crate::auth::extractor::AuthUser;
use crate::error::{AppError, AppResult};
use crate::models::customer::{
    CustomerSummaryDto, CustomerSummaryRow, CustomerRemoteConnection,
};
use crate::models::deployment::Deployment;
use crate::state::AppState;

/// 客户 + 维护汇总的 SELECT（子查询聚合已完成维护数 / 最近维护时间 / 在用部署数）。
const SUMMARY_SELECT: &str = "SELECT c.id, c.name, c.short_name, c.industry, c.contact_name, \
     c.contact_phone, c.contact_email, c.address, c.notes, c.created_at, c.updated_at, \
     (SELECT COUNT(*) FROM maintenance_records m WHERE m.customer_id = c.id AND m.status = 'done') AS maintenance_count, \
     (SELECT MAX(m.maintained_at) FROM maintenance_records m WHERE m.customer_id = c.id AND m.status = 'done') AS last_maintained_at, \
     (SELECT COUNT(*) FROM deployments d WHERE d.customer_id = c.id AND d.status = 'active') AS active_deployments \
     FROM customers c";

#[derive(Deserialize)]
pub struct ListParams {
    pub q: Option<String>,
}

/// GET /customers — 列表（含维护汇总），支持 ?q 模糊搜索。任意登录用户可读。
pub async fn list(
    State(state): State<AppState>,
    _user: AuthUser,
    Query(params): Query<ListParams>,
) -> AppResult<Json<Vec<CustomerSummaryDto>>> {
    let rows = match params.q.filter(|s| !s.trim().is_empty()) {
        Some(q) => {
            let like = format!("%{}%", q.trim());
            let sql = format!(
                "{SUMMARY_SELECT} WHERE c.name LIKE ? OR c.short_name LIKE ? OR c.contact_name LIKE ? \
                 ORDER BY c.updated_at DESC"
            );
            sqlx::query_as::<_, CustomerSummaryRow>(&sql)
                .bind(&like)
                .bind(&like)
                .bind(&like)
                .fetch_all(&state.db)
                .await?
        }
        None => {
            let sql = format!("{SUMMARY_SELECT} ORDER BY c.updated_at DESC");
            sqlx::query_as::<_, CustomerSummaryRow>(&sql)
                .fetch_all(&state.db)
                .await?
        }
    };
    Ok(Json(rows.into_iter().map(CustomerSummaryDto::from).collect()))
}

/// GET /customers/{id} — 详情：客户汇总 + 部署列表。
pub async fn get(
    State(state): State<AppState>,
    user: AuthUser,
    Path(id): Path<String>,
) -> AppResult<Json<Value>> {
    let sql = format!("{SUMMARY_SELECT} WHERE c.id = ?");
    let customer = sqlx::query_as::<_, CustomerSummaryRow>(&sql)
        .bind(&id)
        .fetch_optional(&state.db)
        .await?
        .ok_or(AppError::NotFound)?;

    let deployments = sqlx::query_as::<_, Deployment>(
        "SELECT * FROM deployments WHERE customer_id = ? ORDER BY created_at DESC",
    )
    .bind(&id)
    .fetch_all(&state.db)
    .await?;

    let mut remote_connections = sqlx::query_as::<_, CustomerRemoteConnection>(
        "SELECT * FROM customer_remote_connections WHERE customer_id = ? ORDER BY created_at DESC"
    )
    .bind(&id)
    .fetch_all(&state.db)
    .await?;

    // 凭据脱敏：只读用户（viewer）不返回任何密码材料。
    // 密码既在 wemol_password，也嵌在 connection_info 的 JSON 里，因此两者一并清除，
    // viewer 仅能看到连接名与用户名。
    if user.require_write().is_err() {
        for c in &mut remote_connections {
            c.wemol_password = None;
            c.connection_info = None;
        }
    }

    Ok(Json(json!({
        "customer": CustomerSummaryDto::from(customer),
        "deployments": deployments,
        "remote_connections": remote_connections,
    })))
}

#[derive(Deserialize)]
pub struct CustomerInput {
    pub name: String,
    pub short_name: Option<String>,
    pub industry: Option<String>,
    pub contact_name: Option<String>,
    pub contact_phone: Option<String>,
    pub contact_email: Option<String>,
    pub address: Option<String>,
    pub notes: Option<String>,
}

/// POST /customers — 登记客户（admin / engineer）。
pub async fn create(
    State(state): State<AppState>,
    user: AuthUser,
    meta: RequestMeta,
    Json(req): Json<CustomerInput>,
) -> AppResult<Json<Value>> {
    user.require_write()?;
    if req.name.trim().is_empty() {
        return Err(AppError::BadRequest("客户名不能为空".into()));
    }
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();

    sqlx::query(
        "INSERT INTO customers (id, name, short_name, industry, contact_name, contact_phone, \
         contact_email, address, notes, created_by, created_at, updated_at) \
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(req.name.trim())
    .bind(&req.short_name)
    .bind(&req.industry)
    .bind(&req.contact_name)
    .bind(&req.contact_phone)
    .bind(&req.contact_email)
    .bind(&req.address)
    .bind(&req.notes)
    .bind(&user.id)
    .bind(&now)
    .bind(&now)
    .execute(&state.db)
    .await?;

    audit::record(
        &state.db,
        Some(&user.id),
        "create",
        "customer",
        Some(&id),
        Some(json!({ "name": req.name })),
        &meta,
    )
    .await?;

    fetch_detail(&state, &id).await
}

/// PUT /customers/{id} — 编辑客户（admin / engineer）。
pub async fn update(
    State(state): State<AppState>,
    user: AuthUser,
    Path(id): Path<String>,
    meta: RequestMeta,
    Json(req): Json<CustomerInput>,
) -> AppResult<Json<Value>> {
    user.require_write()?;
    if req.name.trim().is_empty() {
        return Err(AppError::BadRequest("客户名不能为空".into()));
    }
    // 确认存在
    let exists: Option<(String,)> = sqlx::query_as("SELECT id FROM customers WHERE id = ?")
        .bind(&id)
        .fetch_optional(&state.db)
        .await?;
    if exists.is_none() {
        return Err(AppError::NotFound);
    }

    let now = Utc::now().to_rfc3339();
    sqlx::query(
        "UPDATE customers SET name = ?, short_name = ?, industry = ?, contact_name = ?, \
         contact_phone = ?, contact_email = ?, address = ?, notes = ?, updated_at = ? WHERE id = ?",
    )
    .bind(req.name.trim())
    .bind(&req.short_name)
    .bind(&req.industry)
    .bind(&req.contact_name)
    .bind(&req.contact_phone)
    .bind(&req.contact_email)
    .bind(&req.address)
    .bind(&req.notes)
    .bind(&now)
    .bind(&id)
    .execute(&state.db)
    .await?;

    audit::record(&state.db, Some(&user.id), "update", "customer", Some(&id), None, &meta).await?;
    fetch_detail(&state, &id).await
}

/// DELETE /customers/{id} — 删除客户（仅 admin；级联删部署/维护/文件元数据）。
pub async fn delete(
    State(state): State<AppState>,
    user: AuthUser,
    Path(id): Path<String>,
    meta: RequestMeta,
) -> AppResult<Json<Value>> {
    user.require_admin()?;
    let res = sqlx::query("DELETE FROM customers WHERE id = ?")
        .bind(&id)
        .execute(&state.db)
        .await?;
    if res.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }
    audit::record(&state.db, Some(&user.id), "delete", "customer", Some(&id), None, &meta).await?;
    Ok(Json(json!({ "ok": true })))
}

/// 复用：返回客户详情（汇总 + 部署）。
async fn fetch_detail(state: &AppState, id: &str) -> AppResult<Json<Value>> {
    let sql = format!("{SUMMARY_SELECT} WHERE c.id = ?");
    let customer = sqlx::query_as::<_, CustomerSummaryRow>(&sql)
        .bind(id)
        .fetch_one(&state.db)
        .await?;
    let deployments = sqlx::query_as::<_, Deployment>(
        "SELECT * FROM deployments WHERE customer_id = ? ORDER BY created_at DESC",
    )
    .bind(id)
    .fetch_all(&state.db)
    .await?;
    let remote_connections = sqlx::query_as::<_, CustomerRemoteConnection>(
        "SELECT * FROM customer_remote_connections WHERE customer_id = ? ORDER BY created_at DESC"
    )
    .bind(id)
    .fetch_all(&state.db)
    .await?;
    Ok(Json(json!({
        "customer": CustomerSummaryDto::from(customer),
        "deployments": deployments,
        "remote_connections": remote_connections,
    })))
}

#[derive(Deserialize)]
pub struct CreateRemoteConnectionInput {
    pub name: String,
    pub wemol_username: Option<String>,
    pub wemol_password: Option<String>,
    pub connection_info: Option<String>,
}

/// POST /customers/{id}/remote-connections — 添加远程连接（admin / engineer）。
pub async fn create_remote_connection(
    State(state): State<AppState>,
    user: AuthUser,
    Path(customer_id): Path<String>,
    meta: RequestMeta,
    Json(req): Json<CreateRemoteConnectionInput>,
) -> AppResult<Json<Value>> {
    user.require_write()?;
    
    let exists: Option<(String,)> = sqlx::query_as("SELECT id FROM customers WHERE id = ?")
        .bind(&customer_id)
        .fetch_optional(&state.db)
        .await?;
    if exists.is_none() {
        return Err(AppError::NotFound);
    }

    if req.name.trim().is_empty() {
        return Err(AppError::BadRequest("名称不能为空".into()));
    }

    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();
    sqlx::query(
        "INSERT INTO customer_remote_connections (id, customer_id, name, wemol_username, wemol_password, connection_info, created_at, updated_at) \
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(&id)
    .bind(&customer_id)
    .bind(req.name.trim())
    .bind(&req.wemol_username)
    .bind(&req.wemol_password)
    .bind(&req.connection_info)
    .bind(&now)
    .bind(&now)
    .execute(&state.db)
    .await?;

    audit::record(
        &state.db,
        Some(&user.id),
        "create_remote_connection",
        "customer",
        Some(&customer_id),
        Some(json!({ "name": req.name })),
        &meta,
    )
    .await?;

    fetch_detail(&state, &customer_id).await
}

#[derive(Deserialize)]
pub struct UpdateRemoteConnectionInput {
    pub name: String,
    pub wemol_username: Option<String>,
    pub wemol_password: Option<String>,
    pub connection_info: Option<String>,
}

/// PUT /remote-connections/{id} — 修改远程连接（admin / engineer）。
pub async fn update_remote_connection(
    State(state): State<AppState>,
    user: AuthUser,
    Path(id): Path<String>,
    meta: RequestMeta,
    Json(req): Json<UpdateRemoteConnectionInput>,
) -> AppResult<Json<Value>> {
    user.require_write()?;
    
    let conn: Option<(String,)> = sqlx::query_as("SELECT customer_id FROM customer_remote_connections WHERE id = ?")
        .bind(&id)
        .fetch_optional(&state.db)
        .await?;
    let (customer_id,) = conn.ok_or(AppError::NotFound)?;

    if req.name.trim().is_empty() {
        return Err(AppError::BadRequest("名称不能为空".into()));
    }

    let now = Utc::now().to_rfc3339();
    sqlx::query(
        "UPDATE customer_remote_connections SET name = ?, wemol_username = ?, wemol_password = ?, connection_info = ?, updated_at = ? WHERE id = ?"
    )
    .bind(req.name.trim())
    .bind(&req.wemol_username)
    .bind(&req.wemol_password)
    .bind(&req.connection_info)
    .bind(&now)
    .bind(&id)
    .execute(&state.db)
    .await?;

    audit::record(
        &state.db,
        Some(&user.id),
        "update_remote_connection",
        "customer",
        Some(&customer_id),
        Some(json!({ "id": id, "name": req.name })),
        &meta,
    )
    .await?;

    fetch_detail(&state, &customer_id).await
}

/// DELETE /remote-connections/{id} — 删除远程连接（admin / engineer）。
pub async fn delete_remote_connection(
    State(state): State<AppState>,
    user: AuthUser,
    Path(id): Path<String>,
    meta: RequestMeta,
) -> AppResult<Json<Value>> {
    user.require_write()?;
    
    let conn: Option<(String,)> = sqlx::query_as("SELECT customer_id FROM customer_remote_connections WHERE id = ?")
        .bind(&id)
        .fetch_optional(&state.db)
        .await?;
    let (customer_id,) = conn.ok_or(AppError::NotFound)?;

    sqlx::query("DELETE FROM customer_remote_connections WHERE id = ?")
        .bind(&id)
        .execute(&state.db)
        .await?;

    audit::record(
        &state.db,
        Some(&user.id),
        "delete_remote_connection",
        "customer",
        Some(&customer_id),
        Some(json!({ "id": id })),
        &meta,
    )
    .await?;

    fetch_detail(&state, &customer_id).await
}
