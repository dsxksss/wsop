use serde::Serialize;
use sqlx::FromRow;
use ts_rs::TS;

/// 站内通知（列表项，联查客户名便于展示/跳转）。
#[derive(Debug, FromRow, Serialize, TS)]
#[ts(export, export_to = "../../../packages/shared/types/")]
pub struct NotificationDto {
    pub id: String,
    pub user_id: String,
    #[sqlx(rename = "type")]
    #[serde(rename = "type")]
    pub r#type: String,
    pub title: String,
    pub body: Option<String>,
    pub customer_id: Option<String>,
    pub customer_name: Option<String>,
    pub read_at: Option<String>,
    pub created_at: String,
}
