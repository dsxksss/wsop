import { useQuery } from "@tanstack/react-query";
import { Building2, Activity, CheckCircle2 } from "lucide-react";
import type { CustomerSummaryDto, MaintenanceListItem } from "@wsop/shared";
import { api } from "../lib/api";

export default function Dashboard() {
  const customers = useQuery({
    queryKey: ["customers"],
    queryFn: () => api.get<CustomerSummaryDto[]>("/customers"),
  });
  const records = useQuery({
    queryKey: ["maintenance"],
    queryFn: () => api.get<MaintenanceListItem[]>("/maintenance-records"),
  });

  const loading = customers.isLoading || records.isLoading;
  const inProgress = records.data?.filter((r) => r.status === "in_progress").length;
  const done = records.data?.filter((r) => r.status === "done").length;

  const kpis = [
    { label: "在维护客户", value: customers.data?.length, icon: Building2 },
    { label: "进行中维护", value: inProgress, icon: Activity },
    { label: "已完成维护", value: done, icon: CheckCircle2 },
  ];

  return (
    <div className="p-6 md:p-8 flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-bold text-white tracking-tight mb-1">仪表盘</h1>
        <p className="text-xs text-zinc-300">私有化部署客户维护总览</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-zinc-300">{kpi.label}</span>
              <kpi.icon size={16} className="text-emerald-400" />
            </div>
            <div className="font-doto-hero text-3xl text-white">
              {loading ? "—" : (kpi.value ?? 0)}
            </div>
          </div>
        ))}
      </div>

      <div className="card p-6">
        <h2 className="text-sm font-bold text-white mb-4">最近维护</h2>
        {loading ? (
          <div className="text-xs text-zinc-300">加载中…</div>
        ) : records.data && records.data.length > 0 ? (
          <div className="flex flex-col divide-y divide-zinc-800/50">
            {records.data.slice(0, 6).map((r) => (
              <div key={r.id} className="flex items-center gap-3 py-2.5 text-xs">
                <span
                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                    r.status === "done" ? "bg-emerald-400" : "bg-amber-400"
                  }`}
                />
                <span className="text-zinc-200 font-semibold truncate flex-1">{r.title}</span>
                <span className="text-zinc-300 truncate hidden sm:block">{r.customer_name}</span>
                <span className="text-zinc-300 font-mono-data shrink-0">
                  {r.maintained_at.slice(0, 10)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-xs text-zinc-300">暂无维护记录</div>
        )}
      </div>
    </div>
  );
}
