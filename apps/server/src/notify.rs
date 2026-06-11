use chrono::{Months, Utc};
use sqlx::SqlitePool;
use uuid::Uuid;

use crate::error::AppResult;

/// 读取维护提醒阈值（月数），默认 6。
pub async fn due_months(db: &SqlitePool) -> AppResult<u32> {
    let v: Option<String> =
        sqlx::query_scalar("SELECT value FROM app_settings WHERE key = 'maintenance_due_months'")
            .fetch_optional(db)
            .await?;
    Ok(v.and_then(|s| s.parse().ok()).unwrap_or(6))
}

pub async fn set_due_months(db: &SqlitePool, months: u32) -> AppResult<()> {
    sqlx::query(
        "INSERT INTO app_settings (key, value, updated_at) VALUES ('maintenance_due_months', ?, ?) \
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
    )
    .bind(months.to_string())
    .bind(Utc::now().to_rfc3339())
    .execute(db)
    .await?;
    Ok(())
}

/// 扫描超期未维护客户并生成提醒通知。
///
/// 超期口径与客户列表一致：最近一次已完成维护 = MAX(maintained_at) WHERE status='done'；
/// 基准为「客户最近一次授权审批的提交时间（deployments.submitted_at）」；
/// 没有任何授权提交时间的客户不提醒。每个 (用户, 客户) 30 天内不重复生成（实现"每 30 天再提醒"）。
pub async fn scan_due_customers(db: &SqlitePool) -> AppResult<usize> {
    let months = due_months(db).await?;
    let now = Utc::now();
    let cutoff = now
        .checked_sub_months(Months::new(months))
        .unwrap_or(now)
        .to_rfc3339();
    let repeat_cutoff = now
        .checked_sub_days(chrono::Days::new(30))
        .unwrap_or(now)
        .to_rfc3339();

    // 超期客户 + 最近一次授权提交时间。submitted_at 存为 YYYY-MM-DD，与 ISO8601 cutoff 字典序可比。
    // INNER JOIN + IS NOT NULL 天然排除没有授权提交时间的客户。
    let due: Vec<(String, String, String)> = sqlx::query_as(
        "SELECT c.id, c.name, MAX(d.submitted_at) AS last_submit \
         FROM customers c \
         JOIN deployments d ON d.customer_id = c.id \
         WHERE d.submitted_at IS NOT NULL AND d.submitted_at != '' \
         GROUP BY c.id, c.name \
         HAVING MAX(d.submitted_at) < ?",
    )
    .bind(&cutoff)
    .fetch_all(db)
    .await?;

    let mut created = 0usize;
    for (customer_id, customer_name, last_submit) in due {
        // 接收人：指派运维优先；无指派则所有活跃 admin/engineer。
        let mut recipients: Vec<String> = sqlx::query_scalar(
            "SELECT u.id FROM users u \
             JOIN customer_assignments ca ON ca.user_id = u.id \
             WHERE ca.customer_id = ? AND u.is_active = 1",
        )
        .bind(&customer_id)
        .fetch_all(db)
        .await?;
        if recipients.is_empty() {
            recipients = sqlx::query_scalar(
                "SELECT id FROM users WHERE role IN ('admin', 'engineer') AND is_active = 1",
            )
            .fetch_all(db)
            .await?;
        }

        let title = format!("客户「{customer_name}」授权已超过 {months} 个月未更新");
        let body = format!(
            "最近一次授权审批提交于 {}，请主动联系客户安排维护升级。",
            &last_submit[..last_submit.len().min(10)]
        );

        for user_id in recipients {
            // 30 天内已提醒过（无论已读与否）则跳过。
            let exists: i64 = sqlx::query_scalar(
                "SELECT COUNT(*) FROM notifications \
                 WHERE user_id = ? AND customer_id = ? AND type = 'maintenance_due' \
                 AND created_at > ?",
            )
            .bind(&user_id)
            .bind(&customer_id)
            .bind(&repeat_cutoff)
            .fetch_one(db)
            .await?;
            if exists > 0 {
                continue;
            }

            sqlx::query(
                "INSERT INTO notifications (id, user_id, type, title, body, customer_id, created_at) \
                 VALUES (?, ?, 'maintenance_due', ?, ?, ?, ?)",
            )
            .bind(Uuid::new_v4().to_string())
            .bind(&user_id)
            .bind(&title)
            .bind(&body)
            .bind(&customer_id)
            .bind(now.to_rfc3339())
            .execute(db)
            .await?;
            created += 1;
        }
    }

    if created > 0 {
        tracing::info!("维护提醒扫描：新生成 {created} 条通知");
    }
    Ok(created)
}

/// 后台循环：启动后稍等先扫一次，之后每小时扫一次。
pub fn spawn_scanner(db: SqlitePool) {
    tokio::spawn(async move {
        tokio::time::sleep(std::time::Duration::from_secs(5)).await;
        loop {
            if let Err(e) = scan_due_customers(&db).await {
                tracing::warn!("维护提醒扫描失败: {e:?}");
            }
            tokio::time::sleep(std::time::Duration::from_secs(3600)).await;
        }
    });
}
