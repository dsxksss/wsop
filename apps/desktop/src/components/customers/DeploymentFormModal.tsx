import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Deployment } from "@wsop/shared";
import { api, ApiError } from "../../lib/api";
import { Modal } from "../ui/Modal";
import { Button, Field, Input, Textarea } from "../ui/primitives";
import { Select } from "../ui/Select";

interface FormState {
  product: string;
  version: string;
  environment: string;
  go_live_date: string;
  status: string;
  notes: string;
}

export function DeploymentFormModal({
  open,
  onClose,
  customerId,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  customerId: string;
  initial?: Deployment;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState<FormState>(() => ({
    product: initial?.product ?? "",
    version: initial?.version ?? "",
    environment: initial?.environment ?? "",
    go_live_date: initial?.go_live_date ?? "",
    status: initial?.status ?? "active",
    notes: initial?.notes ?? "",
  }));
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof FormState, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const mutation = useMutation({
    mutationFn: () => {
      const body = {
        product: form.product,
        version: form.version || null,
        environment: form.environment || null,
        go_live_date: form.go_live_date || null,
        status: form.status,
        notes: form.notes || null,
      };
      return initial
        ? api.put(`/deployments/${initial.id}`, body)
        : api.post(`/customers/${customerId}/deployments`, body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customer", customerId] });
      onClose();
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : "保存失败"),
  });

  const submit = () => {
    setError(null);
    if (!form.product.trim()) {
      setError("产品名不能为空");
      return;
    }
    mutation.mutate();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? "编辑部署" : "新增部署"}
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
        <Field label="产品名称" required>
          <Input value={form.product} onChange={(e) => set("product", e.target.value)} autoFocus />
        </Field>
        <div className="grid grid-cols-2 gap-3.5">
          <Field label="版本">
            <Input value={form.version} onChange={(e) => set("version", e.target.value)} />
          </Field>
          <Field label="环境">
            <Input
              value={form.environment}
              onChange={(e) => set("environment", e.target.value)}
              placeholder="生产 / 测试 / 灾备"
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3.5">
          <Field label="上线日期">
            <Input
              type="date"
              value={form.go_live_date}
              onChange={(e) => set("go_live_date", e.target.value)}
            />
          </Field>
          <Field label="状态">
            <Select
              className="w-full"
              value={form.status}
              onChange={(v) => set("status", v)}
              options={[
                { value: "active", label: "在用" },
                { value: "retired", label: "已下线" },
              ]}
            />
          </Field>
        </div>
        <Field label="备注">
          <Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} />
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
