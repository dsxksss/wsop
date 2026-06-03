use serde::Serialize;
use sqlx::FromRow;
use ts_rs::TS;

/// 部署实例数据库行 / DTO（字段一致，直接复用）。
#[derive(Debug, FromRow, Serialize, TS)]
#[ts(export, export_to = "../../../packages/shared/types/")]
pub struct Deployment {
    pub id: String,
    pub customer_id: String,
    pub product: String,
    pub version: Option<String>,
    pub environment: Option<String>,
    pub go_live_date: Option<String>,
    pub status: String,
    pub notes: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}
