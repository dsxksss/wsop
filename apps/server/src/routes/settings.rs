use axum::{extract::State, Json};
use serde::Deserialize;
use serde_json::{json, Value};

use crate::audit::{self, RequestMeta};
use crate::auth::extractor::{AdminUser, AuthUser};
use crate::error::{AppError, AppResult};
use crate::notify;
use crate::state::AppState;

/// GET /settings/maintenance-due — 维护提醒阈值（月数），所有登录用户可读。
pub async fn get_maintenance_due(
    State(state): State<AppState>,
    _user: AuthUser,
) -> AppResult<Json<Value>> {
    let months = notify::due_months(&state.db).await?;
    Ok(Json(json!({ "months": months })))
}

#[derive(Deserialize)]
pub struct UpdateMaintenanceDue {
    pub months: u32,
}

/// PUT /settings/maintenance-due — 修改阈值（仅管理员），改完立即重扫。
pub async fn update_maintenance_due(
    State(state): State<AppState>,
    AdminUser(user): AdminUser,
    meta: RequestMeta,
    Json(body): Json<UpdateMaintenanceDue>,
) -> AppResult<Json<Value>> {
    if body.months == 0 || body.months > 120 {
        return Err(AppError::BadRequest("阈值需在 1-120 个月之间".into()));
    }
    let old = notify::due_months(&state.db).await?;
    notify::set_due_months(&state.db, body.months).await?;

    let _ = audit::record(
        &state.db,
        Some(&user.id),
        "update",
        "settings",
        Some("maintenance_due_months"),
        Some(json!({ "from": old, "to": body.months })),
        &meta,
    )
    .await;

    // 立即按新阈值重扫一次，让效果即时可见。
    let db = state.db.clone();
    tokio::spawn(async move {
        if let Err(e) = notify::scan_due_customers(&db).await {
            tracing::warn!("维护提醒扫描失败: {e:?}");
        }
    });

    Ok(Json(json!({ "months": body.months })))
}
