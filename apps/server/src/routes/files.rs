use axum::{
    body::Body,
    extract::{Multipart, Path, Query, State},
    http::header,
    response::Response,
    Json,
};
use chrono::Utc;
use serde::Deserialize;
use serde_json::{json, Value};
use uuid::Uuid;

use crate::audit::{self, RequestMeta};
use crate::auth::extractor::AuthUser;
use crate::error::{AppError, AppResult};
use crate::models::file::{CustomerFile, FileBlobRow};
use crate::state::AppState;

const FILE_SELECT: &str = "SELECT f.id, f.customer_id, f.folder_path, f.filename, f.size_bytes, \
     f.mime_type, f.uploaded_by, u.username AS uploaded_by_username, f.created_at \
     FROM customer_files f LEFT JOIN users u ON u.id = f.uploaded_by";

#[derive(Deserialize)]
pub struct ListParams {
    pub folder: Option<String>,
}

/// GET /customers/{id}/files — 列出文件，可按 ?folder 过滤。任意登录用户可读。
pub async fn list(
    State(state): State<AppState>,
    _user: AuthUser,
    Path(customer_id): Path<String>,
    Query(params): Query<ListParams>,
) -> AppResult<Json<Vec<CustomerFile>>> {
    let rows = match params.folder.filter(|s| !s.is_empty()) {
        Some(folder) => {
            let sql =
                format!("{FILE_SELECT} WHERE f.customer_id = ? AND f.folder_path = ? ORDER BY f.created_at DESC");
            sqlx::query_as::<_, CustomerFile>(&sql)
                .bind(&customer_id)
                .bind(normalize_folder(&folder))
                .fetch_all(&state.db)
                .await?
        }
        None => {
            let sql = format!("{FILE_SELECT} WHERE f.customer_id = ? ORDER BY f.created_at DESC");
            sqlx::query_as::<_, CustomerFile>(&sql)
                .bind(&customer_id)
                .fetch_all(&state.db)
                .await?
        }
    };
    Ok(Json(rows))
}

/// POST /customers/{id}/files — 上传文件（admin / engineer）。
/// multipart 字段：`file`（必填），`folder`（可选，默认 `/`）。
pub async fn upload(
    State(state): State<AppState>,
    user: AuthUser,
    Path(customer_id): Path<String>,
    meta: RequestMeta,
    mut multipart: Multipart,
) -> AppResult<Json<CustomerFile>> {
    user.require_write()?;

    // 客户必须存在
    let exists: Option<(String,)> = sqlx::query_as("SELECT id FROM customers WHERE id = ?")
        .bind(&customer_id)
        .fetch_optional(&state.db)
        .await?;
    if exists.is_none() {
        return Err(AppError::NotFound);
    }

    let mut folder = "/".to_string();
    let mut filename: Option<String> = None;
    let mut mime: Option<String> = None;
    let mut data: Option<Vec<u8>> = None;

    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|e| AppError::BadRequest(format!("multipart 解析失败: {e}")))?
    {
        match field.name() {
            Some("folder") => {
                folder = field
                    .text()
                    .await
                    .map_err(|e| AppError::BadRequest(format!("folder 字段: {e}")))?;
            }
            Some("file") => {
                // file_name / content_type 借用 field，必须在 bytes() 之前取出
                filename = field.file_name().map(str::to_string);
                mime = field.content_type().map(str::to_string);
                let bytes = field
                    .bytes()
                    .await
                    .map_err(|e| AppError::BadRequest(format!("读取文件失败: {e}")))?;
                data = Some(bytes.to_vec());
            }
            _ => {}
        }
    }

    let raw_name = filename
        .map(|n| base_name(&n))
        .filter(|s| !s.is_empty())
        .ok_or_else(|| AppError::BadRequest("缺少 file 字段".into()))?;
    let data = data.ok_or_else(|| AppError::BadRequest("文件内容为空".into()))?;
    let folder = normalize_folder(&folder);
    let mime = mime
        .filter(|s| !s.is_empty())
        .or_else(|| mime_guess::from_path(&raw_name).first_raw().map(str::to_string));

    let id = Uuid::new_v4().to_string();
    let storage_key = format!("{customer_id}/{id}-{raw_name}");
    state.store.save(&storage_key, &data).await?;

    let now = Utc::now().to_rfc3339();
    let size = data.len() as i64;
    sqlx::query(
        "INSERT INTO customer_files \
         (id, customer_id, folder_path, filename, size_bytes, mime_type, storage_key, uploaded_by, created_at) \
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&customer_id)
    .bind(&folder)
    .bind(&raw_name)
    .bind(size)
    .bind(&mime)
    .bind(&storage_key)
    .bind(&user.id)
    .bind(&now)
    .execute(&state.db)
    .await?;

    audit::record(
        &state.db,
        Some(&user.id),
        "upload",
        "customer_file",
        Some(&id),
        Some(json!({ "customer_id": customer_id, "filename": raw_name, "size": size })),
        &meta,
    )
    .await?;

    let row = sqlx::query_as::<_, CustomerFile>(&format!("{FILE_SELECT} WHERE f.id = ?"))
        .bind(&id)
        .fetch_one(&state.db)
        .await?;
    Ok(Json(row))
}

