import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { Loader2, Lock, User, Settings } from "lucide-react";
import { useAuth } from "../stores/auth";
import { ApiError } from "../lib/api";
import { WindowControls } from "../components/layout/WindowControls";
import { Logo } from "../components/ui/Logo";
import { SettingsModal } from "../components/ui/SettingsModal";

export default function Login() {
  const status = useAuth((s) => s.status);
  const login = useAuth((s) => s.login);
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    if (status === "authed") navigate("/", { replace: true });
  }, [status, navigate]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(username.trim(), password);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "登录失败，请检查服务是否启动");
      setBusy(false);
    }
  };

  return (
    <div className="w-screen h-screen bg-[#060a0f] text-zinc-300 flex flex-col overflow-hidden relative select-none">
      <div className="absolute -bottom-40 -right-40 w-[700px] h-[700px] rounded-full bg-blue-500/10 blur-[150px] pointer-events-none" />

      {/* draggable top bar with window controls */}
      <div
        className="h-14 shrink-0 z-10 flex items-center justify-end px-3 gap-1.5"
        data-tauri-drag-region
      >
        <button
          onClick={() => setSettingsOpen(true)}
          className="w-9 h-9 rounded-lg hover:bg-zinc-800/40 text-zinc-400 hover:text-zinc-200 flex items-center justify-center transition-all cursor-pointer outline-none active:scale-95"
          title="设置"
        >
          <Settings size={16} />
        </button>
        <div className="w-px h-5 bg-zinc-800/70 mx-0.5" />
        <WindowControls />
      </div>

      <div className="flex-1 flex items-center justify-center z-10 px-6">
        <form
          onSubmit={onSubmit}
          className="card w-full max-w-sm p-8 flex flex-col items-center gap-5"
        >
          <Logo size={56} />
          <div className="text-center">
            <h1 className="text-lg font-bold text-white tracking-tight">wsop</h1>
            <p className="text-xs text-zinc-500 mt-1">私有化维护客户记录系统</p>
          </div>

          <div className="w-full flex flex-col gap-3 mt-2">
            <label className="flex items-center gap-2 h-11 px-3 rounded-xl bg-zinc-950/40 border border-zinc-800/60 focus-within:border-emerald-500/50 transition-colors">
              <User size={15} className="text-zinc-500 shrink-0" />
              <input
                className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-zinc-600"
                placeholder="用户名"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoFocus
              />
            </label>
            <label className="flex items-center gap-2 h-11 px-3 rounded-xl bg-zinc-950/40 border border-zinc-800/60 focus-within:border-emerald-500/50 transition-colors">
              <Lock size={15} className="text-zinc-500 shrink-0" />
              <input
                type="password"
                className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-zinc-600"
                placeholder="密码"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
          </div>

          {error && (
            <div className="w-full text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={busy || !username || !password}
            className="w-full h-11 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer active:scale-[0.99]"
          >
            {busy && <Loader2 size={15} className="animate-spin" />}
            登录
          </button>

          <p className="text-[10px] text-zinc-600">
            v{import.meta.env.VITE_APP_VERSION} · © 2026 wsop · 仅限授权运维人员使用
          </p>
        </form>
      </div>

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}
