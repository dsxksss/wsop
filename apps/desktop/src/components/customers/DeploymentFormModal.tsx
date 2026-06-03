import { useState } from "react";
import { X } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Deployment } from "@wsop/shared";
import { api, ApiError } from "../../lib/api";
import { Modal } from "../ui/Modal";
import { Button, Field, Input } from "../ui/primitives";
import { DatePicker } from "../ui/DatePicker";
import { Select } from "../ui/Select";
import { Popover } from "radix-ui";

interface FormState {
  approval_no: string;
  submitted_at: string;
  department: string;
  purpose: string;
  concurrency_limit: string;
  user_count: string;
  license_expiry: string;
  module_count: string;
  modules: string;
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
  const today = new Date().toISOString().split("T")[0];
  const [form, setForm] = useState<FormState>(() => ({
    approval_no: initial?.approval_no ?? "",
    submitted_at: initial?.submitted_at ?? today,
    department: initial?.department ?? "",
    purpose: initial?.purpose ?? "",
    concurrency_limit: initial?.concurrency_limit?.toString() ?? "",
    user_count: initial?.user_count?.toString() ?? "",
    license_expiry: initial?.license_expiry ?? today,
    module_count: initial?.module_count?.toString() ?? "",
    modules: initial?.modules ?? "",
  }));
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof FormState, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const [selectedModules, setSelectedModules] = useState<string[]>(() =>
    initial?.modules ? initial.modules.split("、").filter(Boolean) : []
  );
  const [customInput, setCustomInput] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);

  const togglePreset = (preset: string) => {
    let next;
    if (selectedModules.includes(preset)) {
      next = selectedModules.filter((m) => m !== preset);
    } else {
      next = [...selectedModules, preset];
    }
    setSelectedModules(next);
    set("modules", next.join("、"));
  };

  const removeModule = (mod: string) => {
    const next = selectedModules.filter((m) => m !== mod);
    setSelectedModules(next);
    set("modules", next.join("、"));
  };

  const addCustom = () => {
    const val = customInput.trim();
    if (!val) return;
    if (!selectedModules.includes(val)) {
      const next = [...selectedModules, val];
      setSelectedModules(next);
      set("modules", next.join("、"));
    }
    setCustomInput("");
  };

  const mutation = useMutation({
    mutationFn: (approvalNo: string) => {
      const body = {
        product: "Wemol",
        version: null,
        environment: null,
        go_live_date: null,
        status: "active",
        notes: null,
        approval_no: approvalNo || null,
        submitted_at: form.submitted_at || null,
        department: form.department || null,
        purpose: form.purpose || null,
        concurrency_limit: form.concurrency_limit ? parseInt(form.concurrency_limit, 10) : null,
        user_count: form.user_count ? parseInt(form.user_count, 10) : null,
        license_expiry: form.license_expiry || null,
        module_count: form.module_count ? parseInt(form.module_count, 10) : null,
        modules: form.modules || null,
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
    let finalApprovalNo = form.approval_no.trim();
    if (!finalApprovalNo) {
      const now = new Date();
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, "0");
      const dd = String(now.getDate()).padStart(2, "0");
      const random4 = Math.floor(1000 + Math.random() * 9000);
      finalApprovalNo = `${yyyy}${mm}${dd}${random4}`;
    }
    mutation.mutate(finalApprovalNo);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? "编辑授权审批" : "新增授权审批"}
      width="max-w-2xl"
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
        <div className="grid grid-cols-2 gap-3.5">
          <Field label="审批编号">
            <Input
              value={form.approval_no}
              onChange={(e) => set("approval_no", e.target.value)}
              placeholder="留空则自动生成"
              autoFocus
            />
          </Field>
          <Field label="提交时间">
            <DatePicker
              value={form.submitted_at}
              onChange={(val) => set("submitted_at", val)}
            />
          </Field>
        </div>
        
        <div className="grid grid-cols-2 gap-3.5">
          <Field label="所在部门">
            <Select
              className="w-full"
              value={form.department}
              onChange={(v) => set("department", v)}
              placeholder="选择部门…"
              options={[
                { value: "", label: "选择部门…" },
                { value: "上海", label: "上海" },
                { value: "广州", label: "广州" },
                { value: "北京", label: "北京" },
              ]}
            />
          </Field>
          <Field label="目的">
            <Input
              value={form.purpose}
              onChange={(e) => set("purpose", e.target.value)}
              placeholder="输入申请目的"
            />
          </Field>
        </div>
        
        <div className="grid grid-cols-3 gap-3.5">
          <Field label="并发数">
            <Input
              type="number"
              min="0"
              value={form.concurrency_limit}
              onChange={(e) => set("concurrency_limit", e.target.value)}
              placeholder="无限制"
            />
          </Field>
          <Field label="用户数">
            <Input
              type="number"
              min="0"
              value={form.user_count}
              onChange={(e) => set("user_count", e.target.value)}
              placeholder="无限制"
            />
          </Field>
          <Field label="模块数">
            <Input
              type="number"
              min="0"
              value={form.module_count}
              onChange={(e) => set("module_count", e.target.value)}
              placeholder="0"
            />
          </Field>
        </div>
        
        <div className="grid grid-cols-2 gap-3.5">
          <Field label="Licence有效期">
            <DatePicker
              value={form.license_expiry}
              onChange={(val) => set("license_expiry", val)}
            />
          </Field>
          <Field label="包含模块">
            <div className="flex flex-col gap-2">
              {/* Tags list */}
              {selectedModules.length > 0 && (
                <div className="flex flex-wrap gap-1.5 p-2 rounded-xl bg-zinc-950/20 border border-zinc-800/40 min-h-9 items-center">
                  {selectedModules.map((m, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium animate-in fade-in-50 duration-200"
                    >
                      {m}
                      <button
                        type="button"
                        onClick={() => removeModule(m)}
                        className="w-3.5 h-3.5 rounded-full flex items-center justify-center text-emerald-400 hover:bg-emerald-500/20 cursor-pointer"
                      >
                        <X size={10} />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {/* Floating selection dropdown triggered by focus */}
              <div className="flex gap-2">
                <Popover.Root open={showDropdown} onOpenChange={setShowDropdown}>
                  <Popover.Trigger asChild>
                    <div className="flex-1">
                      <Input
                        value={customInput}
                        onChange={(e) => setCustomInput(e.target.value)}
                        onFocus={() => setShowDropdown(true)}
                        onPointerDown={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            addCustom();
                          }
                        }}
                        placeholder="点击选择或输入其他模块回车添加..."
                        className="h-8.5 text-xs w-full"
                      />
                    </div>
                  </Popover.Trigger>

                  <Popover.Portal>
                    <Popover.Content
                      align="start"
                      sideOffset={4}
                      onOpenAutoFocus={(e) => {
                        // Keep focus on the input, not the popup
                        e.preventDefault();
                      }}
                      className="z-55 w-64 p-1.5 rounded-xl border border-zinc-800/80 bg-[#0c0f15] shadow-2xl flex flex-col gap-0.5 max-h-48 overflow-y-auto outline-none"
                    >
                      <div className="text-[10px] text-zinc-500 px-2 py-1 font-semibold uppercase tracking-wider">
                        推荐模块
                      </div>
                      {["大分子", "小分子", "MD", "仅框架"].map((p) => {
                        const active = selectedModules.includes(p);
                        return (
                          <button
                            key={p}
                            type="button"
                            onMouseDown={(e) => {
                              // Prevent input blur
                              e.preventDefault();
                            }}
                            onClick={() => togglePreset(p)}
                            className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer flex items-center justify-between outline-none ${
                              active
                                ? "bg-emerald-500/10 text-emerald-400 font-semibold"
                                : "text-zinc-400 hover:bg-zinc-800/40 hover:text-white"
                            }`}
                          >
                            <span>{p}</span>
                            {active && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>}
                          </button>
                        );
                      })}
                    </Popover.Content>
                  </Popover.Portal>
                </Popover.Root>

                <Button
                  type="button"
                  variant="subtle"
                  className="h-8.5 text-xs shrink-0 px-3"
                  onClick={addCustom}
                >
                  添加
                </Button>
              </div>
            </div>
          </Field>
        </div>

        {error && (
          <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            {error}
          </div>
        )}
      </div>
    </Modal>
  );
}
