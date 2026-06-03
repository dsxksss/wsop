use serde::Serialize;
use sqlx::FromRow;
use ts_rs::TS;

/// 审计日志（含操作者用户名，便于展示）。
#[derive(Debug, FromRow, Serialize, TS)]
#[ts(export, export_to = "../../../packages/shared/types/")]
pub struct AuditLog {
    pub id: String,
    pub actor_id: Option<String>,
    pub actor_username: Option<String>,
    pub action: String,
    pub entity_type: String,
    pub entity_id: Option<String>,
    /// JSON 文本形式的变更 diff。
    pub changes: Option<String>,
    pub ip: Option<String>,
    pub user_agent: Option<String>,
    pub created_at: String,
}
