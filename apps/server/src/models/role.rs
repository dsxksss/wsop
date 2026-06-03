use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use ts_rs::TS;

#[derive(Debug, Serialize, Deserialize, Clone, TS)]
#[ts(export, export_to = "../../../packages/shared/types/")]
pub struct RolePermissions {
    pub data_scope: String,       // "all" | "assigned"
    pub view_pages: Vec<String>,  // e.g. ["dashboard", "customers", "maintenance", "users", "audit"]
    pub actions: Vec<String>,     // e.g. ["write:customers", "delete:customers", ...]
}

#[derive(Debug, FromRow, Serialize, TS)]
#[ts(export, export_to = "../../../packages/shared/types/")]
pub struct RoleDto {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub permissions: String, // Raw JSON string in database
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, TS)]
#[ts(export, export_to = "../../../packages/shared/types/")]
pub struct RoleResponseDto {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub permissions: RolePermissions,
    pub created_at: String,
    pub updated_at: String,
}

impl RoleDto {
    pub fn into_response(self) -> RoleResponseDto {
        let permissions: RolePermissions = serde_json::from_str(&self.permissions)
            .unwrap_or_else(|_| RolePermissions {
                data_scope: "assigned".to_string(),
                view_pages: vec![],
                actions: vec![],
            });
        RoleResponseDto {
            id: self.id,
            name: self.name,
            description: self.description,
            permissions,
            created_at: self.created_at,
            updated_at: self.updated_at,
        }
    }
}
