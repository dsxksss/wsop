import { useState } from "react";
import { useNavigate } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { Building2, ChevronRight, Plus, Search } from "lucide-react";
import type { CustomerSummaryDto } from "@wsop/shared";
import { api } from "../lib/api";
import { fmtDate } from "../lib/format";
import { useAuth } from "../stores/auth";
import { Button, EmptyState, ErrorState, Input, Spinner } from "../components/ui/primitives";
import { CustomerFormModal } from "../components/customers/CustomerFormModal";

export default function Customers() {
  const navigate = useNavigate();
  const user = useAuth((s) => s.user);
  const canWrite = !!user && (user.role === "admin" || user.permissions.actions.includes("write:customers"));

  const [q, setQ] = useState("");
  const [creating, setCreating] = useState(false);

  const query = useQuery({
    queryKey: ["customers", q],
    queryFn: () =>
      api.get<CustomerSummaryDto[]>(`/customers${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ""}`),
  });

  return (
    <div className="p-6 md:p-8 flex flex-col gap-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold text-white tracking-tight">客户</h1>
          <p className="text-xs text-zinc-400 mt-0.5">企业客户档案与维护概览</p>
        </div>
        {canWrite && (
          <Button icon={<Plus size={14} />} onClick={() => setCreating(true)}>
            登记客户
          </Button>
        )}
      </div>

      <div className="relative max-w-xs">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
        <Input
          className="pl-9"
          placeholder="搜索企业名 / 简称 / 联系人"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <div className="card overflow-hidden">
        {query.isLoading ? (
          <Spinner />
        ) : query.isError ? (
          <ErrorState error={query.error} />
        ) : !query.data || query.data.length === 0 ? (
          <EmptyState>暂无客户，点击右上角登记。</EmptyState>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wide text-zinc-500 border-b border-zinc-800/50">
                <th className="text-left font-medium px-4 py-3">企业</th>
                <th className="text-left font-medium px-4 py-3 hidden md:table-cell">行业</th>
                <th className="text-right font-medium px-4 py-3">部署数</th>
                <th className="text-right font-medium px-4 py-3">维护次数</th>
                <th className="text-left font-medium px-4 py-3 hidden lg:table-cell">最近维护</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {query.data.map((c) => (
                <tr
                  key={c.id}
                  onClick={() => navigate(`/customers/${c.id}`)}
                  className="border-b border-zinc-800/30 last:border-0 hover:bg-zinc-800/20 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                        <Building2 size={14} className="text-emerald-400" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-white font-medium truncate">{c.name}</div>
                        {c.short_name && (
                          <div className="text-[11px] text-zinc-500 truncate">{c.short_name}</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-zinc-400 hidden md:table-cell">
                    {c.industry ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-right text-zinc-300 font-mono-data">
                    {c.active_deployments}
                  </td>
                  <td className="px-4 py-3 text-right text-zinc-300 font-mono-data">
                    {c.maintenance_count}
                  </td>
                  <td className="px-4 py-3 text-zinc-400 font-mono-data hidden lg:table-cell">
                    {fmtDate(c.last_maintained_at)}
                  </td>
                  <td className="px-2">
                    <ChevronRight size={15} className="text-zinc-600" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <CustomerFormModal
        open={creating}
        onClose={() => setCreating(false)}
        onSaved={(id) => navigate(`/customers/${id}`)}
      />
    </div>
  );
}
