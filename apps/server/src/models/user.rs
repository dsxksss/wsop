use serde::Serialize;
use sqlx::FromRow;
use ts_rs::TS;

/// 数据库行（含密码哈希，绝不直接返回给客户端）。
#[derive(Debug, FromRow)]
pub struct UserRow {
    pub id: String,
    pub username: String,
    pub email: String,
    pub password_hash: String,
    pub role: String,
    pub is_active: bool,
    pub created_at: String,
}

/// 对外 DTO（去掉密码哈希）。
#[derive(Debug, Serialize, TS)]
#[ts(export, export_to = "../../../packages/shared/types/")]
pub struct UserDto {
    pub id: String,
    pub username: String,
    pub email: String,
    pub role: String,
    pub is_active: bool,
    pub created_at: String,
}

impl From<UserRow> for UserDto {
    fn from(u: UserRow) -> Self {
        UserDto {
            id: u.id,
            username: u.username,
            email: u.email,
            role: u.role,
            is_active: u.is_active,
            created_at: u.created_at,
        }
    }
}
