use serde::Serialize;
use sqlx::FromRow;
use ts_rs::TS;

/// 客户文件（对外，不含磁盘 storage_key）。
#[derive(Debug, FromRow, Serialize, TS)]
#[ts(export, export_to = "../../../packages/shared/types/")]
pub struct CustomerFile {
    pub id: String,
    pub customer_id: String,
    pub folder_path: String,
    pub filename: String,
    #[ts(type = "number")]
    pub size_bytes: i64,
    pub mime_type: Option<String>,
    pub uploaded_by: Option<String>,
    pub uploaded_by_username: Option<String>,
    pub created_at: String,
}

/// 下载用的内部行（含 storage_key，不对外）。
#[derive(Debug, FromRow)]
pub struct FileBlobRow {
    pub storage_key: String,
    pub filename: String,
    pub mime_type: Option<String>,
}
