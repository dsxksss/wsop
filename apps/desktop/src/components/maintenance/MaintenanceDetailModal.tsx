import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Send, Trash2 } from "lucide-react";
import type { MaintenanceNote, MaintenanceRecord } from "@wsop/shared";
import { api } from "../../lib/api";
import { fmtDateTime, maintenanceTypeLabel } from "../../lib/format";
import { Modal } from "../ui/Modal";
import { ConfirmModal } from "../ui/ConfirmModal";
import { Button, Field, Spinner, StatusBadge, Textarea } from "../ui/primitives";

interface DetailResponse {
  record: MaintenanceRecord;
  notes: MaintenanceNote[];
}

export function MaintenanceDetailModal({
  open,
  onClose,
  recordId,
  canWrite,
}: {
  open: boolean;
  onClose: () => void;
  recordId: string;
  canWrite: boolean;
}) {
  const qc = useQueryClient();
  const [result, setResult] = useState("");
  const [note, setNote] = useState("");
  const [deleting, setDeleting] = useState(false);

  const query = useQuery({
    queryKey: ["maintenance-detail", recordId],
    queryFn: () => api.get<DetailResponse>(`/maintenance-records/${recordId}`),
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["maintenance-detail", recordId] });
    qc.invalidateQueries({ queryKey: ["maintenance"] });
    qc.invalidateQueries({ queryKey: ["customers"] });
    qc.invalidateQueries({ queryKey: ["customer"] });
  };

  const complete = useMutation({
    mutationFn: () =>
      api.patch(`/maintenance-records/${recordId}/complete`, { result: result || null }),
    onSuccess: refresh,
  });
  const addNote = useMutation({
    mutationFn: () => api.post(`/maintenance-records/${recordId}/notes`, { note }),
    onSuccess: () => {
      setNote("");
      refresh();
    },
  });
  const del = useMutation({
    mutationFn: () => api.del(`/maintenance-records/${recordId}`),
    onSuccess: () => {
      refresh();
      setDeleting(false);
      onClose();
    },
  });

  const record = query.data?.record;
  const notes = query.data?.notes ?? [];

  return (
    <>
      <Modal
        open={open}
      onClose={onClose}
      title="维护记录详情"
      width="max-w-xl"
      footer={
        canWrite && record ? (
          <Button
            variant="ghost"
            icon={<Trash2 size={13} />}
            onClick={() => setDeleting(true)}
          >
            删除
          </Button>
        ) : undefined
      }
    >
      {query.isLoading || !record ? (
        <Spinner />
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex items-start justify-between gap-3">
            <h4 className="text-base font-bold text-white">{record.title}</h4>
            <StatusBadge status={record.status} />
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <Meta label="类型" value={maintenanceTypeLabel(record.type)} />
            <Meta label="维护时间" value={fmtDateTime(record.maintained_at)} />
            <Meta label="完成时间" value={record.completed_at ? fmtDateTime(record.completed_at) : "—"} />
            <Meta label="创建时间" value={fmtDateTime(record.created_at)} />
          </div>

          {record.content && (
            <div>
              <div className="text-[11px] text-zinc-500 mb-1">维护内容</div>
              <p className="text-sm text-zinc-200 leading-relaxed whitespace-pre-wrap">
                {record.content}
              </p>
            </div>
          )}

          {record.result && (
            <div className="rounded-xl bg-emerald-500/8 border border-emerald-500/15 p-3">
              <div className="text-[11px] text-emerald-400/80 mb-1">结果 / 总结</div>
              <p className="text-sm text-zinc-200 leading-relaxed whitespace-pre-wrap">
                {record.result}
              </p>
            </div>
          )}

          {/* complete action */}
          {canWrite && record.status === "in_progress" && (
            <div className="rounded-xl border border-zinc-800/60 p-3 flex flex-col gap-2.5">
              <Field label="结果 / 总结（标记完成时填写）">
                <Textarea
                  value={result}
                  onChange={(e) => setResult(e.target.value)}
                  placeholder="本次维护的结论…"
                />
              </Field>
              <Button
                icon={<CheckCircle2 size={14} />}
                loading={complete.isPending}
                onClick={() => complete.mutate()}
                className="self-start"
              >
                标记完成
              </Button>
            </div>
          )}

          {/* notes */}
          <div>
            <div className="text-[11px] text-zinc-500 mb-2">跟进记录（{notes.length}）</div>
            <div className="flex flex-col gap-2">
              {notes.map((n) => (
                <div key={n.id} className="rounded-lg bg-zinc-900/40 border border-zinc-800/50 p-2.5">
                  <div className="flex items-center justify-between text-[11px] text-zinc-500 mb-1">
                    <span className="text-zinc-400">{n.author_username ?? "—"}</span>
                    <span className="font-mono-data">{fmtDateTime(n.created_at)}</span>
                  </div>
                  <p className="text-xs text-zinc-200 whitespace-pre-wrap">{n.note}</p>
                </div>
              ))}
              {notes.length === 0 && <div className="text-xs text-zinc-600">暂无跟进。</div>}
            </div>

            {canWrite && (
              <div className="flex items-end gap-2 mt-2.5">
                <div className="flex-1">
                  <Textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="添加跟进…"
                    className="min-h-[40px]"
                  />
                </div>
                <Button
                  icon={<Send size={13} />}
                  loading={addNote.isPending}
                  disabled={!note.trim()}
                  onClick={() => addNote.mutate()}
                >
                  发送
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
      </Modal>

      {deleting && (
        <ConfirmModal
          open
          onClose={() => setDeleting(false)}
          onConfirm={() => del.mutate()}
          title="删除维护记录"
          message="确定要删除该维护记录吗？此操作无法撤销。"
          confirmText="删除"
          confirmVariant="danger"
          loading={del.isPending}
        />
      )}
    </>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] text-zinc-500">{label}</span>
      <span className="text-zinc-200">{value}</span>
    </div>
  );
}
