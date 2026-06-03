use axum::{
    extract::{Path, State},
    Json,
};
use chrono::Utc;
use serde::Deserialize;
use serde_json::{json, Value};
use uuid::Uuid;

use crate::audit::{self, RequestMeta};
use crate::auth::extractor::AuthUser;
use crate::error::{AppError, AppResult};
use crate::models::deployment::Deployment;
use crate::state::AppState;

/// GET /customers/{id}/deployments — 列出某客户的部署实例。
pub async fn list(
    State(state): State<AppState>,
    user: AuthUser,
    Path(customer_id): Path<String>,
) -> AppResult<Json<Vec<Deployment>>> {
    let has_assigned_scope = user.role_id != "admin" && user.permissions.data_scope == "assigned";
    if has_assigned_scope {
        let is_assigned: Option<(String,)> = sqlx::query_as(
            "SELECT customer_id FROM customer_assignments WHERE customer_id = ? AND user_id = ?"
        )
        .bind(&customer_id)
        .bind(&user.id)
        .fetch_optional(&state.db)
        .await?;
        if is_assigned.is_none() {
            return Err(AppError::Forbidden);
        }
    }

    let rows = sqlx::query_as::<_, Deployment>(
        "SELECT * FROM deployments WHERE customer_id = ? ORDER BY created_at DESC",
    )
    .bind(&customer_id)
    .fetch_all(&state.db)
    .await?;
    Ok(Json(rows))
}

#[derive(Deserialize)]
pub struct DeploymentInput {
    pub product: String,
    pub version: Option<String>,
    pub environment: Option<String>,
    pub go_live_date: Option<String>,
    pub status: Option<String>,
    pub notes: Option<String>,
    pub approval_no: Option<String>,
    pub submitted_at: Option<String>,
    pub department: Option<String>,
    pub purpose: Option<String>,
    pub concurrency_limit: Option<i64>,
    pub user_count: Option<i64>,
    pub license_expiry: Option<String>,
    pub module_count: Option<i64>,
    pub modules: Option<String>,
}

fn valid_status(s: &str) -> bool {
    matches!(s, "active" | "retired")
}

