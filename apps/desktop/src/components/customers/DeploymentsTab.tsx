import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Boxes, Pencil, Trash2 } from "lucide-react";
import type { Deployment } from "@wsop/shared";
import { api } from "../../lib/api";
import { fmtDate } from "../../lib/format";
import { Button, EmptyState } from "../ui/primitives";
import { ConfirmModal } from "../ui/ConfirmModal";
import { DeploymentFormModal } from "./DeploymentFormModal";

export function DeploymentsTab({
  customerId,
  deployments,
  canWrite,
  createOpen,
  setCreateOpen,
}: {
  customerId: string;
  deployments: Deployment[];
  canWrite: boolean;
  /** 新建流程由父级（客户详情顶部按钮）控制。 */
  createOpen: boolean;
  setCreateOpen: (open: boolean) => void;
}) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Deployment | null>(null);
  const [deleting, setDeleting] = useState<Deployment | null>(null);

  const del = useMutation({
    mutationFn: (id: string) => api.del(`/deployments/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customer", customerId] });
      setDeleting(null);
    },
  });

  return (
    <div className="flex flex-col gap-3">
      {deployments.length === 0 ? (
        <div className="card">
          <EmptyState>暂无授权审批信息。</EmptyState>
        </div>
      ) : (
        <div
          className={`grid gap-3 items-start ${
            deployments.length === 1 ? "grid-cols-1" : "grid-cols-1 lg:grid-cols-2"
          }`}
        >
          {deployments.map((d) => (
            <div key={d.id} className="card p-4 flex flex-col gap-3.5">
              {/* 单条部署时卡片占满整宽，内部字段用更多列填充，避免右侧留白 */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                    <Boxes size={15} className="text-emerald-400" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-white truncate">
                      审批编号：{d.approval_no || "未填写"}
                    </div>
                    {d.submitted_at && (
                      <div className="text-[11px] text-zinc-500 mt-0.5">
                        提交时间：{fmtDate(d.submitted_at)}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div
                className={`grid grid-cols-2 gap-x-3 gap-y-1.5 bg-zinc-950/20 rounded-lg p-2.5 border border-zinc-800/40 text-[11px] ${
                  deployments.length === 1
                    ? "sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6"
                    : "sm:grid-cols-3"
                }`}
              >
                {d.department && (
                  <div className="flex flex-col min-w-0">
                    <span className="text-zinc-500">所在部门</span>
                    <span className="text-zinc-300 truncate">{d.department}</span>
                  </div>
                )}
                {d.purpose && (
                  <div className="flex flex-col min-w-0">
                    <span className="text-zinc-500">申请目的</span>
                    <span className="text-zinc-300 truncate">{d.purpose}</span>
                  </div>
                )}
                {d.concurrency_limit !== null && (
                  <div className="flex flex-col min-w-0">
                    <span className="text-zinc-500">并发限制</span>
                    <span className="text-emerald-400 font-medium">{d.concurrency_limit}</span>
                  </div>
                )}
                {d.user_count !== null && (
                  <div className="flex flex-col min-w-0">
                    <span className="text-zinc-500">用户数限制</span>
                    <span className="text-zinc-300 font-medium">{d.user_count}</span>
                  </div>
                )}
                {d.license_expiry && (
                  <div className="flex flex-col min-w-0">
                    <span className="text-zinc-500">Licence 有效期</span>
                    <span className="text-zinc-300 font-mono truncate">{fmtDate(d.license_expiry)}</span>
                  </div>
                )}
                {d.module_count !== null && (
                  <div className="flex flex-col min-w-0">
                    <span className="text-zinc-500">模块数</span>
                    <span className="text-zinc-300">{d.module_count}</span>
                  </div>
                )}
                {d.modules && (
                  <div className="flex flex-col min-w-0 col-span-full">
                    <span className="text-zinc-500">包含模块</span>
                    <span className="text-zinc-300 truncate" title={d.modules}>{d.modules}</span>
                  </div>
                )}
              </div>

              {canWrite && (
                <div className="flex items-center gap-2 pt-1 border-t border-zinc-800/40 mt-1">
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
                    onClick={() => setDeleting(d)}
                  >
                    删除
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {createOpen && (
        <DeploymentFormModal
          open={createOpen}
          onClose={() => setCreateOpen(false)}
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
      {deleting && (
        <ConfirmModal
          open
          onClose={() => setDeleting(null)}
          onConfirm={() => del.mutate(deleting.id)}
          title="删除授权审批"
          message={`确定要删除审批编号为「${deleting.approval_no || "未填写"}」的授权信息吗？`}
          confirmText="删除"
          confirmVariant="danger"
          loading={del.isPending}
        />
      )}
    </div>
  );
}
