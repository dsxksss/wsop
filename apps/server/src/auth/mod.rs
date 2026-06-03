pub mod extractor;
pub mod jwt;
pub mod password;

use serde::{Deserialize, Serialize};

/// 三级角色。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Role {
    Admin,
    Engineer,
    Viewer,
}

impl Role {
    pub fn as_str(&self) -> &'static str {
        match self {
            Role::Admin => "admin",
            Role::Engineer => "engineer",
            Role::Viewer => "viewer",
        }
    }

    pub fn parse(s: &str) -> Option<Role> {
        match s {
            "admin" => Some(Role::Admin),
            "engineer" => Some(Role::Engineer),
            "viewer" => Some(Role::Viewer),
            _ => None,
        }
    }

    /// 是否可写业务数据（客户/部署/维护记录/文件）。viewer 只读。
    pub fn can_write(&self) -> bool {
        matches!(self, Role::Admin | Role::Engineer)
    }
}
