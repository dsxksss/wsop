import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyRound, Plus, Trash2 } from "lucide-react";
import type { UserDto, RoleResponseDto } from "@wsop/shared";
import { api, ApiError } from "../lib/api";
import { useAuth } from "../stores/auth";
import { Button, EmptyState, Field, Input, Spinner } from "../components/ui/primitives";
import { Modal } from "../components/ui/Modal";
import { ConfirmModal } from "../components/ui/ConfirmModal";
import { Select } from "../components/ui/Select";
import { Switch } from "../components/ui/Switch";



export default function Users() {
  const qc = useQueryClient();
  const myId = useAuth((s) => s.user?.id);
  const [creating, setCreating] = useState(false);
  const [resetting, setResetting] = useState<UserDto | null>(null);
  const [deletingUser, setDeletingUser] = useState<UserDto | null>(null);

  const query = useQuery({ queryKey: ["users"], queryFn: () => api.get<UserDto[]>("/users") });
  const rolesQuery = useQuery({ queryKey: ["roles"], queryFn: () => api.get<RoleResponseDto[]>("/roles") });
  const roleOptions = rolesQuery.data?.map((r) => ({ value: r.id, label: r.name })) ?? [];

  const patch = useMutation({
    mutationFn: (args: { id: string; body: Record<string, unknown> }) =>
      api.patch(`/users/${args.id}`, args.body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });
  const del = useMutation({
    mutationFn: (id: string) => api.del(`/users/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      setDeletingUser(null);
    },
  });

  return (
    <div className="p-6 md:p-8 flex flex-col gap-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold text-white tracking-tight">用户管理</h1>
          <p className="text-xs text-zinc-400 mt-0.5">账号、角色与启停</p>
        </div>
        <Button icon={<Plus size={14} />} onClick={() => setCreating(true)}>
          新建用户
        </Button>
      </div>

      <div className="card overflow-hidden">
        {query.isLoading ? (
          <Spinner />
        ) : !query.data || query.data.length === 0 ? (
          <EmptyState>暂无用户。</EmptyState>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wide text-zinc-500 border-b border-zinc-800/50">
                <th className="text-left font-medium px-4 py-3">用户名</th>
                <th className="text-left font-medium px-4 py-3 hidden md:table-cell">邮箱</th>
                <th className="text-left font-medium px-4 py-3">角色</th>
                <th className="text-left font-medium px-4 py-3">状态</th>
                <th className="text-right font-medium px-4 py-3">操作</th>
              </tr>
            </thead>
            <tbody>
              {query.data.map((u) => (
                <tr key={u.id} className="border-b border-zinc-800/30 last:border-0">
                  <td className="px-4 py-3 text-white font-medium">
                    {u.username}
                    {u.id === myId && <span className="text-[10px] text-zinc-500 ml-1.5">(我)</span>}
                  </td>
                  <td className="px-4 py-3 text-zinc-400 hidden md:table-cell">{u.email}</td>
                  <td className="px-4 py-3">
                    <Select
                      className="w-32"
                      value={u.role}
                      disabled={u.id === myId}
                      onChange={(v) => patch.mutate({ id: u.id, body: { role: v } })}
                      options={roleOptions}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={u.is_active}
                        disabled={u.id === myId}
                        onCheckedChange={(c) => patch.mutate({ id: u.id, body: { is_active: c } })}
                      />
                      <span className="text-[11px] text-zinc-500">
                        {u.is_active ? "启用" : "停用"}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => setResetting(u)}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-400 hover:text-amber-300 hover:bg-zinc-800/40 cursor-pointer"
                        title="重置密码"
                      >
                        <KeyRound size={14} />
                      </button>
                      {u.id !== myId && (
                        <button
                          onClick={() => setDeletingUser(u)}
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-400 hover:text-red-400 hover:bg-zinc-800/40 cursor-pointer"
                          title="删除"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {creating && <CreateUserModal roleOptions={roleOptions} onClose={() => setCreating(false)} />}
      {deletingUser && (
        <ConfirmModal
          open
          onClose={() => setDeletingUser(null)}
          onConfirm={() => del.mutate(deletingUser.id)}
          title="删除用户"
          message={`确定要删除用户「${deletingUser.username}」吗？`}
          confirmText="删除"
          confirmVariant="danger"
          loading={del.isPending}
        />
      )}
      {resetting && (
        <ResetPasswordModal
          user={resetting}
          onClose={() => setResetting(null)}
          onSubmit={(pw) => {
            patch.mutate({ id: resetting.id, body: { password: pw } });
            setResetting(null);
          }}
        />
      )}
    </div>
  );
}

function ResetPasswordModal({
  user,
  onClose,
  onSubmit,
}: {
  user: UserDto;
  onClose: () => void;
  onSubmit: (pw: string) => void;
}) {
  const [pw, setPw] = useState("");
  const [error, setError] = useState<string | null>(null);
  return (
    <Modal
      open
      onClose={onClose}
      title={`重置「${user.username}」的密码`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            取消
          </Button>
          <Button
            onClick={() => (pw.length < 8 ? setError("密码至少 8 位") : onSubmit(pw))}
          >
            确定
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3.5">
        <Field label="新密码" required>
          <Input
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            placeholder="至少 8 位"
            autoFocus
          />
        </Field>
        {error && <div className="text-xs text-red-400">{error}</div>}
      </div>
    </Modal>
  );
}

function CreateUserModal({
  roleOptions,
  onClose,
}: {
  roleOptions: Array<{ value: string; label: string }>;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState(roleOptions[0]?.value ?? "engineer");
  const [error, setError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: () => api.post("/users", { username, email, password, role }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      onClose();
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : "创建失败"),
  });

  const submit = () => {
    setError(null);
    if (!username.trim() || !email.trim()) return setError("用户名和邮箱必填");
    if (password.length < 8) return setError("密码至少 8 位");
    create.mutate();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="新建用户"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            取消
          </Button>
          <Button onClick={submit} loading={create.isPending}>
            创建
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3.5">
        <Field label="用户名" required>
          <Input value={username} onChange={(e) => setUsername(e.target.value)} autoFocus />
        </Field>
        <Field label="邮箱" required>
          <Input value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="初始密码" required>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="至少 8 位"
          />
        </Field>
        <Field label="角色">
          <Select className="w-full" value={role} onChange={setRole} options={roleOptions} />
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
