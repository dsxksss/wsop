/** 取日期部分（YYYY-MM-DD）。 */
export function fmtDate(iso?: string | null): string {
  if (!iso) return "—";
  return iso.slice(0, 10);
}

/** 本地化日期时间。 */
export function fmtDateTime(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 16).replace("T", " ");
  return d.toLocaleString("zh-CN", { hour12: false });
}

const MAINTENANCE_TYPES: Record<string, string> = {
  deploy: "部署",
  upgrade: "升级",
  inspection: "巡检",
  incident: "故障处理",
  other: "其他",
};
export const MAINTENANCE_TYPE_OPTIONS = Object.entries(MAINTENANCE_TYPES).map(
  ([value, label]) => ({ value, label }),
);
export function maintenanceTypeLabel(t: string): string {
  return MAINTENANCE_TYPES[t] ?? t;
}

export function roleLabel(role: string): string {
  switch (role) {
    case "admin":
      return "管理员";
    case "engineer":
      return "工程师";
    case "viewer":
      return "查看者";
    default:
      return role;
  }
}

/** 文件大小友好显示。 */
export function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
