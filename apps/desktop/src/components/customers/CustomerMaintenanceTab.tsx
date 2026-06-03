import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Deployment, MaintenanceListItem } from "@wsop/shared";
import { api } from "../../lib/api";
import { fmtDate, maintenanceTypeLabel } from "../../lib/format";
import { Badge, EmptyState, Spinner, StatusBadge } from "../ui/primitives";
import { MaintenanceFormModal } from "../maintenance/MaintenanceFormModal";
import { MaintenanceDetailModal } from "../maintenance/MaintenanceDetailModal";

export function CustomerMaintenanceTab({
  customerId,
  canWrite,
  deployments,
  createOpen,
  setCreateOpen,
}: {
  customerId: string;
  canWrite: boolean;
  deployments?: Deployment[];
  /** 新建流程由父级（客户详情顶部按钮）控制。 */
  createOpen: boolean;
  setCreateOpen: (open: boolean) => void;
}) {
  const [openId, setOpenId] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["maintenance", customerId],
    queryFn: () =>
      api.get<MaintenanceListItem[]>(`/maintenance-records?customer_id=${customerId}`),
  });

  return (
    <div className="flex flex-col gap-3">
      <div className="card overflow-hidden">
        {query.isLoading ? (
          <Spinner />
        ) : !query.data || query.data.length === 0 ? (
          <EmptyState>暂无维护记录。</EmptyState>
        ) : (
          <div className="flex flex-col divide-y divide-zinc-800/40">
            {query.data.map((m) => (
              <button
                key={m.id}
                onClick={() => setOpenId(m.id)}
                className="flex items-center gap-3 px-4 py-3 text-left hover:bg-zinc-800/20 transition-colors cursor-pointer"
              >
                <StatusBadge status={m.status} />
                <span className="text-sm text-white font-medium truncate flex-1">{m.title}</span>
                <Badge tone="blue">{maintenanceTypeLabel(m.type)}</Badge>
                <span className="text-[11px] text-zinc-500 hidden sm:block">
                  {m.assignee_username ?? "—"}
                </span>
                <span className="text-[11px] text-zinc-500 font-mono-data shrink-0">
                  {fmtDate(m.maintained_at)}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {createOpen && (
        <MaintenanceFormModal
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          fixedCustomerId={customerId}
          deployments={deployments}
        />
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
