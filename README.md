# wsop — 私有化维护客户记录系统

面向公司内部运维/维护人员的、**以企业客户为中心**的维护记录台账。记录每个客户被部署的私有化软件
被维护了多少次、什么时候、做了什么；每个客户带一个文件空间存放部署文档；含三级权限与操作审计。

- **定位**：维护记录系统（不是工单流转）。维护记录 = 每一次维护事件，含轻量状态（进行中 / 已完成）。
- **多人协作**：桌面客户端 + 中心服务，数据集中存储，支持跨用户共享与审计。

## 架构

```
wsop/                      # pnpm workspace
├── apps/
│   ├── desktop/           # Tauri 2 + React 19 + TS + Tailwind v4 桌面客户端
│   └── server/            # Rust / Axum 中心服务（SQLx + SQLite + 本地文件存储）
└── packages/
    └── shared/            # 由后端 ts-rs 生成的 TS 类型（前端经 @wsop/shared 引用）
```

桌面端是**瘦客户端**：通过 HTTP + JWT 访问 `apps/server`，所有客户/部署/维护记录/文件/审计都存在
服务端的 SQLite 文件里。交互组件用 **Radix UI**（Dialog/Select/Tabs/Switch），主题为自定义深色玻璃拟态。

## 角色（RBAC 三级）

| 角色 | 权限 |
| --- | --- |
| 管理员 admin | 用户管理、全部客户/部署/维护/文件、查看审计 |
| 工程师 engineer | 登记客户与部署、建/处理维护记录、上传/管理文件 |
| 查看者 viewer | 全部只读（可下载文件） |

## 开发

前置：Node ≥ 20 + pnpm、Rust 工具链。首次 `pnpm install`。

```bash
# 1) 后端（自动建库 + 迁移 + seed 初始管理员），监听 127.0.0.1:8787
pnpm server:dev

# 2) 桌面端（Vite 端口 1430，首次编译 Rust 较久），另开一个终端
pnpm tauri:dev
```

初始管理员 `admin / admin12345`（首次启动按 `apps/server/.env` 的默认值创建，请登录后改密）。

其他命令：

| 命令 | 说明 |
| --- | --- |
| `pnpm desktop:build` | 前端 tsc + vite 构建（唯一类型/lint 关卡） |
| `pnpm server:build` | 后端 release 构建 |
| `pnpm shared:gen` | 由后端 DTO 重新生成 `packages/shared` 的 TS 类型（改了 DTO 后执行） |

API 端点清单见 [apps/server/README.md](apps/server/README.md)。

## 构建与打包

**后端**：

```bash
pnpm server:build      # 产物：apps/server/target/release/wsop-server.exe（约 7MB 单文件）
```

**桌面端**：

```bash
# 生产构建前，把后端地址写进环境变量（默认指向本机）
VITE_API_BASE=http://<服务器IP>:8787 pnpm tauri:build
# 产物：apps/desktop/src-tauri/target/release/bundle/ 下的安装包（msi/nsis 等）
```

> 改了后端地址，还需把同一地址加入 `apps/desktop/src-tauri/capabilities/default.json` 的 `http` 允许列表，
> 否则客户端请求会被 Tauri 拦截。

## 部署

**中心服务（后端）**：

1. 把 `wsop-server.exe` 拷到内网服务器，旁边放一份 `.env`（参考 `apps/server/.env.example`）：
   - `JWT_SECRET` 必须改成足够长的随机串
   - `DATABASE_URL`（默认 `sqlite://data/wsop.db`）、`STORAGE_ROOT`（默认 `storage`）按需设置
   - `BIND_ADDR=0.0.0.0:8787` 对外提供（默认仅 127.0.0.1）
2. 启动即自动建库、迁移、seed 管理员。`data/`（SQLite，含 WAL）与 `storage/`（客户文件）需**定期备份**。
3. 建议作为服务常驻（Windows 服务 / nssm / 计划任务），或置于反向代理之后。

**桌面端**：用上面带 `VITE_API_BASE` 的安装包分发给运维同事；首次打开用管理员账号登录后在「用户管理」里建号、分配角色。

## 配置项（后端环境变量）

| 变量 | 默认 | 说明 |
| --- | --- | --- |
| `DATABASE_URL` | `sqlite://data/wsop.db` | SQLite 文件（相对路径解析到 server 目录） |
| `JWT_SECRET` | `dev-insecure-secret` | JWT 签名密钥（**生产必改**） |
| `STORAGE_ROOT` | `storage` | 客户文件空间根目录 |
| `BIND_ADDR` | `127.0.0.1:8787` | 监听地址 |
| `ADMIN_USERNAME/PASSWORD/EMAIL` | `admin/admin12345/...` | 首启 seed 的初始管理员 |

## 安全与数据

- 密码用 Argon2 哈希存储；登录签发 JWT（7 天）；所有写操作落审计日志（操作者/动作/对象/diff/IP/UA）。
- 文件上传上限 64MB，存于服务端本地文件系统；下载校验登录态。
- SQLite 文件与 `storage/` 不入 Git，请纳入服务器备份策略。
- 桌面端 JWT 通过 Tauri Store 持久化在本机。

## 里程碑

实现分 M0–M7：M0 monorepo+改名、M1 后端地基、M2 客户与部署、M3 维护记录、M4 文件空间、
M5 客户端地基、M6 业务页面、M7 加固与打包。
