# wsop-server

中心服务后端（Rust / Axum + SQLite）。客户端通过 HTTP + JWT 访问。

## 运行

```bash
cp .env.example .env      # 按需修改 JWT_SECRET / 初始管理员等
cargo run                 # 启动时自动建库 + 迁移 + seed 初始管理员
# 或从仓库根目录： pnpm server:dev
```

默认监听 `http://127.0.0.1:8787`，数据库文件 `apps/server/data/wsop.db`（WAL 模式，已 gitignore）。
首次启动若无任何用户，会用 `ADMIN_USERNAME` / `ADMIN_PASSWORD` 创建一个 `admin`（请登录后立即改密）。

## 配置（环境变量，见 .env.example）

| 变量 | 默认 | 说明 |
| --- | --- | --- |
| `DATABASE_URL` | `sqlite://data/wsop.db` | SQLite 文件（相对路径解析到 crate 根） |
| `JWT_SECRET` | `dev-insecure-secret` | JWT 签名密钥（生产必改） |
| `STORAGE_ROOT` | `storage` | 客户文件空间根目录（M4 起用） |
| `BIND_ADDR` | `127.0.0.1:8787` | 监听地址 |
| `ADMIN_USERNAME/PASSWORD/EMAIL` | `admin/admin12345/...` | 初始管理员 |
| `SEED_DEMO` | 未设置 | 设为 `1`/`true` 且库中无客户时填充演示假数据（见下），生产勿开 |

## 演示数据（开发用）

设 `SEED_DEMO=1` 启动（且 `customers` 表为空）会一次性填充覆盖所有模块的假数据，方便前端调试显示样式：

```bash
SEED_DEMO=1 pnpm server:dev      # 或在 .env 里取消注释 SEED_DEMO=1
```

填充内容：3 个额外用户（`eng1`/`eng2` 密码 `engineer123`、`viewer1` 密码 `viewer123`）、
4 个企业客户，每个客户带 部署（含 Wemol 授权审批字段）、远程连接（账号 + 结构化连接信息）、
若干维护记录（混合类型与「进行中 / 已完成」状态，部分含跟进备注）、文件空间示例文件、以及一批审计日志。
想重新生成：停服后删掉 `data/wsop.db*` 再带 `SEED_DEMO=1` 启动。

## 已实现端点

| 方法 | 路径 | 权限 | 说明 |
| --- | --- | --- | --- |
| GET | `/health` | 公开 | 健康检查 |
| POST | `/auth/login` | 公开 | 登录，返回 JWT + 用户 |
| GET | `/auth/me` | 已登录 | 当前用户 |
| GET | `/users` | admin | 用户列表 |
| POST | `/users` | admin | 新建用户 |
| PATCH | `/users/{id}` | admin | 改角色 / 启停 / 重置密码 |
| DELETE | `/users/{id}` | admin | 删除用户（不能删自己） |
| GET | `/customers` | 已登录 | 客户列表（含维护汇总），支持 `?q` 搜索 |
| POST | `/customers` | 写权限 | 登记客户 |
| GET | `/customers/{id}` | 已登录 | 客户详情（汇总 + 部署列表 + 远程连接）；viewer 不返回任何凭据材料 |
| PUT | `/customers/{id}` | 写权限 | 编辑客户 |
| DELETE | `/customers/{id}` | admin | 删除客户（级联） |
| POST | `/customers/{id}/remote-connections` | 写权限 | 新增远程连接（Wemol 账号 + 连接信息） |
| PUT | `/remote-connections/{id}` | 写权限 | 编辑远程连接（整体覆盖语义） |
| DELETE | `/remote-connections/{id}` | 写权限 | 删除远程连接 |
| GET | `/customers/{id}/deployments` | 已登录 | 部署列表 |
| POST | `/customers/{id}/deployments` | 写权限 | 新增部署（含 Wemol 授权审批字段） |
| PUT | `/deployments/{id}` | 写权限 | 编辑部署 |
| DELETE | `/deployments/{id}` | 写权限 | 删除部署 |
| GET | `/maintenance-records` | 已登录 | 维护记录列表，支持 `?customer_id/status/assignee_id/type` 过滤 |
| POST | `/maintenance-records` | 写权限 | 新建维护记录（默认 in_progress） |
| GET | `/maintenance-records/{id}` | 已登录 | 详情（记录 + 跟进备注） |
| PUT | `/maintenance-records/{id}` | 写权限 | 编辑维护记录 |
| DELETE | `/maintenance-records/{id}` | 写权限 | 删除 |
| PATCH | `/maintenance-records/{id}/complete` | 写权限 | 标记完成（写 result + completed_at → 状态 done） |
| PATCH | `/maintenance-records/{id}/reopen` | 写权限 | 撤销完成（done → in_progress，清空 completed_at，保留 result） |
| POST | `/maintenance-records/{id}/notes` | 写权限 | 追加跟进备注 |
| GET | `/customers/{id}/files` | 已登录 | 文件列表，支持 `?folder` 过滤 |
| POST | `/customers/{id}/files` | 写权限 | 上传文件（multipart：`file` + 可选 `folder`） |
| GET | `/files/{id}/download` | 已登录 | 下载文件 |
| DELETE | `/files/{id}` | 写权限 | 删除文件（同时删磁盘） |

权限说明：**写权限** = admin / engineer；viewer 只读。所有写操作写入 `audit_logs`
（actor / action / entity / diff / ip / ua），审计 diff 中**不含任何密码**。

**凭据脱敏**：远程连接的 `wemol_password` 与 `connection_info`（结构化连接信息，可能含 SSH 口令）
为运维取用需要而明文落库，依赖访问控制保护——`GET /customers/{id}` 对 viewer 会把这两个字段返回为
`null`，仅 admin / engineer 可见明文。后续可加列级加密（加密落库）进一步加固。

## 共享类型（ts-rs）

对外 DTO 派生 `ts_rs::TS`，运行 `pnpm shared:gen`（即 `cargo test export_bindings`）把 TS 类型
生成到 `packages/shared/types/`，前端经 `@wsop/shared` 引用。新增导出类型后，在
`packages/shared/index.ts` 补一行 re-export。

## 结构

```
src/
├── main.rs        启动、迁移、seed、装配 Router
├── config.rs      环境变量配置
├── db.rs          SQLite 连接(WAL/外键) + 迁移
├── error.rs       AppError -> JSON 响应
├── state.rs       AppState { db, config }
├── auth/          Role / JWT / argon2 密码 / 提取器(AuthUser, AdminUser)
├── audit.rs       RequestMeta 提取器 + record() 写审计
├── storage.rs     LocalFileStore（本地文件存储，可换 MinIO/S3）
├── models/        DB 行与 DTO（对外 DTO 派生 ts-rs::TS）
└── routes/        health / auth / users / customers（含远程连接）/ deployments / maintenance / files
migrations/        0001..0009（0008/0009 为 Wemol 字段下放到 deployments + 客户多远程连接表）
```
