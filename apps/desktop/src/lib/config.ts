/**
 * 后端中心服务地址。
 * 默认指向本机开发后端；生产构建时用环境变量 `VITE_API_BASE` 覆盖，例如：
 *   VITE_API_BASE=http://10.0.0.5:8787 pnpm --filter wsop-desktop tauri build
 * 注意：同一地址还需加入 src-tauri/capabilities/default.json 的 http 允许列表。
 */
export const API_BASE = import.meta.env.VITE_API_BASE ?? "http://127.0.0.1:8787";
