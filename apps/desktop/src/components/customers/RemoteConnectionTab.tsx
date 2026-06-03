import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Eye,
  EyeOff,
  Pencil,
  Plus,
  Trash2,
  Link,
  Copy,
  Check,
  Globe,
  Terminal,
  ExternalLink,
} from "lucide-react";
import type { CustomerRemoteConnection } from "@wsop/shared";
import { api } from "../../lib/api";
import { Button, EmptyState, Field, Input, Textarea } from "../ui/primitives";
import { Modal } from "../ui/Modal";
import { ConfirmModal } from "../ui/ConfirmModal";

// Helper for Copy Button with checkmark animation feedback
function CopyButton({ text, className = "" }: { text: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button
      onClick={handleCopy}
      type="button"
      className={`p-1.5 rounded-lg text-zinc-500 hover:text-emerald-400 hover:bg-zinc-800/50 transition-colors cursor-pointer shrink-0 ${className}`}
      title="复制"
    >
      {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
    </button>
  );
}

interface WebAccount {
  username: string;
  password: string;
}

interface SSHConnection {
  host: string;
  port: string;
  username: string;
  password: string;
}

interface ConnectionDetails {
  front_url: string;
  front_accounts: WebAccount[];
  back_url: string;
  back_accounts: WebAccount[];
  ssh_connections: SSHConnection[];
  description: string;
}

function parseConnectionInfo(info: string | null | undefined): ConnectionDetails {
  const fallback: ConnectionDetails = {
    front_url: "",
    front_accounts: [],
    back_url: "",
    back_accounts: [],
    ssh_connections: [],
    description: info ?? "",
  };
  if (!info) return fallback;
  try {
    const parsed = JSON.parse(info);
    if (parsed && typeof parsed === "object") {
      // 1. Parse front URL (with fallback to old login_url)
      let parsedFrontUrl = typeof parsed.front_url === "string" ? parsed.front_url : "";
      if (!parsedFrontUrl && typeof parsed.login_url === "string") {
        parsedFrontUrl = parsed.login_url;
      }

      // 2. Parse front accounts (with fallback to old web_accounts)
      let parsedFrontAccounts: WebAccount[] = [];
      const rawFront = parsed.front_accounts || parsed.web_accounts;
      if (Array.isArray(rawFront)) {
        parsedFrontAccounts = rawFront.map((item: any) => {
          if (item && typeof item === "object") {
            // legacy extractor
            if (item.url && !parsedFrontUrl) {
              parsedFrontUrl = item.url;
            }
            return {
              username: typeof item.username === "string" ? item.username : "",
              password: typeof item.password === "string" ? item.password : "",
            };
          }
          return { username: "", password: "" };
        });
      }

      // 3. Parse back URL
      const parsedBackUrl = typeof parsed.back_url === "string" ? parsed.back_url : "";

      // 4. Parse back accounts
      let parsedBackAccounts: WebAccount[] = [];
      if (Array.isArray(parsed.back_accounts)) {
        parsedBackAccounts = parsed.back_accounts.map((item: any) => {
          if (item && typeof item === "object") {
            return {
              username: typeof item.username === "string" ? item.username : "",
              password: typeof item.password === "string" ? item.password : "",
            };
          }
          return { username: "", password: "" };
        });
      }

      return {
        front_url: parsedFrontUrl,
        front_accounts: parsedFrontAccounts,
        back_url: parsedBackUrl,
        back_accounts: parsedBackAccounts,
        ssh_connections: Array.isArray(parsed.ssh_connections) ? parsed.ssh_connections : [],
        description: typeof parsed.description === "string" ? parsed.description : "",
      };
    }
  } catch (e) {
    // fallback
  }
  return fallback;
}

interface RemoteConnectionFormModalProps {
  open: boolean;
  onClose: () => void;
  customerId: string;
  initial?: CustomerRemoteConnection;
}

function RemoteConnectionFormModal({
  open,
  onClose,
  customerId,
  initial,
}: RemoteConnectionFormModalProps) {
  const qc = useQueryClient();
  const [name, setName] = useState(initial?.name ?? "生产环境");
  const [error, setError] = useState<string | null>(null);

  // Parse structured details
  const [frontUrl, setFrontUrl] = useState(() => {
    const details = parseConnectionInfo(initial?.connection_info);
    return details.front_url;
  });

  const [frontAccounts, setFrontAccounts] = useState<WebAccount[]>(() => {
    const details = parseConnectionInfo(initial?.connection_info);
    // Migrate legacy data if empty and no back accounts
    if (initial?.wemol_username && details.front_accounts.length === 0 && details.back_accounts.length === 0) {
      return [
        {
          username: initial.wemol_username,
          password: initial.wemol_password ?? "",
        },
      ];
    }
    // Pre-populate with one empty row for new records to ease data entry
    return details.front_accounts.length > 0 ? details.front_accounts : [{ username: "", password: "" }];
  });

  const [backUrl, setBackUrl] = useState(() => {
    const details = parseConnectionInfo(initial?.connection_info);
    return details.back_url;
  });

  const [backAccounts, setBackAccounts] = useState<WebAccount[]>(() => {
    const details = parseConnectionInfo(initial?.connection_info);
    return details.back_accounts;
  });

  const [sshConnections, setSshConnections] = useState<SSHConnection[]>(() => {
    const details = parseConnectionInfo(initial?.connection_info);
    return details.ssh_connections;
  });

  const [description, setDescription] = useState(() => {
    const details = parseConnectionInfo(initial?.connection_info);
    return details.description;
  });

  const addFrontAccount = () => {
    setFrontAccounts([...frontAccounts, { username: "", password: "" }]);
  };

  const removeFrontAccount = (index: number) => {
    setFrontAccounts(frontAccounts.filter((_, i) => i !== index));
  };

  const updateFrontAccount = (index: number, key: keyof WebAccount, val: string) => {
    setFrontAccounts(
      frontAccounts.map((item, i) => (i === index ? { ...item, [key]: val } : item))
    );
  };

  const addBackAccount = () => {
    setBackAccounts([...backAccounts, { username: "", password: "" }]);
  };

  const removeBackAccount = (index: number) => {
    setBackAccounts(backAccounts.filter((_, i) => i !== index));
  };

  const updateBackAccount = (index: number, key: keyof WebAccount, val: string) => {
    setBackAccounts(
      backAccounts.map((item, i) => (i === index ? { ...item, [key]: val } : item))
    );
  };

  const addSSHConnection = () => {
    setSshConnections([...sshConnections, { host: "", port: "22", username: "", password: "" }]);
  };

  const removeSSHConnection = (index: number) => {
    setSshConnections(sshConnections.filter((_, i) => i !== index));
  };

  const updateSSHConnection = (index: number, key: keyof SSHConnection, val: string) => {
    setSshConnections(
      sshConnections.map((item, i) => (i === index ? { ...item, [key]: val } : item))
    );
  };

  const mutation = useMutation({
    mutationFn: (finalName: string) => {
      const serializedInfo = JSON.stringify({
        front_url: frontUrl,
        front_accounts: frontAccounts,
        back_url: backUrl,
        back_accounts: backAccounts,
        ssh_connections: sshConnections,
        description: description,
      });

      const body = {
        name: finalName,
        wemol_username: frontAccounts[0]?.username || backAccounts[0]?.username || null,
        wemol_password: frontAccounts[0]?.password || backAccounts[0]?.password || null,
        connection_info: serializedInfo,
      };

      return initial
        ? api.put(`/remote-connections/${initial.id}`, body)
        : api.post(`/customers/${customerId}/remote-connections`, body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customer", customerId] });
      onClose();
    },
    onError: (e) => {
      setError(e instanceof Error ? e.message : "保存失败");
    },
  });

  const submit = () => {
    setError(null);
    const finalName = name.trim() || "生产环境";
    mutation.mutate(finalName);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? "编辑远程连接" : "添加远程连接"}
      width="max-w-4xl"
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
      <div className="flex flex-col gap-5">
        <Field label="连接环境名称">
          <div className="flex gap-2.5 items-center">
            <div className="flex-1">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="如: 生产环境 / 测试环境 (留空默认为 生产环境)"
                autoFocus
              />
            </div>
            <div className="flex gap-1.5 shrink-0">
              {["生产环境", "测试环境"].map((preset) => {
                const active = name === preset;
                return (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setName(preset)}
                    className={`px-3 py-1.5 rounded-xl text-xs border transition-all cursor-pointer font-medium active:scale-95 ${
                      active
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.05)]"
                        : "bg-zinc-950/20 text-zinc-400 border-zinc-800/60 hover:border-zinc-700/60 hover:text-white"
                    }`}
                  >
                    {preset}
                  </button>
                );
              })}
            </div>
          </div>
        </Field>

        {/* Web Accounts side-by-side grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 bg-zinc-950/20 border border-zinc-800/40 rounded-2xl p-4">
          {/* Left: Front-stage Web Accounts */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between border-b border-zinc-800/40 pb-2">
              <h4 className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                <Globe size={13} />
                前台网页账户（普通用户）
              </h4>
              <Button
                type="button"
                variant="subtle"
                className="h-6 px-1.5 text-[10px] rounded-lg"
                icon={<Plus size={10} />}
                onClick={addFrontAccount}
              >
                新增账户
              </Button>
            </div>

            <Field label="前台登录地址">
              <Input
                value={frontUrl}
                onChange={(e) => setFrontUrl(e.target.value)}
                placeholder="登录地址 (如: http://...)"
                className="h-8.5 text-xs"
              />
            </Field>

            <div className="flex flex-col gap-2.5 mt-1">
              <span className="text-[10px] text-zinc-500 font-medium">账户密码对</span>
              {frontAccounts.map((acc, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <Input
                    value={acc.username}
                    onChange={(e) => updateFrontAccount(idx, "username", e.target.value)}
                    placeholder="用户名"
                    className="h-8.5 text-xs flex-1"
                  />
                  <Input
                    value={acc.password}
                    onChange={(e) => updateFrontAccount(idx, "password", e.target.value)}
                    placeholder="密码"
                    className="h-8.5 text-xs flex-1"
                  />
                  {frontAccounts.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeFrontAccount(idx)}
                      className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg cursor-pointer shrink-0"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Right: Back-stage Web Accounts */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between border-b border-zinc-800/40 pb-2">
              <h4 className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                <Globe size={13} />
                后台网页账户（管理员）
              </h4>
              <Button
                type="button"
                variant="subtle"
                className="h-6 px-1.5 text-[10px] rounded-lg"
                icon={<Plus size={10} />}
                onClick={addBackAccount}
              >
                新增账户
              </Button>
            </div>

            <Field label="后台登录地址">
              <Input
                value={backUrl}
                onChange={(e) => setBackUrl(e.target.value)}
                placeholder="登录地址 (如: http://.../ui/#/system/login/)"
                className="h-8.5 text-xs"
              />
            </Field>

            <div className="flex flex-col gap-2.5 mt-1">
              <span className="text-[10px] text-zinc-500 font-medium">账户密码对</span>
              {backAccounts.length === 0 ? (
                <button
                  type="button"
                  onClick={addBackAccount}
                  className="text-xs text-zinc-500 hover:text-emerald-400 border border-dashed border-zinc-800/50 rounded-xl py-3 text-center cursor-pointer transition-colors hover:bg-zinc-900/20 outline-none"
                >
                  + 添加后台账户（点击录入）
                </button>
              ) : (
                backAccounts.map((acc, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <Input
                      value={acc.username}
                      onChange={(e) => updateBackAccount(idx, "username", e.target.value)}
                      placeholder="用户名"
                      className="h-8.5 text-xs flex-1"
                    />
                    <Input
                      value={acc.password}
                      onChange={(e) => updateBackAccount(idx, "password", e.target.value)}
                      placeholder="密码"
                      className="h-8.5 text-xs flex-1"
                    />
                    <button
                      type="button"
                      onClick={() => removeBackAccount(idx)}
                      className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg cursor-pointer shrink-0"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* SSH Connection list */}
        <div className="bg-zinc-950/20 border border-zinc-800/40 rounded-2xl p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between border-b border-zinc-800/40 pb-2">
            <h4 className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
              <Terminal size={13} />
              SSH 远程连接
            </h4>
            <Button
              type="button"
              variant="subtle"
              className="h-6 px-1.5 text-[10px] rounded-lg"
              icon={<Plus size={10} />}
              onClick={addSSHConnection}
            >
              新增连接
            </Button>
          </div>

          <div className="flex flex-col gap-2.5">
            {sshConnections.length === 0 ? (
              <button
                type="button"
                onClick={addSSHConnection}
                className="text-xs text-zinc-500 hover:text-emerald-400 border border-dashed border-zinc-800/50 rounded-xl py-4.5 text-center cursor-pointer transition-colors hover:bg-zinc-900/20 outline-none"
              >
                + 添加 SSH 连接配置（点击展开 IP、端口、凭证）
              </button>
            ) : (
              sshConnections.map((ssh, idx) => (
                <div key={idx} className="flex gap-2 items-center bg-zinc-900/20 p-2.5 rounded-xl border border-zinc-800/40">
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 flex-1">
                    <Input
                      value={ssh.host}
                      onChange={(e) => updateSSHConnection(idx, "host", e.target.value)}
                      placeholder="主机 IP / 域名"
                      className="h-8.5 text-xs"
                    />
                    <Input
                      value={ssh.port}
                      onChange={(e) => updateSSHConnection(idx, "port", e.target.value)}
                      placeholder="端口 (默认 22)"
                      className="h-8.5 text-xs"
                    />
                    <Input
                      value={ssh.username}
                      onChange={(e) => updateSSHConnection(idx, "username", e.target.value)}
                      placeholder="用户名"
                      className="h-8.5 text-xs"
                    />
                    <Input
                      value={ssh.password}
                      onChange={(e) => updateSSHConnection(idx, "password", e.target.value)}
                      placeholder="密码"
                      className="h-8.5 text-xs"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeSSHConnection(idx)}
                    className="p-2 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg cursor-pointer transition-colors shrink-0"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Remarks Section */}
        <div className="bg-zinc-950/20 border border-zinc-800/40 rounded-2xl p-4">
          <Field label="其它连接说明及备注 (如客户需求背景、堡垒机登录指引等)">
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="填写其它说明或备注内容..."
              className="min-h-[90px] text-xs"
            />
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

// Inner helper row components for clean card display
function AccountRow({ username, password }: { username: string; password?: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="flex items-center justify-between bg-zinc-950/20 border border-zinc-800/40 rounded-xl px-3 py-1.5 min-w-0">
      <div className="flex items-center gap-4 text-xs min-w-0 flex-1">
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <span className="text-zinc-500 font-medium shrink-0">账号:</span>
          <span className="text-zinc-300 font-mono truncate">{username || "—"}</span>
          {username && <CopyButton text={username} className="p-0.5" />}
        </div>
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <span className="text-zinc-500 font-medium shrink-0">密码:</span>
          <span className="text-zinc-300 font-mono truncate">
            {password ? (show ? password : "••••••••") : "—"}
          </span>
          {password && (
            <>
              <button
                onClick={() => setShow(!show)}
                className="text-zinc-500 hover:text-zinc-300 cursor-pointer shrink-0"
                type="button"
              >
                {show ? <EyeOff size={13} /> : <Eye size={13} />}
              </button>
              <CopyButton text={password} className="p-0.5" />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function SSHRow({ host, port, username, password }: SSHConnection) {
  const [show, setShow] = useState(false);
  const sshCmd = `ssh ${username || "root"}@${host || "ip"} -p ${port || "22"}`;

  return (
    <div className="flex flex-col gap-2 py-1">
      <div className="flex items-center justify-between bg-zinc-950/40 border border-zinc-800/60 rounded-xl px-3 py-1.5 font-mono text-[11px] text-zinc-300 min-w-0">
        <span className="truncate select-all">{sshCmd}</span>
        <div className="flex items-center gap-1 shrink-0">
          <span className="text-[9px] bg-zinc-800 text-zinc-400 px-1 py-0.5 rounded">指令</span>
          <CopyButton text={sshCmd} className="p-1" />
        </div>
      </div>
      <div className="flex items-center gap-4 text-xs bg-zinc-950/20 border border-zinc-800/40 rounded-xl px-3 py-1.5 min-w-0">
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <span className="text-zinc-500 font-medium shrink-0">IP/端口:</span>
          <span className="text-zinc-300 font-mono truncate">{host}:{port || "22"}</span>
        </div>
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <span className="text-zinc-500 font-medium shrink-0">用户名:</span>
          <span className="text-zinc-300 font-mono truncate">{username || "—"}</span>
          {username && <CopyButton text={username} className="p-0.5" />}
        </div>
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <span className="text-zinc-500 font-medium shrink-0">密码:</span>
          <span className="text-zinc-300 font-mono truncate">
            {password ? (show ? password : "••••••••") : "—"}
          </span>
          {password && (
            <>
              <button
                onClick={() => setShow(!show)}
                className="text-zinc-500 hover:text-zinc-300 cursor-pointer shrink-0"
                type="button"
              >
                {show ? <EyeOff size={13} /> : <Eye size={13} />}
              </button>
              <CopyButton text={password} className="p-0.5" />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export function RemoteConnectionTab({
  customerId,
  connections = [],
  canWrite,
  createOpen,
  setCreateOpen,
}: {
  customerId: string;
  connections?: CustomerRemoteConnection[];
  canWrite: boolean;
  /** 新建流程由父级（客户详情顶部按钮）控制。 */
  createOpen: boolean;
  setCreateOpen: (open: boolean) => void;
}) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<CustomerRemoteConnection | null>(null);
  const [deleting, setDeleting] = useState<CustomerRemoteConnection | null>(null);

  const del = useMutation({
    mutationFn: (id: string) => api.del(`/remote-connections/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customer", customerId] });
      setDeleting(null);
    },
  });

  return (
    <div className="flex flex-col gap-3">
      {connections.length === 0 ? (
        <div className="card">
          <EmptyState>
            <div className="flex flex-col items-center gap-3">
              <span>暂无远程连接信息。</span>
              {canWrite && (
                <Button variant="ghost" icon={<Plus size={12} />} onClick={() => setCreateOpen(true)}>
                  立即添加
                </Button>
              )}
            </div>
          </EmptyState>
        </div>
      ) : (
        <div
          className={`grid gap-4 items-start ${
            connections.length === 1 ? "grid-cols-1" : "grid-cols-1 lg:grid-cols-2"
          }`}
        >
          {connections.map((conn) => {
            const details = parseConnectionInfo(conn.connection_info);

            return (
              <div key={conn.id} className="card p-5 flex flex-col gap-4">
                <div className="flex items-center justify-between border-b border-zinc-800/40 pb-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                      <Link size={15} className="text-emerald-400" />
                    </div>
                    <h3 className="text-sm font-bold text-white truncate" title={conn.name}>
                      {conn.name}
                    </h3>
                  </div>
                  {canWrite && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => setEditing(conn)}
                        className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800/50 cursor-pointer"
                        title="编辑"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={() => setDeleting(conn)}
                        className="p-1.5 rounded-lg text-zinc-400 hover:text-red-400 hover:bg-red-500/10 cursor-pointer"
                        title="删除"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  )}
                </div>

                {/* Description Text */}
                {details.description && (
                  <div className="text-xs text-zinc-300 leading-relaxed whitespace-pre-wrap bg-zinc-950/10 p-3 rounded-xl border border-zinc-800/20 font-sans break-all">
                    {details.description}
                  </div>
                )}

                {/* 1. Front-stage Web Accounts Section */}
                {(details.front_accounts.length > 0 || details.front_url || conn.wemol_username) && (
                  <div className="flex flex-col gap-2">
                    <div className="text-[10px] uppercase font-bold tracking-wider text-emerald-400/90 flex items-center gap-1.5">
                      <Globe size={11} className="text-emerald-400" />
                      前台网页账户（普通用户）
                    </div>
                    <div className="flex flex-col bg-zinc-950/20 rounded-xl p-3 border border-zinc-800/40 gap-3">
                      {details.front_url && (
                        <div className="flex items-center gap-1.5 text-[11px] text-zinc-400 pb-2 border-b border-zinc-800/30 min-w-0">
                          <span className="text-zinc-500 font-medium shrink-0">登录地址:</span>
                          <a
                            href={details.front_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-emerald-400 hover:underline truncate flex items-center gap-1 min-w-0 font-mono active:scale-[0.99] transition-transform"
                          >
                            {details.front_url}
                            <ExternalLink size={10} className="shrink-0" />
                          </a>
                          <CopyButton text={details.front_url} className="p-1" />
                        </div>
                      )}

                      <div className="flex flex-col gap-2.5">
                        {/* Show legacy single account if exists */}
                        {conn.wemol_username && !details.front_accounts.some(a => a.username === conn.wemol_username) && details.back_accounts.length === 0 && (
                          <AccountRow
                            username={conn.wemol_username}
                            password={conn.wemol_password || ""}
                          />
                        )}
                        {details.front_accounts.map((acc, idx) => (
                          <AccountRow
                            key={idx}
                            username={acc.username}
                            password={acc.password}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. Back-stage Web Accounts Section */}
                {(details.back_accounts.length > 0 || details.back_url) && (
                  <div className="flex flex-col gap-2">
                    <div className="text-[10px] uppercase font-bold tracking-wider text-emerald-400/90 flex items-center gap-1.5">
                      <Globe size={11} className="text-emerald-400" />
                      后台网页账户（管理员）
                    </div>
                    <div className="flex flex-col bg-zinc-950/20 rounded-xl p-3 border border-zinc-800/40 gap-3">
                      {details.back_url && (
                        <div className="flex items-center gap-1.5 text-[11px] text-zinc-400 pb-2 border-b border-zinc-800/30 min-w-0">
                          <span className="text-zinc-500 font-medium shrink-0">登录地址:</span>
                          <a
                            href={details.back_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-emerald-400 hover:underline truncate flex items-center gap-1 min-w-0 font-mono active:scale-[0.99] transition-transform"
                          >
                            {details.back_url}
                            <ExternalLink size={10} className="shrink-0" />
                          </a>
                          <CopyButton text={details.back_url} className="p-1" />
                        </div>
                      )}

                      <div className="flex flex-col gap-2.5">
                        {details.back_accounts.map((acc, idx) => (
                          <AccountRow
                            key={idx}
                            username={acc.username}
                            password={acc.password}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* SSH Connections Section */}
                {details.ssh_connections.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <div className="text-[10px] uppercase font-bold tracking-wider text-emerald-400/90 flex items-center gap-1.5">
                      <Terminal size={11} className="text-emerald-400" />
                      SSH 远程连接
                    </div>
                    <div className="flex flex-col bg-zinc-950/20 rounded-xl p-3 border border-zinc-800/40 gap-3.5">
                      {details.ssh_connections.map((ssh, idx) => (
                        <SSHRow
                          key={idx}
                          host={ssh.host}
                          port={ssh.port}
                          username={ssh.username}
                          password={ssh.password}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {createOpen && (
        <RemoteConnectionFormModal
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          customerId={customerId}
        />
      )}

      {editing && (
        <RemoteConnectionFormModal
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
          title="删除远程连接"
          message={`确定要删除远程连接配置「${deleting.name}」吗？`}
          confirmText="删除"
          confirmVariant="danger"
          loading={del.isPending}
        />
      )}
    </div>
  );
}
