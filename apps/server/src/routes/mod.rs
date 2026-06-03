pub mod audit_logs;
pub mod auth;
pub mod customers;
pub mod deployments;
pub mod files;
pub mod health;
pub mod maintenance;
pub mod users;

use axum::{
    routing::{get, patch, post, put},
    Router,
};

use crate::state::AppState;

/// 组装全部路由。state 在此注入，返回无状态 Router 以便外层挂 layer。
pub fn router(state: AppState) -> Router {
    Router::new()
        .route("/health", get(health::health))
        .route("/auth/login", post(auth::login))
        .route("/auth/me", get(auth::me))
        .route("/users", get(users::list).post(users::create))
        .route("/users/{id}", patch(users::update).delete(users::delete))
        .route("/customers", get(customers::list).post(customers::create))
        .route(
            "/customers/{id}",
            get(customers::get).put(customers::update).delete(customers::delete),
        )
        .route(
            "/customers/{id}/remote-connections",
            post(customers::create_remote_connection),
        )
        .route(
            "/remote-connections/{id}",
            put(customers::update_remote_connection).delete(customers::delete_remote_connection),
        )
        .route(
            "/customers/{id}/deployments",
            get(deployments::list).post(deployments::create),
        )
        .route(
            "/deployments/{id}",
            put(deployments::update).delete(deployments::delete),
        )
        .route(
            "/maintenance-records",
            get(maintenance::list).post(maintenance::create),
        )
        .route(
            "/maintenance-records/{id}",
            get(maintenance::get).put(maintenance::update).delete(maintenance::delete),
        )
        .route(
            "/maintenance-records/{id}/complete",
            patch(maintenance::complete),
        )
        .route(
            "/maintenance-records/{id}/notes",
            post(maintenance::add_note),
        )
        .route(
            "/customers/{id}/files",
            get(files::list).post(files::upload),
        )
        .route("/files/{id}/download", get(files::download))
        .route("/files/{id}", axum::routing::delete(files::delete))
        .route("/audit-logs", get(audit_logs::list))
        .with_state(state)
}
