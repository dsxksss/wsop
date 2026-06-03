//! 开发期演示数据填充。
//!
//! 仅当环境变量 `SEED_DEMO` 为真值（`1` / `true` / `yes`）且 `customers` 表为空时执行，
//! 一次性写入覆盖所有模块的假数据（用户 / 客户 / 部署 / 远程连接 / 维护记录 + 跟进 /
//! 文件空间 / 审计日志），方便前端调试各处显示样式。生产环境不要设置该变量。

use chrono::{Duration, Utc};
use uuid::Uuid;

use crate::state::AppState;

fn uid() -> String {
    Uuid::new_v4().to_string()
}

/// 相对“现在”的 ISO8601 时间（n 天前、m 小时前）。
fn ago(days: i64, hours: i64) -> String {
    (Utc::now() - Duration::days(days) - Duration::hours(hours)).to_rfc3339()
}

/// 是否启用演示数据填充。
pub fn enabled() -> bool {
    matches!(
        std::env::var("SEED_DEMO").unwrap_or_default().to_lowercase().as_str(),
        "1" | "true" | "yes" | "on"
    )
}

pub async fn seed_demo(state: &AppState) -> Result<(), Box<dyn std::error::Error>> {
    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM customers")
        .fetch_one(&state.db)
        .await?;
    if count > 0 {
        tracing::info!("SEED_DEMO: customers already present, skip demo seeding");
        return Ok(());
    }
    tracing::info!("SEED_DEMO: inserting demo data …");

    let db = &state.db;
    let hash = crate::auth::password::hash_password("engineer123")?;
    let vhash = crate::auth::password::hash_password("viewer123")?;

    // ---- 用户 ----------------------------------------------------------
    let eng1 = uid();
    let eng2 = uid();
    let viewer = uid();
    let users = [
        (&eng1, "eng1", "eng1@example.com", &hash, "engineer"),
        (&eng2, "eng2", "eng2@example.com", &hash, "engineer"),
        (&viewer, "viewer1", "viewer1@example.com", &vhash, "viewer"),
    ];
    for (id, username, email, ph, role) in users {
        sqlx::query(
            "INSERT INTO users (id, username, email, password_hash, role, is_active, created_at) \
             VALUES (?, ?, ?, ?, ?, 1, ?)",
        )
        .bind(id)
        .bind(username)
        .bind(email)
        .bind(ph)
        .bind(role)
        .bind(ago(120, 0))
        .execute(db)
        .await?;
    }

    // admin id（seed_admin 已建）。
    let admin: String = sqlx::query_scalar("SELECT id FROM users WHERE role = 'admin' LIMIT 1")
        .fetch_one(db)
        .await?;

    // ---- 客户（含派生的部署 / 连接 / 维护 / 文件 / 审计）---------------
    struct CustomerSpec {
        name: &'static str,
        short: &'static str,
        industry: &'static str,
        contact: &'static str,
        phone: &'static str,
        email: &'static str,
        address: &'static str,
        notes: &'static str,
    }

    let customers = [
        CustomerSpec {
            name: "晨星生物科技有限公司",
            short: "晨星生物",
            industry: "生物医药",
            contact: "李明",
            phone: "13800138001",
            email: "liming@chenxing-bio.com",
            address: "上海市浦东新区张江高科技园区",
            notes: "重点客户，私有化部署 Wemol 全模块。",
        },
        CustomerSpec {
            name: "瀚海制药集团",
            short: "瀚海制药",
            industry: "制药",
            contact: "王芳",
            phone: "13900139002",
            email: "wangfang@hanhai-pharma.com",
            address: "北京市昌平区生命科学园",
            notes: "两套环境：生产 + 测试。",
        },
        CustomerSpec {
            name: "广研新材料股份",
            short: "广研新材",
            industry: "新材料",
            contact: "陈刚",
            phone: "13700137003",
            email: "chengang@gy-materials.com",
            address: "广州市黄埔区科学城",
            notes: "仅小分子相关模块。",
        },
        CustomerSpec {
            name: "云图医疗器械",
            short: "云图医疗",
            industry: "医疗器械",
            contact: "赵雪",
            phone: "13600136004",
            email: "zhaoxue@yuntu-med.com",
            address: "深圳市南山区高新园",
            notes: "新签约，部署进行中。",
        },
    ];

    // 用于构造不同形态的部署 / 维护，每个客户的 index 决定差异。
    for (ci, c) in customers.iter().enumerate() {
        let cust_id = uid();
        let created_by = if ci % 2 == 0 { &eng1 } else { &eng2 };
        let base_day = 90 - (ci as i64) * 18; // 越靠后的客户越新
        sqlx::query(
            "INSERT INTO customers \
             (id, name, short_name, industry, contact_name, contact_phone, contact_email, address, notes, created_by, created_at, updated_at) \
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(&cust_id)
        .bind(c.name)
        .bind(c.short)
        .bind(c.industry)
        .bind(c.contact)
        .bind(c.phone)
        .bind(c.email)
        .bind(c.address)
        .bind(c.notes)
        .bind(created_by)
        .bind(ago(base_day, 0))
        .bind(ago(base_day, 0))
        .execute(db)
        .await?;
        audit(state, Some(created_by), "create", "customer", Some(&cust_id), ago(base_day, 0)).await?;

        // -- 部署 --
        let depl_id = uid();
        let (status, modules, mod_count) = match ci {
            0 => ("active", "大分子、小分子、MD", 3),
            1 => ("active", "小分子、MD", 2),
            2 => ("active", "小分子", 1),
            _ => ("active", "仅框架", 0),
        };
        sqlx::query(
            "INSERT INTO deployments \
             (id, customer_id, product, version, environment, go_live_date, status, notes, \
              approval_no, submitted_at, department, purpose, concurrency_limit, user_count, \
              license_expiry, module_count, modules, created_at, updated_at) \
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(&depl_id)
        .bind(&cust_id)
        .bind("Wemol")
        .bind(format!("v3.{}.0", ci + 1))
        .bind(if ci == 1 { "生产" } else { "生产" })
        .bind(ago(base_day - 2, 0)[..10].to_string())
        .bind(status)
        .bind("私有化部署，内网环境。")
        .bind(format!("{}{:04}", &ago(base_day, 0)[..10].replace('-', ""), 1000 + ci))
        .bind(ago(base_day - 1, 0))
        .bind(["上海", "北京", "广州", "上海"][ci])
        .bind("药物研发计算平台")
        .bind(20_i64 + (ci as i64) * 10)
        .bind(50_i64 + (ci as i64) * 20)
        .bind(ago(-365, 0)[..10].to_string()) // licence 一年后到期
        .bind(mod_count as i64)
        .bind(modules)
        .bind(ago(base_day - 2, 0))
        .bind(ago(base_day - 2, 0))
        .execute(db)
        .await?;
        audit(state, Some(created_by), "create", "deployment", Some(&depl_id), ago(base_day - 2, 0)).await?;

        // 第二套（测试）环境，给第 1 个客户。
        if ci == 1 {
            let depl2 = uid();
            sqlx::query(
                "INSERT INTO deployments \
                 (id, customer_id, product, version, environment, go_live_date, status, notes, \
                  approval_no, submitted_at, department, purpose, concurrency_limit, user_count, \
                  license_expiry, module_count, modules, created_at, updated_at) \
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            )
            .bind(&depl2)
            .bind(&cust_id)
            .bind("Wemol")
            .bind("v3.1.0")
            .bind("测试")
            .bind(ago(base_day - 2, 0)[..10].to_string())
            .bind("retired")
            .bind("早期测试环境，已退役。")
            .bind(Option::<String>::None)
            .bind(Option::<String>::None)
            .bind("北京")
            .bind("POC 验证")
            .bind(Option::<i64>::None)
            .bind(Option::<i64>::None)
            .bind(Option::<String>::None)
            .bind(0_i64)
            .bind(Option::<String>::None)
            .bind(ago(base_day, 0))
            .bind(ago(base_day - 30, 0))
            .execute(db)
            .await?;
        }

        // -- 远程连接 --
        let conn_id = uid();
        let conn_info = serde_json::json!({
            "front_url": format!("https://wemol-{}.intra.local", c.short),
            "front_accounts": [
                { "username": "ops", "password": "Ops@2024" },
                { "username": "researcher", "password": "Res#1234" }
            ],
            "back_url": format!("https://wemol-{}.intra.local:8443/admin", c.short),
            "back_accounts": [ { "username": "admin", "password": "Adm!n2024" } ],
            "ssh_connections": [
                { "host": format!("10.0.{}.10", ci + 1), "port": "22", "username": "root", "password": "r00t@ssh" }
            ],
            "description": "内网堡垒机跳转后访问。"
        })
        .to_string();
        sqlx::query(
            "INSERT INTO customer_remote_connections \
             (id, customer_id, name, wemol_username, wemol_password, connection_info, created_at, updated_at) \
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(&conn_id)
        .bind(&cust_id)
        .bind("生产环境")
        .bind("ops")
        .bind("Ops@2024")
        .bind(&conn_info)
        .bind(ago(base_day - 3, 0))
        .bind(ago(base_day - 3, 0))
        .execute(db)
        .await?;
        audit(state, Some(created_by), "create", "remote_connection", Some(&conn_id), ago(base_day - 3, 0)).await?;

        // -- 维护记录（混合类型 / 状态）--
        let assignees = [&eng1, &eng2];
        let maint_specs: &[(&str, &str, &str, bool, i64)] = match ci {
            3 => &[
                ("首次部署上线", "deploy", "私有化环境初始化与部署", false, 1),
            ],
            _ => &[
                ("首次部署上线", "deploy", "私有化环境初始化、安装 Wemol、联调验收", true, base_day - 2),
                ("v3 版本升级", "upgrade", "升级到最新大版本，迁移配置", true, base_day - 25),
                ("季度巡检", "inspection", "检查磁盘、许可、备份与服务健康", true, base_day - 50),
                ("登录异常排查", "incident", "用户反馈无法登录，排查反向代理", false, 3),
            ],
        };
        for (mi, (title, ty, content, done, day)) in maint_specs.iter().enumerate() {
            let rec_id = uid();
            let assignee = assignees[mi % 2];
            let maintained_at = ago(*day, 2);
            let (status, completed_at, result) = if *done {
                ("done", Some(ago(*day, 0)), Some("处理完成，已验收。".to_string()))
            } else {
                ("in_progress", None, None)
            };
            sqlx::query(
                "INSERT INTO maintenance_records \
                 (id, customer_id, deployment_id, title, type, status, assignee_id, content, result, \
                  maintained_at, completed_at, created_by, created_at, updated_at) \
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            )
            .bind(&rec_id)
            .bind(&cust_id)
            .bind(&depl_id)
            .bind(*title)
            .bind(*ty)
            .bind(status)
            .bind(assignee)
            .bind(*content)
            .bind(&result)
            .bind(&maintained_at)
            .bind(&completed_at)
            .bind(created_by)
            .bind(&maintained_at)
            .bind(completed_at.clone().unwrap_or(maintained_at.clone()))
            .execute(db)
            .await?;
            audit(state, Some(assignee), "create", "maintenance_record", Some(&rec_id), maintained_at.clone()).await?;
            if status == "done" {
                audit(state, Some(assignee), "complete", "maintenance_record", Some(&rec_id), completed_at.clone().unwrap()).await?;
            }

            // 给进行中的记录加一条跟进。
            if status == "in_progress" {
                let note_id = uid();
                sqlx::query(
                    "INSERT INTO maintenance_notes (id, record_id, author_id, note, created_at) \
                     VALUES (?, ?, ?, ?, ?)",
                )
                .bind(&note_id)
                .bind(&rec_id)
                .bind(assignee)
                .bind("已定位到反向代理超时配置，待客户确认窗口期重启。")
                .bind(ago(*day, 1))
                .execute(db)
                .await?;
            }
        }

        // -- 文件空间 --
        let file_specs: &[(&str, &str, &str, &str)] = &[
            ("/部署文档", "部署手册.md", "text/markdown", "# Wemol 部署手册\n\n演示文件。\n"),
            ("/部署文档", "网络拓扑.txt", "text/plain", "backend <-> frontend <-> bastion\n"),
            ("/交付物", "验收报告.txt", "text/plain", "验收通过。\n"),
        ];
        for (folder, fname, mime, content) in file_specs {
            let file_id = uid();
            let bytes = content.as_bytes();
            let storage_key = format!("{}/{}-{}", cust_id, file_id, fname);
            state.store.save(&storage_key, bytes).await?;
            sqlx::query(
                "INSERT INTO customer_files \
                 (id, customer_id, folder_path, filename, size_bytes, mime_type, storage_key, uploaded_by, created_at) \
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            )
            .bind(&file_id)
            .bind(&cust_id)
            .bind(*folder)
            .bind(*fname)
            .bind(bytes.len() as i64)
            .bind(*mime)
            .bind(&storage_key)
            .bind(created_by)
            .bind(ago(base_day - 4, 0))
            .execute(db)
            .await?;
            audit(state, Some(created_by), "upload", "file", Some(&file_id), ago(base_day - 4, 0)).await?;
        }
    }

    // 一些额外的审计：登录 / 用户管理。
    audit(state, Some(&admin), "login", "auth", None, ago(0, 1)).await?;
    audit(state, Some(&admin), "create", "user", Some(&eng1), ago(120, 0)).await?;
    audit(state, Some(&admin), "create", "user", Some(&viewer), ago(120, 0)).await?;

    tracing::info!("SEED_DEMO: done ({} customers + users/deployments/maintenance/files/audit)", customers.len());
    Ok(())
}

/// 写一条带自定义时间戳的审计（绕过 RequestMeta，演示用）。
async fn audit(
    state: &AppState,
    actor: Option<&str>,
    action: &str,
    entity_type: &str,
    entity_id: Option<&str>,
    created_at: String,
) -> Result<(), Box<dyn std::error::Error>> {
    sqlx::query(
        "INSERT INTO audit_logs \
         (id, actor_id, action, entity_type, entity_id, changes, ip, user_agent, created_at) \
         VALUES (?, ?, ?, ?, ?, NULL, '127.0.0.1', 'seed-demo', ?)",
    )
    .bind(uid())
    .bind(actor)
    .bind(action)
    .bind(entity_type)
    .bind(entity_id)
    .bind(created_at)
    .execute(&state.db)
    .await?;
    Ok(())
}
