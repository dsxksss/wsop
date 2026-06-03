import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Edit2, Plus, Trash2 } from "lucide-react";
import type { RoleResponseDto, RolePermissions } from "@wsop/shared";
import { api, ApiError } from "../lib/api";
import { useAuth } from "../stores/auth";
import { Button, EmptyState, Field, Input, Textarea, Spinner, Badge } from "../components/ui/primitives";
import { Modal } from "../components/ui/Modal";
import { ConfirmModal } from "../components/ui/ConfirmModal";
import { Select } from "../components/ui/Select";
import { Switch } from "../components/ui/Switch";

const PAGE_LABELS: Record<string, string> = {
  dashboard: "仪表盘",
  customers: "客户",
  maintenance: "维护记录",
  users: "用户管理",
  roles: "角色管理",
  audit: "审计日志",
};

const ACTION_LABELS: Record<string, string> = {
  "write:customers": "创建/编辑客户",
  "delete:customers": "删除客户",
  "write:deployments": "创建/编辑部署",
  "delete:deployments": "删除部署",
  "write:maintenance": "创建/编辑维护记录",
  "delete:maintenance": "删除维护记录",
  "write:files": "上传/编辑文件",
  "delete:files": "删除文件",
  "manage:users": "用户管理",
  "manage:roles": "角色管理",
};

const DATA_SCOPE_OPTIONS = [
  { value: "all", label: "全部数据 (系统内所有客户)" },
  { value: "assigned", label: "仅指派数据 (仅限被指派的客户)" },
];

