import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { AuditLog } from "@wsop/shared";
import { api } from "../lib/api";
import { fmtDateTime } from "../lib/format";
import { Badge, EmptyState, ErrorState, Spinner } from "../components/ui/primitives";
import { Select } from "../components/ui/Select";

const ACTION_LABEL: Record<string, string> = {
  create: "创建",
  update: "更新",
  delete: "删除",
  login: "登录",
  complete: "完成",
  upload: "上传",
};
const ENTITY_LABEL: Record<string, string> = {
  user: "用户",
  customer: "客户",
  deployment: "部署",
  maintenance_record: "维护记录",
  maintenance_note: "跟进",
  customer_file: "文件",
};

const ACTION_TONE: Record<string, "emerald" | "amber" | "red" | "blue" | "zinc"> = {
  create: "emerald",
  update: "amber",
  delete: "red",
  login: "blue",
  complete: "emerald",
  upload: "blue",
};

export default function Audit() {
  const [entity, setEntity] = useState("");

  const query = useQuery({
    queryKey: ["audit", entity],
    queryFn: () =>
      api.get<AuditLog[]>(`/audit-logs${entity ? `?entity_type=${entity}` : ""}`),
  });

  return (
    <div className="p-6 md:p-8 flex flex-col gap-5">
      <div>
        <h1 className="text-lg font-bold text-white tracking-tight">审计日志</h1>
        <p className="text-xs text-zinc-400 mt-0.5">所有写操作的可追溯记录（最近 200 条）</p>
      </div>

      <div className="flex items-center gap-2.5">
        <Select
          className="w-36"
          value={entity}
          onChange={setEntity}
          options={[
            { value: "", label: "全部对象" },
            ...Object.entries(ENTITY_LABEL).map(([v, l]) => ({ value: v, label: l })),
          ]}
        />
      </div>

      <div className="card overflow-hidden">
        {query.isLoading ? (
          <Spinner />
        ) : query.isError ? (
          <ErrorState error={query.error} />
        ) : !query.data || query.data.length === 0 ? (
          <EmptyState>暂无日志。</EmptyState>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wide text-zinc-500 border-b border-zinc-800/50">
                <th className="text-left font-medium px-4 py-3">时间</th>
                <th className="text-left font-medium px-4 py-3">操作者</th>
                <th className="text-left font-medium px-4 py-3">动作</th>
                <th className="text-left font-medium px-4 py-3">对象</th>
                <th className="text-left font-medium px-4 py-3 hidden lg:table-cell">IP</th>
              </tr>
            </thead>
            <tbody>
              {query.data.map((a) => (
                <tr key={a.id} className="border-b border-zinc-800/30 last:border-0">
                  <td className="px-4 py-3 text-zinc-400 font-mono-data whitespace-nowrap">
                    {fmtDateTime(a.created_at)}
                  </td>
                  <td className="px-4 py-3 text-zinc-200">{a.actor_username ?? "—"}</td>
                  <td className="px-4 py-3">
                    <Badge tone={ACTION_TONE[a.action] ?? "zinc"}>
                      {ACTION_LABEL[a.action] ?? a.action}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-zinc-300">
                    {ENTITY_LABEL[a.entity_type] ?? a.entity_type}
                  </td>
                  <td className="px-4 py-3 text-zinc-600 font-mono-data hidden lg:table-cell">
                    {a.ip ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