/// GET /files/{id}/download — 下载文件。任意登录用户可读。
pub async fn download(
    State(state): State<AppState>,
    _user: AuthUser,
    Path(id): Path<String>,
) -> AppResult<Response> {
    let blob = sqlx::query_as::<_, FileBlobRow>(
        "SELECT storage_key, filename, mime_type FROM customer_files WHERE id = ?",
    )
    .bind(&id)
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound)?;

    let bytes = state.store.read(&blob.storage_key).await?;
    let mime = blob
        .mime_type
        .unwrap_or_else(|| "application/octet-stream".to_string());
    let disposition = format!(
        "attachment; filename*=UTF-8''{}",
        percent_encode(&blob.filename)
    );

    Response::builder()
        .header(header::CONTENT_TYPE, mime)
        .header(header::CONTENT_DISPOSITION, disposition)
        .body(Body::from(bytes))
        .map_err(|e| AppError::Internal(e.to_string()))
}

/// DELETE /files/{id} — 删除文件（admin / engineer），同时删磁盘文件。
pub async fn delete(
    State(state): State<AppState>,
    user: AuthUser,
    Path(id): Path<String>,
    meta: RequestMeta,
) -> AppResult<Json<Value>> {
    user.require_write()?;
    let blob = sqlx::query_as::<_, FileBlobRow>(
        "SELECT storage_key, filename, mime_type FROM customer_files WHERE id = ?",
    )
    .bind(&id)
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound)?;

    sqlx::query("DELETE FROM customer_files WHERE id = ?")
        .bind(&id)
        .execute(&state.db)
        .await?;
    state.store.delete(&blob.storage_key).await?;

    audit::record(&state.db, Some(&user.id), "delete", "customer_file", Some(&id), None, &meta)
        .await?;
    Ok(Json(json!({ "ok": true })))
}

/// 规范化虚拟目录：去空白、统一分隔符、保证前导 `/`、去末尾 `/`、剔除 `..`。
fn normalize_folder(input: &str) -> String {
    let s = input.trim().replace('\\', "/");
    let parts: Vec<&str> = s
        .split('/')
        .filter(|p| !p.is_empty() && *p != "." && *p != "..")
        .collect();
    if parts.is_empty() {
        "/".to_string()
    } else {
        format!("/{}", parts.join("/"))
    }
}

/// 取文件名（去掉任何路径成分，防目录穿越）。
fn base_name(name: &str) -> String {
    name.rsplit(['/', '\\']).next().unwrap_or(name).trim().to_string()
}

/// RFC 5987 风格的百分号编码（用于 Content-Disposition 的 filename*）。
fn percent_encode(s: &str) -> String {
    let mut out = String::new();
    for b in s.as_bytes() {
        let c = *b;
        let unreserved = c.is_ascii_alphanumeric()
            || matches!(c, b'-' | b'_' | b'.' | b'~');
        if unreserved {
            out.push(c as char);
        } else {
            out.push_str(&format!("%{c:02X}"));
        }
    }
    out
}