export default function Roles() {
  const qc = useQueryClient();
  const user = useAuth((s) => s.user);
  
  const [creating, setCreating] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleResponseDto | null>(null);
  const [deletingRole, setDeletingRole] = useState<RoleResponseDto | null>(null);

  const query = useQuery({
    queryKey: ["roles"],
    queryFn: () => api.get<RoleResponseDto[]>("/roles"),
  });

  const del = useMutation({
    mutationFn: (id: string) => api.del(`/roles/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["roles"] });
      setDeletingRole(null);
    },
  });

  const isBuiltIn = (id: string) => ["admin", "engineer", "viewer"].includes(id);
  const canManage = user?.role === "admin" || user?.permissions.actions.includes("manage:roles");

  return (
    <div className="p-6 md:p-8 flex flex-col gap-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold text-white tracking-tight">角色管理</h1>
          <p className="text-xs text-zinc-400 mt-0.5">管理自定义角色的数据范围与功能权限</p>
        </div>
        {canManage && (
          <Button icon={<Plus size={14} />} onClick={() => setCreating(true)}>
            新建角色
          </Button>
        )}
      </div>

      <div className="card overflow-hidden">
        {query.isLoading ? (
          <Spinner />
        ) : !query.data || query.data.length === 0 ? (
          <EmptyState>暂无角色数据。</EmptyState>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wide text-zinc-500 border-b border-zinc-800/50">
                <th className="text-left font-medium px-4 py-3">角色名</th>
                <th className="text-left font-medium px-4 py-3 hidden md:table-cell">描述</th>
                <th className="text-left font-medium px-4 py-3">数据范围</th>
                <th className="text-left font-medium px-4 py-3">可访问页面</th>
                <th className="text-right font-medium px-4 py-3">操作</th>
              </tr>
            </thead>
            <tbody>
              {query.data.map((r) => (
                <tr key={r.id} className="border-b border-zinc-800/30 last:border-0 hover:bg-zinc-800/10">
                  <td className="px-4 py-3 text-white font-medium">
                    <div className="flex items-center gap-1.5">
                      {r.name}
                      {isBuiltIn(r.id) && (
                        <span className="text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded px-1">
                          内置
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-zinc-400 hidden md:table-cell max-w-xs truncate" title={r.description ?? ""}>
                    {r.description || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={r.permissions.data_scope === "all" ? "blue" : "amber"}>
                      {r.permissions.data_scope === "all" ? "全部客户" : "指派客户"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 max-w-sm">
                    <div className="flex flex-wrap gap-1">
                      {r.permissions.view_pages.map((p) => (
                        <span key={p} className="text-[10px] bg-zinc-800 text-zinc-300 rounded px-1.5 py-0.5">
                          {PAGE_LABELS[p] ?? p}
                        </span>
                      ))}
                      {r.permissions.view_pages.length === 0 && <span className="text-xs text-zinc-500">—</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {canManage && (
                        <>
                          <button
                            onClick={() => setEditingRole(r)}
                            disabled={r.id === "admin"}
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-400 hover:text-emerald-300 hover:bg-zinc-800/40 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                            title="编辑"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={() => setDeletingRole(r)}
                            disabled={isBuiltIn(r.id)}
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-400 hover:text-red-400 hover:bg-zinc-800/40 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                            title="删除"
                          >
                            <Trash2 size={14} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {creating && <RoleFormModal onClose={() => setCreating(false)} />}
      {editingRole && <RoleFormModal role={editingRole} onClose={() => setEditingRole(null)} />}
      {deletingRole && (
        <ConfirmModal
          open
          onClose={() => setDeletingRole(null)}
          onConfirm={() => del.mutate(deletingRole.id)}
          title="删除角色"
          message={`确定要删除角色「${deletingRole.name}」吗？删除后不可恢复。`}
          confirmText="删除"
          confirmVariant="danger"
          loading={del.isPending}
        />
      )}
    </div>
  );
}

function RoleFormModal({
  role,
  onClose,
}: {
  role?: RoleResponseDto;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState(role?.name ?? "");
  const [description, setDescription] = useState(role?.description ?? "");
  const [dataScope, setDataScope] = useState(role?.permissions.data_scope ?? "assigned");
  const [viewPages, setViewPages] = useState<string[]>(role?.permissions.view_pages ?? []);
  const [actions, setActions] = useState<string[]>(role?.permissions.actions ?? []);
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (body: { name: string; description: string | null; permissions: RolePermissions }) => {
      if (role) {
        return api.put(`/roles/${role.id}`, body);
      } else {
        return api.post("/roles", body);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["roles"] });
      onClose();
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : "保存失败"),
  });

  const handlePageToggle = (page: string) => {
    setViewPages((prev) =>
      prev.includes(page) ? prev.filter((p) => p !== page) : [...prev, page]
    );
  };

  const handleActionToggle = (action: string) => {
    setActions((prev) =>
      prev.includes(action) ? prev.filter((a) => a !== action) : [...prev, action]
    );
  };

  const submit = () => {
    setError(null);
    if (!name.trim()) return setError("角色名称不能为空");

    const permissions: RolePermissions = {
      data_scope: dataScope,
      view_pages: viewPages,
      actions: actions,
    };

    mutation.mutate({
      name: name.trim(),
      description: description.trim() || null,
      permissions,
    });
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={role ? `编辑角色: ${role.name}` : "新建角色"}
      width="max-w-xl"
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
      <div className="flex flex-col gap-4">
        <Field label="角色名称" required>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例如: 客户维护员、只读工程人员"
            autoFocus
          />
        </Field>

        <Field label="描述">
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="关于该角色的职责或范围说明"
          />
        </Field>

        <Field label="数据范围">
          <Select
            className="w-full"
            value={dataScope}
            onChange={setDataScope}
            options={DATA_SCOPE_OPTIONS}
          />
        </Field>

        <div>
          <span className="text-xs font-medium text-zinc-400 block mb-2">可访问页面</span>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 bg-zinc-950/20 border border-zinc-900 rounded-xl p-3">
            {Object.entries(PAGE_LABELS).map(([key, label]) => (
              <div key={key} className="flex items-center justify-between bg-zinc-900/10 border border-zinc-800/40 px-2.5 py-1.5 rounded-lg text-xs text-zinc-300 select-none">
                <span>{label}</span>
                <Switch
                  checked={viewPages.includes(key)}
                  onCheckedChange={() => handlePageToggle(key)}
                />
              </div>
            ))}
          </div>
        </div>

        <div>
          <span className="text-xs font-medium text-zinc-400 block mb-2">操作权限</span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-zinc-950/20 border border-zinc-900 rounded-xl p-3">
            {Object.entries(ACTION_LABELS).map(([key, label]) => (
              <div key={key} className="flex items-center justify-between bg-zinc-900/10 border border-zinc-800/40 px-2.5 py-1.5 rounded-lg text-xs text-zinc-300 select-none">
                <span>{label}</span>
                <Switch
                  checked={actions.includes(key)}
                  onCheckedChange={() => handleActionToggle(key)}
                />
              </div>
            ))}
          </div>
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
