use std::path::{Path, PathBuf};

use crate::error::{AppError, AppResult};

/// 本地文件存储。`storage_key` 是相对 root 的路径（如 `<customer_id>/<uuid>-<name>`）。
///
/// 这是一个刻意保持简单的实现；未来要换 MinIO/S3 时，把这几个方法抽成 `FileStore` trait
/// 再加一个实现即可，调用方（routes/files.rs）只依赖这几个方法。
pub struct LocalFileStore {
    root: PathBuf,
}

impl LocalFileStore {
    /// 相对路径解析到 server crate 根目录，保证无论 CWD 如何文件都落在 apps/server 下。
    pub fn new(root_cfg: &str) -> Self {
        let p = Path::new(root_cfg);
        let root = if p.is_absolute() {
            p.to_path_buf()
        } else {
            Path::new(env!("CARGO_MANIFEST_DIR")).join(root_cfg)
        };
        LocalFileStore { root }
    }

    fn full(&self, key: &str) -> PathBuf {
        self.root.join(key)
    }

    pub async fn save(&self, key: &str, bytes: &[u8]) -> AppResult<()> {
        let path = self.full(key);
        if let Some(parent) = path.parent() {
            tokio::fs::create_dir_all(parent)
                .await
                .map_err(|e| AppError::Internal(format!("create storage dir: {e}")))?;
        }
        tokio::fs::write(&path, bytes)
            .await
            .map_err(|e| AppError::Internal(format!("write file: {e}")))
    }

    pub async fn read(&self, key: &str) -> AppResult<Vec<u8>> {
        tokio::fs::read(self.full(key))
            .await
            .map_err(|e| AppError::Internal(format!("read file: {e}")))
    }

    /// 删除文件；文件已不存在视为成功（幂等）。
    pub async fn delete(&self, key: &str) -> AppResult<()> {
        match tokio::fs::remove_file(self.full(key)).await {
            Ok(()) => Ok(()),
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
            Err(e) => Err(AppError::Internal(format!("delete file: {e}"))),
        }
    }
}
