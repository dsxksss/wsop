use axum::{extract::State, Json};
use serde::Deserialize;
use serde_json::{json, Value};

use crate::audit::{self, RequestMeta};
use crate::auth::extractor::AuthUser;
use crate::auth::{jwt, password};
use crate::error::{AppError, AppResult};
use crate::models::user::UserRow;
use crate::state::AppState;

#[derive(Deserialize)]
pub struct LoginReq {
    pub username: String,
    pub password: String,
}

/// POST /auth/login — 校验密码并签发 JWT。
pub async fn login(
    State(state): State<AppState>,
    meta: RequestMeta,
    Json(req): Json<LoginReq>,
) -> AppResult<Json<Value>> {
    let user = sqlx::query_as::<_, UserRow>("SELECT * FROM users WHERE username = ?")
        .bind(&req.username)
        .fetch_optional(&state.db)
        .await?
        .ok_or(AppError::Unauthorized)?;

    if !user.is_active {
        return Err(AppError::Forbidden);
    }
    if !password::verify_password(&req.password, &user.password_hash) {
        return Err(AppError::Unauthorized);
    }

    let token = jwt::issue(&state.config.jwt_secret, &user.id, &user.username, &user.role)?;
    // 登录审计失败不应阻断登录
    let _ = audit::record(&state.db, Some(&user.id), "login", "user", Some(&user.id), None, &meta)
        .await;

    let role_row = sqlx::query_as::<_, (Option<String>, Option<String>)>(
        "SELECT name, permissions FROM roles WHERE id = ?"
    )
    .bind(&user.role)
    .fetch_optional(&state.db)
    .await?;
    
    let (role_name, permissions_str) = role_row
        .map(|(n, p)| (n, p))
        .unwrap_or((None, None));
    
    let permissions: crate::models::role::RolePermissions = permissions_str
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_else(|| crate::models::role::RolePermissions {
            data_scope: "assigned".to_string(),
            view_pages: vec![],
            actions: vec![],
        });

    Ok(Json(json!({
        "token": token,
        "user": {
            "id": user.id,
            "username": user.username,
            "role": user.role,
            "role_name": role_name,
            "permissions": permissions,
        }
    })))
}

/// GET /auth/me — 返回当前用户。
pub async fn me(user: AuthUser) -> Json<Value> {
    Json(json!({
        "id": user.id,
        "username": user.username,
        "role": user.role_id,
        "role_name": user.role_name,
        "permissions": user.permissions,
    }))
}
