use serde::Serialize;
use sqlx::FromRow;
use ts_rs::TS;

/// 列表/详情行：客户 + 维护汇总（维护次数 / 最近维护时间 / 在用部署数）。
#[derive(Debug, FromRow)]
pub struct CustomerSummaryRow {
    pub id: String,
    pub name: String,
    pub short_name: Option<String>,
    pub industry: Option<String>,
    pub contact_name: Option<String>,
    pub contact_phone: Option<String>,
    pub contact_email: Option<String>,
    pub address: Option<String>,
    pub notes: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub maintenance_count: i64,
    pub last_maintained_at: Option<String>,
    pub active_deployments: i64,
}

/// 客户 + 汇总 DTO（对外）。
#[derive(Debug, Serialize, TS)]
#[ts(export, export_to = "../../../packages/shared/types/")]
pub struct CustomerSummaryDto {
    pub id: String,
    pub name: String,
    pub short_name: Option<String>,
    pub industry: Option<String>,
    pub contact_name: Option<String>,
    pub contact_phone: Option<String>,
    pub contact_email: Option<String>,
    pub address: Option<String>,
    pub notes: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    /// 已完成的维护记录数。
    #[ts(type = "number")]
    pub maintenance_count: i64,
    /// 最近一次完成维护的时间（ISO8601）。
    pub last_maintained_at: Option<String>,
    /// 在用部署实例数。
    #[ts(type = "number")]
    pub active_deployments: i64,
}

impl From<CustomerSummaryRow> for CustomerSummaryDto {
    fn from(c: CustomerSummaryRow) -> Self {
        CustomerSummaryDto {
            id: c.id,
            name: c.name,
            short_name: c.short_name,
            industry: c.industry,
            contact_name: c.contact_name,
            contact_phone: c.contact_phone,
            contact_email: c.contact_email,
            address: c.address,
            notes: c.notes,
            created_at: c.created_at,
            updated_at: c.updated_at,
            maintenance_count: c.maintenance_count,
            last_maintained_at: c.last_maintained_at,
            active_deployments: c.active_deployments,
        }
    }
}
