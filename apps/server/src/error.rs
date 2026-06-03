use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde_json::json;

/// 统一的应用错误类型，直接实现 IntoResponse 以返回规范的 JSON 错误体。
#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("{0}")]
    BadRequest(String),
    #[error("未认证")]
    Unauthorized,
    #[error("无权限")]
    Forbidden,
    #[error("资源不存在")]
    NotFound,
    #[error("{0}")]
    Conflict(String),
    #[error(transparent)]
    Db(#[from] sqlx::Error),
    #[error("{0}")]
    Internal(String),
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, msg) = match &self {
            AppError::BadRequest(m) => (StatusCode::BAD_REQUEST, m.clone()),
            AppError::Unauthorized => (StatusCode::UNAUTHORIZED, self.to_string()),
            AppError::Forbidden => (StatusCode::FORBIDDEN, self.to_string()),
            AppError::NotFound => (StatusCode::NOT_FOUND, self.to_string()),
            AppError::Conflict(m) => (StatusCode::CONFLICT, m.clone()),
            AppError::Db(e) => {
                tracing::error!("db error: {e:?}");
                (StatusCode::INTERNAL_SERVER_ERROR, "数据库错误".into())
            }
            AppError::Internal(m) => {
                tracing::error!("internal error: {m}");
                (StatusCode::INTERNAL_SERVER_ERROR, "内部错误".into())
            }
        };
        (status, Json(json!({ "error": msg }))).into_response()
    }
}

pub type AppResult<T> = Result<T, AppError>;

/// SQLite 唯一约束冲突判定（用于把 INSERT 冲突映射成 409）。
pub fn is_unique_violation(e: &sqlx::Error) -> bool {
    if let sqlx::Error::Database(db) = e {
        return db.code().as_deref() == Some("2067")
            || db.code().as_deref() == Some("1555")
            || db.message().contains("UNIQUE");
    }
    false
}
