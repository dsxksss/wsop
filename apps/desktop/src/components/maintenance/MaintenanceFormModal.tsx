import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CustomerSummaryDto, Deployment } from "@wsop/shared";
import { api, ApiError } from "../../lib/api";
import { MAINTENANCE_TYPE_OPTIONS } from "../../lib/format";
import { useAuth } from "../../stores/auth";
import { Modal } from "../ui/Modal";
import { Button, Field, Input, Textarea } from "../ui/primitives";
import { Select } from "../ui/Select";
import { DatePicker } from "../ui/DatePicker";

/** 新建维护记录。fixedCustomerId 由客户详情页传入；全局页则展示客户选择。 */
export function MaintenanceFormModal({
  open,
  onClose,
  fixedCustomerId,
  deployments,
}: {
  open: boolean;
  onClose: () => void;
  fixedCustomerId?: string;
  deployments?: Deployment[];
}) {
  const qc = useQueryClient();
  const myId = useAuth((s) => s.user?.id);

  const [customerId, setCustomerId] = useState(fixedCustomerId ?? "");
  const [title, setTitle] = useState("");
  const [type, setType] = useState("inspection");
  const [deploymentId, setDeploymentId] = useState("");
  const [content, setContent] = useState("");
  const [maintainedAt, setMaintainedAt] = useState(() => new Date().toISOString().split("T")[0]);
  const [error, setError] = useState<string | null>(null);

  const customers = useQuery({
    queryKey: ["customers"],
    queryFn: () => api.get<CustomerSummaryDto[]>("/customers"),
    enabled: !fixedCustomerId,
  });

  const mutation = useMutation({
    mutationFn: () =>
      api.post("/maintenance-records", {
        customer_id: customerId,
        title,
        type,
        deployment_id: deploymentId || null,
        assignee_id: myId ?? null,
        content: content || null,
        maintained_at: maintainedAt ? new Date(maintainedAt).toISOString() : null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["maintenance"] });
      if (fixedCustomerId) {
        qc.invalidateQueries({ queryKey: ["maintenance", fixedCustomerId] });
        qc.invalidateQueries({ queryKey: ["customer", fixedCustomerId] });
      }
      onClose();
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : "保存失败"),
  });

  const submit = () => {
    setError(null);
    if (!customerId) {
      setError("请选择客户");
      return;
    }
    if (!title.trim()) {
      setError("标题不能为空");
      return;
    }
    mutation.mutate();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="新建维护记录"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            取消
          </Button>
          <Button onClick={submit} loading={mutation.isPending}>
            保存
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3.5">
        {!fixedCustomerId && (
          <Field label="客户" required>
            <Select
              className="w-full"
              value={customerId}
              onChange={setCustomerId}
              placeholder="选择客户…"
              options={[
                { value: "", label: "选择客户…" },
                ...(customers.data?.map((c) => ({ value: c.id, label: c.name })) ?? []),
              ]}
            />
          </Field>
        )}
        <Field label="标题" required>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
        </Field>
        <div className="grid grid-cols-2 gap-3.5">
          <Field label="类型">
            <Select
              className="w-full"
              value={type}
              onChange={setType}
              options={MAINTENANCE_TYPE_OPTIONS}
            />
          </Field>
          <Field label="维护时间">
            <DatePicker
              value={maintainedAt}
              onChange={setMaintainedAt}
            />
          </Field>
        </div>
        {deployments && deployments.length > 0 && (
          <Field label="关联部署">
            <Select
              className="w-full"
              value={deploymentId}
              onChange={setDeploymentId}
              options={[
                { value: "", label: "（不关联）" },
                ...deployments.map((d) => ({
                  value: d.id,
                  label: d.approval_no ? `Wemol (审批号: ${d.approval_no})` : "Wemol",
                })),
              ]}
            />
          </Field>
        )}
        <Field label="维护内容">
          <Textarea value={content} onChange={(e) => setContent(e.target.value)} />
        </Field>
        {error && (
          <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            {error}
          </div>
        )}
      </div>
    </Modal>
  );
}
