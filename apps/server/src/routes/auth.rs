use axum::{extract::State, Json};
use serde::Deserialize;
use serde_json::{json, Value};

use crate::audit::{self, RequestMeta};
use crate::auth::extractor::AuthUser;
use crate::auth::{jwt, password};
use crate::error::{AppError, AppResult};
use crate::models::user::{UserDto, UserRow};
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

    Ok(Json(json!({ "token": token, "user": UserDto::from(user) })))
}

/// GET /auth/me — 返回当前用户。
pub async fn me(user: AuthUser) -> Json<Value> {
    Json(json!({
        "id": user.id,
        "username": user.username,
        "role": user.role.as_str(),
    }))
}
