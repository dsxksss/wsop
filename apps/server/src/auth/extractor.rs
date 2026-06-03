use axum::extract::FromRequestParts;
use axum::http::header::AUTHORIZATION;
use axum::http::request::Parts;

use crate::auth::jwt;
use crate::error::AppError;
use crate::models::role::RolePermissions;
use crate::state::AppState;

/// 已认证用户。从 `Authorization: Bearer <jwt>` 解析，并回查 DB 确认账户仍有效，
/// 读取**当前**角色和权限。
#[derive(Debug, Clone)]
pub struct AuthUser {
    pub id: String,
    pub username: String,
    pub role_id: String,
    pub role_name: Option<String>,
    pub permissions: RolePermissions,
}

impl AuthUser {
    /// 校验是否拥有某个操作权限。
    pub fn require_action(&self, action: &str) -> Result<(), AppError> {
        if self.role_id == "admin" || self.permissions.actions.iter().any(|a| a == action) {
            Ok(())
        } else {
            Err(AppError::Forbidden)
        }
    }

    pub fn require_admin(&self) -> Result<(), AppError> {
        if self.role_id == "admin" || self.permissions.actions.iter().any(|a| a == "manage:users" || a == "manage:roles") {
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

        let row = sqlx::query_as::<_, (String, String, Option<String>, Option<String>, bool)>(
            "SELECT u.username, u.role, r.name, r.permissions, u.is_active \
             FROM users u \
             LEFT JOIN roles r ON u.role = r.id \
             WHERE u.id = ?",
        )
        .bind(&claims.sub)
        .fetch_optional(&state.db)
        .await?;

        let (username, role_id, role_name, permissions_str, is_active) = row.ok_or(AppError::Unauthorized)?;
        if !is_active {
            return Err(AppError::Forbidden);
        }

        let permissions: RolePermissions = permissions_str
            .and_then(|s| serde_json::from_str(&s).ok())
            .unwrap_or_else(|| RolePermissions {
                data_scope: "assigned".to_string(),
                view_pages: vec![],
                actions: vec![],
            });

        Ok(AuthUser {
            id: claims.sub,
            username,
            role_id,
            role_name,
            permissions,
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
