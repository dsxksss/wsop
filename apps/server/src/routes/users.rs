use axum::{
    extract::{Path, State},
    Json,
};
use chrono::Utc;
use serde::Deserialize;
use serde_json::{json, Value};
use uuid::Uuid;

use crate::audit::{self, RequestMeta};
use crate::auth::extractor::{AdminUser, AuthUser};
use crate::auth::password;
use crate::error::{is_unique_violation, AppError, AppResult};
use crate::models::user::{UserDto, UserRow, UserWithRoleRow, UserOptionDto};
use crate::state::AppState;

/// GET /users — 列出所有用户（admin）。
pub async fn list(State(state): State<AppState>, _admin: AdminUser) -> AppResult<Json<Vec<UserDto>>> {
    let rows = sqlx::query_as::<_, UserWithRoleRow>(
        "SELECT u.id, u.username, u.email, u.role, r.name as role_name, u.is_active, u.created_at \
         FROM users u \
         LEFT JOIN roles r ON u.role = r.id \
         ORDER BY u.created_at DESC"
    )
    .fetch_all(&state.db)
    .await?;
    Ok(Json(rows.into_iter().map(UserDto::from).collect()))
}

#[derive(Deserialize)]
pub struct CreateUserReq {
    pub username: String,
    pub email: String,
    pub password: String,
    pub role: String,
}

/// POST /users — 新建用户（admin）。
pub async fn create(
    State(state): State<AppState>,
    admin: AdminUser,
    meta: RequestMeta,
    Json(req): Json<CreateUserReq>,
) -> AppResult<Json<UserDto>> {
    let exists: Option<(String,)> = sqlx::query_as("SELECT id FROM roles WHERE id = ?")
        .bind(&req.role)
        .fetch_optional(&state.db)
        .await?;
    if exists.is_none() {
        return Err(AppError::BadRequest("无效的角色ID".into()));
    }

    if req.password.len() < 8 {
        return Err(AppError::BadRequest("密码至少 8 位".into()));
    }

    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();
    let hash = password::hash_password(&req.password)?;

    sqlx::query(
        "INSERT INTO users (id, username, email, password_hash, role, is_active, created_at) \
         VALUES (?, ?, ?, ?, ?, 1, ?)",
    )
    .bind(&id)
    .bind(&req.username)
    .bind(&req.email)
    .bind(&hash)
    .bind(&req.role)
    .bind(&now)
    .execute(&state.db)
    .await
    .map_err(|e| {
        if is_unique_violation(&e) {
            AppError::Conflict("用户名或邮箱已存在".into())
        } else {
            e.into()
        }
    })?;

    audit::record(
        &state.db,
        Some(&admin.0.id),
        "create",
        "user",
        Some(&id),
        Some(json!({ "username": req.username, "role": req.role })),
        &meta,
    )
    .await?;

    let row = sqlx::query_as::<_, UserRow>("SELECT * FROM users WHERE id = ?")
        .bind(&id)
        .fetch_one(&state.db)
        .await?;
    Ok(Json(UserDto::from(row)))
}

#[derive(Deserialize)]
pub struct UpdateUserReq {
    pub role: Option<String>,
    pub is_active: Option<bool>,
    pub password: Option<String>,
}

/// PATCH /users/{id} — 改角色 / 启停 / 重置密码（admin）。
pub async fn update(
    State(state): State<AppState>,
    admin: AdminUser,
    Path(id): Path<String>,
    meta: RequestMeta,
    Json(req): Json<UpdateUserReq>,
) -> AppResult<Json<UserDto>> {
    sqlx::query_as::<_, UserRow>("SELECT * FROM users WHERE id = ?")
        .bind(&id)
        .fetch_optional(&state.db)
        .await?
        .ok_or(AppError::NotFound)?;

    if let Some(role) = &req.role {
        let exists: Option<(String,)> = sqlx::query_as("SELECT id FROM roles WHERE id = ?")
            .bind(role)
            .fetch_optional(&state.db)
            .await?;
        if exists.is_none() {
            return Err(AppError::BadRequest("无效的角色ID".into()));
        }
        sqlx::query("UPDATE users SET role = ? WHERE id = ?")
            .bind(role)
            .bind(&id)
            .execute(&state.db)
            .await?;
    }
    if let Some(active) = req.is_active {
        sqlx::query("UPDATE users SET is_active = ? WHERE id = ?")
            .bind(active)
            .bind(&id)
            .execute(&state.db)
            .await?;
    }
    if let Some(pw) = &req.password {
        if pw.len() < 8 {
            return Err(AppError::BadRequest("密码至少 8 位".into()));
        }
        let hash = password::hash_password(pw)?;
        sqlx::query("UPDATE users SET password_hash = ? WHERE id = ?")
            .bind(hash)
            .bind(&id)
            .execute(&state.db)
            .await?;
    }

    audit::record(
        &state.db,
        Some(&admin.0.id),
        "update",
        "user",
        Some(&id),
        Some(json!({ "role": req.role, "is_active": req.is_active })),
        &meta,
    )
    .await?;

    let row = sqlx::query_as::<_, UserWithRoleRow>(
        "SELECT u.id, u.username, u.email, u.role, r.name as role_name, u.is_active, u.created_at \
         FROM users u \
         LEFT JOIN roles r ON u.role = r.id \
         WHERE u.id = ?"
    )
        .bind(&id)
        .fetch_one(&state.db)
        .await?;
    Ok(Json(UserDto::from(row)))
}

/// GET /users/options — 列出用户名与 ID 简易选项（供指派运维选择用，所有登录用户可读）。
pub async fn options(
    State(state): State<AppState>,
    _user: AuthUser,
) -> AppResult<Json<Vec<UserOptionDto>>> {
    let rows = sqlx::query_as::<_, (String, String)>(
        "SELECT id, username FROM users WHERE is_active = 1 ORDER BY username ASC"
    )
    .fetch_all(&state.db)
    .await?;
    
    let dtos = rows.into_iter().map(|(id, username)| {
        UserOptionDto { id, username }
    }).collect();
    Ok(Json(dtos))
}

/// DELETE /users/{id} — 删除用户（admin，不能删自己）。
pub async fn delete(
    State(state): State<AppState>,
    admin: AdminUser,
    Path(id): Path<String>,
    meta: RequestMeta,
) -> AppResult<Json<Value>> {
    if id == admin.0.id {
        return Err(AppError::BadRequest("不能删除自己".into()));
    }
    let res = sqlx::query("DELETE FROM users WHERE id = ?")
        .bind(&id)
        .execute(&state.db)
        .await?;
    if res.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }
    audit::record(&state.db, Some(&admin.0.id), "delete", "user", Some(&id), None, &meta).await?;
    Ok(Json(json!({ "ok": true })))
}
