use serde::Serialize;
use sqlx::FromRow;
use ts_rs::TS;

/// 维护记录完整行 / DTO（详情用）。
#[derive(Debug, FromRow, Serialize, TS)]
#[ts(export, export_to = "../../../packages/shared/types/")]
pub struct MaintenanceRecord {
    pub id: String,
    pub customer_id: String,
    pub deployment_id: Option<String>,
    pub title: String,
    #[sqlx(rename = "type")]
    #[serde(rename = "type")]
    pub r#type: String,
    pub status: String,
    pub content: Option<String>,
    pub result: Option<String>,
    pub maintained_at: String,
    pub completed_at: Option<String>,
    pub created_by: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    #[sqlx(skip)]
    pub assignees: Option<Vec<crate::models::user::UserOptionDto>>,
}

/// 列表项：维护记录 + 客户名 + 负责人（便于直接展示）。
#[derive(Debug, FromRow, Serialize, TS)]
#[ts(export, export_to = "../../../packages/shared/types/")]
pub struct MaintenanceListItem {
    pub id: String,
    pub customer_id: String,
    pub customer_name: String,
    pub deployment_id: Option<String>,
    pub title: String,
    #[sqlx(rename = "type")]
    #[serde(rename = "type")]
    pub r#type: String,
    pub status: String,
    pub maintained_at: String,
    pub completed_at: Option<String>,
    pub created_at: String,
    #[sqlx(skip)]
    pub assignees: Option<Vec<crate::models::user::UserOptionDto>>,
}

/// 维护跟进备注。
#[derive(Debug, FromRow, Serialize, TS)]
#[ts(export, export_to = "../../../packages/shared/types/")]
pub struct MaintenanceNote {
    pub id: String,
    pub record_id: String,
    pub author_id: Option<String>,
    pub author_username: Option<String>,
    pub note: String,
    pub created_at: String,
}
