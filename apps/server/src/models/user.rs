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

/// 包含角色名称的数据库查询行。
#[derive(Debug, FromRow)]
pub struct UserWithRoleRow {
    pub id: String,
    pub username: String,
    pub email: String,
    pub role: String,
    pub role_name: Option<String>,
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
    pub role_name: Option<String>,
    pub is_active: bool,
    pub created_at: String,
}

/// 简易用户选项 DTO（供指派或下拉选择使用）。
#[derive(Debug, Serialize, TS)]
#[ts(export, export_to = "../../../packages/shared/types/")]
pub struct UserOptionDto {
    pub id: String,
    pub username: String,
}

impl From<UserWithRoleRow> for UserDto {
    fn from(u: UserWithRoleRow) -> Self {
        UserDto {
            id: u.id,
            username: u.username,
            email: u.email,
            role: u.role,
            role_name: u.role_name,
            is_active: u.is_active,
            created_at: u.created_at,
        }
    }
}

impl From<UserRow> for UserDto {
    fn from(u: UserRow) -> Self {
        UserDto {
            id: u.id,
            username: u.username,
            email: u.email,
            role: u.role,
            role_name: None,
            is_active: u.is_active,
            created_at: u.created_at,
        }
    }
}
