use axum::extract::FromRequestParts;
use axum::http::header::AUTHORIZATION;
use axum::http::request::Parts;

use crate::auth::{jwt, Role};
use crate::error::AppError;
use crate::state::AppState;

/// 已认证用户。从 `Authorization: Bearer <jwt>` 解析，并回查 DB 确认账户仍有效，
/// 读取**当前**角色（避免 token 内角色过期）。
#[derive(Debug, Clone)]
pub struct AuthUser {
    pub id: String,
    pub username: String,
    pub role: Role,
}

impl AuthUser {
    pub fn require(&self, role: Role) -> Result<(), AppError> {
        if self.role == role {
            Ok(())
        } else {
            Err(AppError::Forbidden)
        }
    }

    pub fn require_admin(&self) -> Result<(), AppError> {
        self.require(Role::Admin)
    }

    /// 要求具备写权限（admin / engineer）。
    pub fn require_write(&self) -> Result<(), AppError> {
        if self.role.can_write() {
            Ok(())
        } else {
            Err(AppError::Forbidden)
        }
    }
}

impl FromRequestParts<AppState> for AuthUser {
    type Rejection = AppError;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &AppState,
    ) -> Result<Self, Self::Rejection> {
        let header = parts
            .headers
            .get(AUTHORIZATION)
            .and_then(|v| v.to_str().ok())
            .ok_or(AppError::Unauthorized)?;
        let token = header.strip_prefix("Bearer ").ok_or(AppError::Unauthorized)?;
        let claims = jwt::verify(&state.config.jwt_secret, token)?;

        let row = sqlx::query_as::<_, (String, String, bool)>(
            "SELECT username, role, is_active FROM users WHERE id = ?",
        )
        .bind(&claims.sub)
        .fetch_optional(&state.db)
        .await?;

        let (username, role, is_active) = row.ok_or(AppError::Unauthorized)?;
        if !is_active {
            return Err(AppError::Forbidden);
        }
        let role = Role::parse(&role).ok_or(AppError::Unauthorized)?;
        Ok(AuthUser {
            id: claims.sub,
            username,
            role,
        })
    }
}

/// 仅管理员可用的提取器。
pub struct AdminUser(pub AuthUser);

impl FromRequestParts<AppState> for AdminUser {
    type Rejection = AppError;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &AppState,
    ) -> Result<Self, Self::Rejection> {
        let user = AuthUser::from_request_parts(parts, state).await?;
        user.require_admin()?;
        Ok(AdminUser(user))
    }
}