/// POST /customers/{id}/deployments — 新增部署（admin / engineer）。
pub async fn create(
    State(state): State<AppState>,
    user: AuthUser,
    Path(customer_id): Path<String>,
    meta: RequestMeta,
    Json(req): Json<DeploymentInput>,
) -> AppResult<Json<Deployment>> {
    user.require_action("write:deployments")?;
    
    let has_assigned_scope = user.role_id != "admin" && user.permissions.data_scope == "assigned";
    if has_assigned_scope {
        let is_assigned: Option<(String,)> = sqlx::query_as(
            "SELECT customer_id FROM customer_assignments WHERE customer_id = ? AND user_id = ?"
        )
        .bind(&customer_id)
        .bind(&user.id)
        .fetch_optional(&state.db)
        .await?;
        if is_assigned.is_none() {
            return Err(AppError::Forbidden);
        }
    }

    if req.product.trim().is_empty() {
        return Err(AppError::BadRequest("产品名不能为空".into()));
    }
    // 客户必须存在
    let exists: Option<(String,)> = sqlx::query_as("SELECT id FROM customers WHERE id = ?")
        .bind(&customer_id)
        .fetch_optional(&state.db)
        .await?;
    if exists.is_none() {
        return Err(AppError::NotFound);
    }

    let status = req.status.as_deref().unwrap_or("active");
    if !valid_status(status) {
        return Err(AppError::BadRequest("无效状态".into()));
    }

    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();
    sqlx::query(
        "INSERT INTO deployments (id, customer_id, product, version, environment, go_live_date, \
         status, notes, approval_no, submitted_at, department, purpose, concurrency_limit, \
         user_count, license_expiry, module_count, modules, created_at, updated_at) \
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&customer_id)
    .bind(req.product.trim())
    .bind(&req.version)
    .bind(&req.environment)
    .bind(&req.go_live_date)
    .bind(status)
    .bind(&req.notes)
    .bind(&req.approval_no)
    .bind(&req.submitted_at)
    .bind(&req.department)
    .bind(&req.purpose)
    .bind(&req.concurrency_limit)
    .bind(&req.user_count)
    .bind(&req.license_expiry)
    .bind(&req.module_count)
    .bind(&req.modules)
    .bind(&now)
    .bind(&now)
    .execute(&state.db)
    .await?;

    audit::record(
        &state.db,
        Some(&user.id),
        "create",
        "deployment",
        Some(&id),
        Some(json!({ "customer_id": customer_id, "product": req.product })),
        &meta,
    )
    .await?;

    let row = sqlx::query_as::<_, Deployment>("SELECT * FROM deployments WHERE id = ?")
        .bind(&id)
        .fetch_one(&state.db)
        .await?;
    Ok(Json(row))
}

/// PUT /deployments/{id} — 编辑部署（admin / engineer）。
pub async fn update(
    State(state): State<AppState>,
    user: AuthUser,
    Path(id): Path<String>,
    meta: RequestMeta,
    Json(req): Json<DeploymentInput>,
) -> AppResult<Json<Deployment>> {
    user.require_action("write:deployments")?;
    let dep = sqlx::query_as::<_, Deployment>("SELECT * FROM deployments WHERE id = ?")
        .bind(&id)
        .fetch_optional(&state.db)
        .await?
        .ok_or(AppError::NotFound)?;

    let has_assigned_scope = user.role_id != "admin" && user.permissions.data_scope == "assigned";
    if has_assigned_scope {
        let is_assigned: Option<(String,)> = sqlx::query_as(
            "SELECT customer_id FROM customer_assignments WHERE customer_id = ? AND user_id = ?"
        )
        .bind(&dep.customer_id)
        .bind(&user.id)
        .fetch_optional(&state.db)
        .await?;
        if is_assigned.is_none() {
            return Err(AppError::Forbidden);
        }
    }

    let status = req.status.as_deref().unwrap_or("active");
    if !valid_status(status) {
        return Err(AppError::BadRequest("无效状态".into()));
    }
    let now = Utc::now().to_rfc3339();
    sqlx::query(
        "UPDATE deployments SET product = ?, version = ?, environment = ?, go_live_date = ?, \
         status = ?, notes = ?, approval_no = ?, submitted_at = ?, department = ?, purpose = ?, \
         concurrency_limit = ?, user_count = ?, license_expiry = ?, module_count = ?, modules = ?, \
         updated_at = ? WHERE id = ?",
    )
    .bind(req.product.trim())
    .bind(&req.version)
    .bind(&req.environment)
    .bind(&req.go_live_date)
    .bind(status)
    .bind(&req.notes)
    .bind(&req.approval_no)
    .bind(&req.submitted_at)
    .bind(&req.department)
    .bind(&req.purpose)
    .bind(&req.concurrency_limit)
    .bind(&req.user_count)
    .bind(&req.license_expiry)
    .bind(&req.module_count)
    .bind(&req.modules)
    .bind(&now)
    .bind(&id)
    .execute(&state.db)
    .await?;

    audit::record(&state.db, Some(&user.id), "update", "deployment", Some(&id), None, &meta).await?;

    let row = sqlx::query_as::<_, Deployment>("SELECT * FROM deployments WHERE id = ?")
        .bind(&id)
        .fetch_one(&state.db)
        .await?;
    Ok(Json(row))
}

/// DELETE /deployments/{id} — 删除部署（admin / engineer）。
pub async fn delete(
    State(state): State<AppState>,
    user: AuthUser,
    Path(id): Path<String>,
    meta: RequestMeta,
) -> AppResult<Json<Value>> {
    user.require_action("delete:deployments")?;
    let dep = sqlx::query_as::<_, Deployment>("SELECT * FROM deployments WHERE id = ?")
        .bind(&id)
        .fetch_optional(&state.db)
        .await?
        .ok_or(AppError::NotFound)?;

    let has_assigned_scope = user.role_id != "admin" && user.permissions.data_scope == "assigned";
    if has_assigned_scope {
        let is_assigned: Option<(String,)> = sqlx::query_as(
            "SELECT customer_id FROM customer_assignments WHERE customer_id = ? AND user_id = ?"
        )
        .bind(&dep.customer_id)
        .bind(&user.id)
        .fetch_optional(&state.db)
        .await?;
        if is_assigned.is_none() {
            return Err(AppError::Forbidden);
        }
    }

    let res = sqlx::query("DELETE FROM deployments WHERE id = ?")
        .bind(&id)
        .execute(&state.db)
        .await?;
    if res.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }
    audit::record(&state.db, Some(&user.id), "delete", "deployment", Some(&id), None, &meta).await?;
    Ok(Json(json!({ "ok": true })))
}
