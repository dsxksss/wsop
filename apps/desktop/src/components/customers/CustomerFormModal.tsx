import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { CustomerSummaryDto } from "@wsop/shared";
import { api, ApiError } from "../../lib/api";
import { Modal } from "../ui/Modal";
import { Button, Field, Input, Textarea } from "../ui/primitives";

interface FormState {
  name: string;
  short_name: string;
  industry: string;
  contact_name: string;
  contact_phone: string;
  contact_email: string;
  address: string;
  notes: string;
}

function toForm(c?: CustomerSummaryDto): FormState {
  return {
    name: c?.name ?? "",
    short_name: c?.short_name ?? "",
    industry: c?.industry ?? "",
    contact_name: c?.contact_name ?? "",
    contact_phone: c?.contact_phone ?? "",
    contact_email: c?.contact_email ?? "",
    address: c?.address ?? "",
    notes: c?.notes ?? "",
  };
}

export function CustomerFormModal({
  open,
  onClose,
  initial,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  initial?: CustomerSummaryDto;
  onSaved?: (id: string) => void;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState<FormState>(() => toForm(initial));
  const [error, setError] = useState<string | null>(null);

  const set = (k: keyof FormState, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const mutation = useMutation({
    mutationFn: async () => {
      const body = {
        ...form,
        short_name: form.short_name || null,
        industry: form.industry || null,
        contact_name: form.contact_name || null,
        contact_phone: form.contact_phone || null,
        contact_email: form.contact_email || null,
        address: form.address || null,
        notes: form.notes || null,
      };
      const res = initial
        ? await api.put<{ customer: CustomerSummaryDto }>(`/customers/${initial.id}`, body)
        : await api.post<{ customer: CustomerSummaryDto }>("/customers", body);
      return res.customer.id;
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ["customers"] });
      if (initial) qc.invalidateQueries({ queryKey: ["customer", initial.id] });
      onSaved?.(id);
      onClose();
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : "保存失败"),
  });

  const submit = () => {
    setError(null);
    if (!form.name.trim()) {
      setError("客户名不能为空");
      return;
    }
    mutation.mutate();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? "编辑客户" : "登记客户"}
      width="max-w-lg"
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
        <Field label="企业名称" required>
          <Input value={form.name} onChange={(e) => set("name", e.target.value)} autoFocus />
        </Field>
        <div className="grid grid-cols-2 gap-3.5">
          <Field label="简称">
            <Input value={form.short_name} onChange={(e) => set("short_name", e.target.value)} />
          </Field>
          <Field label="行业">
            <Input value={form.industry} onChange={(e) => set("industry", e.target.value)} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3.5">
          <Field label="联系人">
            <Input
              value={form.contact_name}
              onChange={(e) => set("contact_name", e.target.value)}
            />
          </Field>
          <Field label="联系电话">
            <Input
              value={form.contact_phone}
              onChange={(e) => set("contact_phone", e.target.value)}
            />
          </Field>
        </div>
        <Field label="联系邮箱">
          <Input
            value={form.contact_email}
            onChange={(e) => set("contact_email", e.target.value)}
          />
        </Field>
        <Field label="地址">
          <Input value={form.address} onChange={(e) => set("address", e.target.value)} />
        </Field>
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
