import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Boxes, Pencil, Plus, Trash2 } from "lucide-react";
import type { Deployment } from "@wsop/shared";
import { api } from "../../lib/api";
import { fmtDate } from "../../lib/format";
import { Badge, Button, EmptyState } from "../ui/primitives";
import { DeploymentFormModal } from "./DeploymentFormModal";

export function DeploymentsTab({
  customerId,
  deployments,
  canWrite,
}: {
  customerId: string;
  deployments: Deployment[];
  canWrite: boolean;
}) {
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Deployment | null>(null);

  const del = useMutation({
    mutationFn: (id: string) => api.del(`/deployments/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["customer", customerId] }),
  });

  return (
    <div className="flex flex-col gap-3">
      {canWrite && (
        <div className="flex justify-end">
          <Button icon={<Plus size={14} />} onClick={() => setCreating(true)}>
            新增部署
          </Button>
        </div>
      )}

      {deployments.length === 0 ? (
        <div className="card">
          <EmptyState>暂无部署实例。</EmptyState>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {deployments.map((d) => (
            <div key={d.id} className="card p-4 flex flex-col gap-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                    <Boxes size={15} className="text-emerald-400" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-white truncate">{d.product}</div>
                    <div className="text-[11px] text-zinc-500">
                      {d.version ? `v${d.version}` : "—"}
                    </div>
                  </div>
                </div>
                <Badge tone={d.status === "active" ? "emerald" : "zinc"}>
                  {d.status === "active" ? "在用" : "已下线"}
                </Badge>
              </div>
              <div className="flex items-center gap-4 text-[11px] text-zinc-400">
                <span>环境：{d.environment ?? "—"}</span>
                <span>上线：{fmtDate(d.go_live_date)}</span>
              </div>
              {d.notes && <p className="text-xs text-zinc-500 leading-relaxed">{d.notes}</p>}
              {canWrite && (
                <div className="flex items-center gap-2 pt-1">
                  <Button
                    variant="subtle"
                    icon={<Pencil size={12} />}
                    onClick={() => setEditing(d)}
                  >
                    编辑
                  </Button>
                  <Button
                    variant="subtle"
                    icon={<Trash2 size={12} />}
                    onClick={() => {
                      if (confirm(`删除部署「${d.product}」？`)) del.mutate(d.id);
                    }}
                  >
                    删除
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {creating && (
        <DeploymentFormModal
          open={creating}
          onClose={() => setCreating(false)}
          customerId={customerId}
        />
      )}
      {editing && (
        <DeploymentFormModal
          open={!!editing}
          onClose={() => setEditing(null)}
          customerId={customerId}
          initial={editing}
        />
      )}
    </div>
  );
}
