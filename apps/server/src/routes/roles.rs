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
use crate::error::{is_unique_violation, AppError, AppResult};
use crate::models::role::{RoleDto, RolePermissions, RoleResponseDto};
use crate::state::AppState;

/// GET /roles — 列出所有角色。
pub async fn list(
    State(state): State<AppState>,
    user: AuthUser,
) -> AppResult<Json<Vec<RoleResponseDto>>> {
    if user.role_id != "admin" 
        && !user.permissions.actions.iter().any(|a| a == "manage:roles" || a == "manage:users") 
    {
        return Err(AppError::Forbidden);
    }

    let rows = sqlx::query_as::<_, RoleDto>("SELECT * FROM roles ORDER BY created_at ASC")
        .fetch_all(&state.db)
        .await?;
    Ok(Json(rows.into_iter().map(RoleDto::into_response).collect()))
}

#[derive(Deserialize)]
pub struct CreateRoleReq {
    pub name: String,
    pub description: Option<String>,
    pub permissions: RolePermissions,
}

/// POST /roles — 新建角色。
pub async fn create(
    State(state): State<AppState>,
    user: AuthUser,
    meta: RequestMeta,
    Json(req): Json<CreateRoleReq>,
) -> AppResult<Json<RoleResponseDto>> {
    user.require_action("manage:roles")?;
    if req.name.trim().is_empty() {
        return Err(AppError::BadRequest("角色名不能为空".into()));
    }

    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();
    let permissions_json = serde_json::to_string(&req.permissions)
        .map_err(|e| AppError::BadRequest(format!("无效的权限格式: {e}")))?;

    sqlx::query(
        "INSERT INTO roles (id, name, description, permissions, created_at, updated_at) \
         VALUES (?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(req.name.trim())
    .bind(&req.description)
    .bind(&permissions_json)
    .bind(&now)
    .bind(&now)
    .execute(&state.db)
    .await
    .map_err(|e| {
        if is_unique_violation(&e) {
            AppError::Conflict("角色名已存在".into())
        } else {
            e.into()
        }
    })?;

    audit::record(
        &state.db,
        Some(&user.id),
        "create",
        "role",
        Some(&id),
        Some(json!({ "name": req.name })),
        &meta,
    )
    .await?;

    let row = sqlx::query_as::<_, RoleDto>("SELECT * FROM roles WHERE id = ?")
        .bind(&id)
        .fetch_one(&state.db)
        .await?;
    Ok(Json(row.into_response()))
}

#[derive(Deserialize)]
pub struct UpdateRoleReq {
    pub name: String,
    pub description: Option<String>,
    pub permissions: RolePermissions,
}

/// PUT /roles/{id} — 修改角色。
pub async fn update(
    State(state): State<AppState>,
    user: AuthUser,
    Path(id): Path<String>,
    meta: RequestMeta,
    Json(req): Json<UpdateRoleReq>,
) -> AppResult<Json<RoleResponseDto>> {
    user.require_action("manage:roles")?;
    
    if id == "admin" || id == "engineer" || id == "viewer" {
        if id == "admin" {
            return Err(AppError::BadRequest("内置管理员角色不允许修改".into()));
        }
    }

    if req.name.trim().is_empty() {
        return Err(AppError::BadRequest("角色名不能为空".into()));
    }

    let now = Utc::now().to_rfc3339();
    let permissions_json = serde_json::to_string(&req.permissions)
        .map_err(|e| AppError::BadRequest(format!("无效的权限格式: {e}")))?;

    sqlx::query(
        "UPDATE roles SET name = ?, description = ?, permissions = ?, updated_at = ? WHERE id = ?",
    )
    .bind(req.name.trim())
    .bind(&req.description)
    .bind(&permissions_json)
    .bind(&now)
    .bind(&id)
    .execute(&state.db)
    .await?;

    audit::record(
        &state.db,
        Some(&user.id),
        "update",
        "role",
        Some(&id),
        Some(json!({ "name": req.name })),
        &meta,
    )
    .await?;

    let row = sqlx::query_as::<_, RoleDto>("SELECT * FROM roles WHERE id = ?")
        .bind(&id)
        .fetch_one(&state.db)
        .await?;
    Ok(Json(row.into_response()))
}

/// DELETE /roles/{id} — 删除角色。
pub async fn delete(
    State(state): State<AppState>,
    user: AuthUser,
    Path(id): Path<String>,
    meta: RequestMeta,
) -> AppResult<Json<Value>> {
    user.require_action("manage:roles")?;
    if id == "admin" || id == "engineer" || id == "viewer" {
        return Err(AppError::BadRequest("内置角色不能被删除".into()));
    }

    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM users WHERE role = ?")
        .bind(&id)
        .fetch_one(&state.db)
        .await?;
    if count > 0 {
        return Err(AppError::BadRequest("无法删除：仍有用户在使用该角色".into()));
    }

    let res = sqlx::query("DELETE FROM roles WHERE id = ?")
        .bind(&id)
        .execute(&state.db)
        .await?;
    if res.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }

    audit::record(&state.db, Some(&user.id), "delete", "role", Some(&id), None, &meta).await?;
    Ok(Json(json!({ "ok": true })))
}
