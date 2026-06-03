import { fetch } from "@tauri-apps/plugin-http";
import { API_BASE as DEFAULT_API_BASE } from "./config";

/** 当前后端地址，可在「设置」里改并持久化（见 stores/settings.ts）。 */
let apiBase = DEFAULT_API_BASE;
export function setApiBase(url: string) {
  apiBase = url.trim().replace(/\/+$/, "");
}
export function getApiBase() {
  return apiBase;
}

/** 当前 JWT，由认证 store 注入（见 stores/auth.ts）。 */
let authToken: string | null = null;
export function setAuthToken(token: string | null) {
  authToken = token;
}

/** 健康检查指定后端地址（用于「设置」里测试连接，不改全局地址）。 */
export async function pingHealth(base: string): Promise<boolean> {
  try {
    const res = await fetch(`${base.trim().replace(/\/+$/, "")}/health`, { method: "GET" });
    return res.ok;
  } catch {
    return false;
  }
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type Json = Record<string, unknown> | unknown[] | null;

async function request<T>(
  method: string,
  path: string,
  body?: Json,
): Promise<T> {
  const headers: Record<string, string> = {};
  if (authToken) headers["Authorization"] = `Bearer ${authToken}`;

  let payload: string | undefined;
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }

  const res = await fetch(`${apiBase}${path}`, { method, headers, body: payload });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  if (!res.ok) {
    const msg =
      (data && typeof data === "object" && "error" in data
        ? String((data as Record<string, unknown>).error)
        : null) ?? `请求失败 (HTTP ${res.status})`;
    throw new ApiError(res.status, msg);
  }
  return data as T;
}

/** 构造带鉴权头的下载请求（用于文件下载，返回二进制）。 */
export async function downloadBlob(path: string): Promise<Blob> {
  const headers: Record<string, string> = {};
  if (authToken) headers["Authorization"] = `Bearer ${authToken}`;
  const res = await fetch(`${apiBase}${path}`, { method: "GET", headers });
  if (!res.ok) throw new ApiError(res.status, `下载失败 (HTTP ${res.status})`);
  return await res.blob();
}

/** 上传文件（multipart）。 */
export async function uploadFile<T>(
  path: string,
  file: File,
  folder?: string,
): Promise<T> {
  const headers: Record<string, string> = {};
  if (authToken) headers["Authorization"] = `Bearer ${authToken}`;
  const form = new FormData();
  if (folder) form.append("folder", folder);
  form.append("file", file);
  const res = await fetch(`${apiBase}${path}`, { method: "POST", headers, body: form });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const msg =
      data && typeof data === "object" && "error" in data
        ? String((data as Record<string, unknown>).error)
        : `上传失败 (HTTP ${res.status})`;
    throw new ApiError(res.status, msg);
  }
  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body?: Json) => request<T>("POST", path, body),
  put: <T>(path: string, body?: Json) => request<T>("PUT", path, body),
  patch: <T>(path: string, body?: Json) => request<T>("PATCH", path, body),
  del: <T>(path: string) => request<T>("DELETE", path),
};
