import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, FileText, Trash2, Upload } from "lucide-react";
import type { CustomerFile } from "@wsop/shared";
import { api, downloadBlob, uploadFile } from "../../lib/api";
import { fmtDateTime, fmtSize } from "../../lib/format";
import { Button, EmptyState, Spinner } from "../ui/primitives";
import { ConfirmModal } from "../ui/ConfirmModal";

export function FilesTab({ customerId, canWrite }: { customerId: string; canWrite: boolean }) {
  const qc = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<CustomerFile | null>(null);

  const query = useQuery({
    queryKey: ["files", customerId],
    queryFn: () => api.get<CustomerFile[]>(`/customers/${customerId}/files`),
  });

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      await uploadFile(`/customers/${customerId}/files`, file);
      qc.invalidateQueries({ queryKey: ["files", customerId] });
    } catch (err) {
      setError(err instanceof Error ? err.message : "上传失败");
    } finally {
      setBusy(false);
    }
  };

  const onDownload = async (f: CustomerFile) => {
    try {
      const blob = await downloadBlob(`/files/${f.id}/download`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = f.filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "下载失败");
    }
  };

  const del = useMutation({
    mutationFn: (id: string) => api.del(`/files/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["files", customerId] });
      setDeleting(null);
    },
  });

  return (
    <div className="flex flex-col gap-3">
      {canWrite && (
        <div className="flex justify-end">
          <input ref={fileInput} type="file" className="hidden" onChange={onPick} />
          <Button
            icon={<Upload size={14} />}
            loading={busy}
            onClick={() => fileInput.current?.click()}
          >
            上传文件
          </Button>
        </div>
      )}

      {error && (
        <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      <div className="card overflow-hidden">
        {query.isLoading ? (
          <Spinner />
        ) : !query.data || query.data.length === 0 ? (
          <EmptyState>暂无文件，上传部署文档、配置或交付物。</EmptyState>
        ) : (
          <div className="flex flex-col divide-y divide-zinc-800/40">
            {query.data.map((f) => (
              <div key={f.id} className="flex items-center gap-3 px-4 py-3">
                <div className="w-8 h-8 rounded-lg bg-zinc-800/50 flex items-center justify-center shrink-0">
                  <FileText size={15} className="text-zinc-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-white truncate">{f.filename}</div>
                  <div className="text-[11px] text-zinc-500">
                    {fmtSize(f.size_bytes)} · {f.uploaded_by_username ?? "—"} ·{" "}
                    {fmtDateTime(f.created_at)}
                  </div>
                </div>
                <button
                  onClick={() => onDownload(f)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-400 hover:text-emerald-300 hover:bg-zinc-800/40 cursor-pointer"
                  title="下载"
                >
                  <Download size={15} />
                </button>
                {canWrite && (
                  <button
                    onClick={() => setDeleting(f)}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-400 hover:text-red-400 hover:bg-zinc-800/40 cursor-pointer"
                    title="删除"
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      {deleting && (
        <ConfirmModal
          open
          onClose={() => setDeleting(null)}
          onConfirm={() => del.mutate(deleting.id)}
          title="删除文件"
          message={`确定要删除文件「${deleting.filename}」吗？`}
          confirmText="删除"
          confirmVariant="danger"
          loading={del.isPending}
        />
      )}
    </div>
  );
}
