import { useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, Moon, Sun, X } from "lucide-react";
import { pingHealth } from "../../lib/api";
import { API_BASE } from "../../lib/config";
import { useSettings } from "../../stores/settings";
import { Modal } from "./Modal";
import { Button, Field, Input } from "./primitives";

type TestState = "idle" | "testing" | "ok" | "fail";

export function SettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const { apiBase, theme, setApiBaseUrl, setTheme } = useSettings();

  const [url, setUrl] = useState(apiBase);
  const [test, setTest] = useState<TestState>("idle");
  const [saving, setSaving] = useState(false);

  const runTest = async () => {
    setTest("testing");
    const ok = await pingHealth(url);
    setTest(ok ? "ok" : "fail");
  };

  const save = async () => {
    setSaving(true);
    try {
      await setApiBaseUrl(url);
      // 后端可能已切换：清空缓存，强制各页面用新地址重新拉取
      qc.clear();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="设置"
      width="max-w-lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            取消
          </Button>
          <Button onClick={save} loading={saving}>
            保存
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        {/* 主题 */}
        <div className="flex flex-col gap-2">
          <span className="text-[11px] text-zinc-500">外观主题</span>
          <div className="flex items-center gap-2">
            <ThemeOption
              active={theme === "dark"}
              icon={<Moon size={14} />}
              label="深色"
              onClick={() => setTheme("dark")}
            />
            <ThemeOption
              active={theme === "light"}
              icon={<Sun size={14} />}
              label="浅色"
              onClick={() => setTheme("light")}
            />
          </div>
        </div>

        {/* 后端地址 */}
        <Field label="后端服务地址">
          <div className="flex items-center gap-2">
            <Input
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                setTest("idle");
              }}
              placeholder="http://127.0.0.1:8787"
              className="flex-1"
            />
            <Button variant="subtle" onClick={runTest} className="shrink-0">
              {test === "testing" ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                "测试连接"
              )}
            </Button>
          </div>
        </Field>

        {/* 测试结果 */}
        {test === "ok" && (
          <div className="flex items-center gap-1.5 text-xs text-emerald-400 -mt-2">
            <Check size={13} /> 连接成功，后端可达。
          </div>
        )}
        {test === "fail" && (
          <div className="flex items-center gap-1.5 text-xs text-red-400 -mt-2">
            <X size={13} /> 连接失败，请检查地址、端口与后端是否在运行。
          </div>
        )}

        <div className="text-[11px] text-zinc-500 leading-relaxed bg-zinc-900/40 border border-zinc-800/50 rounded-xl px-3 py-2.5">
          默认地址：<span className="font-mono-data text-zinc-400">{API_BASE}</span>
          <br />
          切换后端后会清空数据缓存并按新地址重新加载；若新后端不认当前登录，需重新登录。
          <br />
          注意：桌面端只能访问 <code className="text-zinc-400">capabilities/default.json</code> 中
          允许的地址，自定义地址需确保已在 http 允许列表内（已放开常见内网 http/https）。
        </div>
      </div>
    </Modal>
  );
}

function ThemeOption({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 px-3.5 h-9 rounded-xl text-xs font-medium border transition-colors cursor-pointer outline-none ${
        active
          ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
          : "text-zinc-400 border-zinc-800/60 hover:text-zinc-200 hover:border-zinc-700"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
