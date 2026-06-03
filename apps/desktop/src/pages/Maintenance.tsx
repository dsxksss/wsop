import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import type { MaintenanceListItem } from "@wsop/shared";
import { api } from "../lib/api";
import { fmtDate, maintenanceTypeLabel, MAINTENANCE_TYPE_OPTIONS } from "../lib/format";
import { useAuth } from "../stores/auth";
import { Badge, Button, EmptyState, ErrorState, Spinner, StatusBadge } from "../components/ui/primitives";
import { Select } from "../components/ui/Select";
import { MaintenanceFormModal } from "../components/maintenance/MaintenanceFormModal";
import { MaintenanceDetailModal } from "../components/maintenance/MaintenanceDetailModal";

export default function Maintenance() {
  const role = useAuth((s) => s.user?.role);
  const canWrite = role === "admin" || role === "engineer";

  const [status, setStatus] = useState("");
  const [type, setType] = useState("");
  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["maintenance", "all", status, type],
    queryFn: () => {
      const p = new URLSearchParams();
      if (status) p.set("status", status);
      if (type) p.set("type", type);
      const qs = p.toString();
      return api.get<MaintenanceListItem[]>(`/maintenance-records${qs ? `?${qs}` : ""}`);
    },
  });

  return (
    <div className="p-6 md:p-8 flex flex-col gap-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold text-white tracking-tight">维护记录</h1>
          <p className="text-xs text-zinc-400 mt-0.5">全部客户的维护台账</p>
        </div>
        {canWrite && (
          <Button icon={<Plus size={14} />} onClick={() => setCreating(true)}>
            新建维护
          </Button>
        )}
      </div>

      <div className="flex items-center gap-2.5">
        <Select
          className="w-32"
          value={status}
          onChange={setStatus}
          options={[
            { value: "", label: "全部状态" },
            { value: "in_progress", label: "进行中" },
            { value: "done", label: "已完成" },
          ]}
        />
        <Select
          className="w-32"
          value={type}
          onChange={setType}
          options={[{ value: "", label: "全部类型" }, ...MAINTENANCE_TYPE_OPTIONS]}
        />
      </div>

      <div className="card overflow-hidden">
        {query.isLoading ? (
          <Spinner />
        ) : query.isError ? (
          <ErrorState error={query.error} />
        ) : !query.data || query.data.length === 0 ? (
          <EmptyState>暂无维护记录。</EmptyState>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wide text-zinc-500 border-b border-zinc-800/50">
                <th className="text-left font-medium px-4 py-3">标题</th>
                <th className="text-left font-medium px-4 py-3 hidden md:table-cell">客户</th>
                <th className="text-left font-medium px-4 py-3">类型</th>
                <th className="text-left font-medium px-4 py-3">状态</th>
                <th className="text-left font-medium px-4 py-3 hidden lg:table-cell">负责人</th>
                <th className="text-right font-medium px-4 py-3">维护时间</th>
              </tr>
            </thead>
            <tbody>
              {query.data.map((m) => (
                <tr
                  key={m.id}
                  onClick={() => setOpenId(m.id)}
                  className="border-b border-zinc-800/30 last:border-0 hover:bg-zinc-800/20 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3 text-white font-medium">{m.title}</td>
                  <td className="px-4 py-3 text-zinc-400 hidden md:table-cell truncate max-w-[160px]">
                    {m.customer_name}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone="blue">{maintenanceTypeLabel(m.type)}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={m.status} />
                  </td>
                  <td className="px-4 py-3 text-zinc-400 hidden lg:table-cell">
                    {m.assignee_username ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-right text-zinc-400 font-mono-data">
                    {fmtDate(m.maintained_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {creating && (
        <MaintenanceFormModal open={creating} onClose={() => setCreating(false)} />
      )}
      {openId && (
        <MaintenanceDetailModal
          open={!!openId}
          onClose={() => setOpenId(null)}
          recordId={openId}
          canWrite={canWrite}
        />
      )}
    </div>
  );
}
