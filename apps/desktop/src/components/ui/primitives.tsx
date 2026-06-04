import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  TextareaHTMLAttributes,
} from "react";
import { Loader2 } from "lucide-react";

/* ---------------- Button ---------------- */

type Variant = "primary" | "ghost" | "danger" | "subtle";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-emerald-500 hover:bg-emerald-400 text-white",
  danger: "bg-red-500/90 hover:bg-red-500 text-white",
  ghost: "text-zinc-300 hover:text-white hover:bg-zinc-800/50 border border-zinc-800/60",
  subtle: "text-zinc-400 hover:text-white hover:bg-zinc-800/40",
};

export function Button({
  variant = "primary",
  loading,
  icon,
  children,
  className = "",
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  loading?: boolean;
  icon?: ReactNode;
}) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={`h-9 px-4 rounded-md text-[13px] font-medium flex items-center justify-center gap-1.5 transition-[transform,background-color,box-shadow] duration-150 cursor-pointer active:scale-[0.97] focus-visible:outline-none focus-visible:[box-shadow:var(--ring-primary)] disabled:opacity-50 disabled:cursor-not-allowed ${VARIANTS[variant]} ${className}`}
    >
      {loading ? <Loader2 size={14} className="animate-spin" /> : icon}
      {children}
    </button>
  );
}

/* ---------------- Field / Input / Textarea / Select ---------------- */

const INPUT_CLS =
  "w-full h-10 px-3 rounded-md bg-zinc-950/40 border border-zinc-800/60 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-ln-primary focus:[box-shadow:var(--ring-primary)] transition-[border-color,box-shadow] duration-150";

export function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-zinc-400">
        {label}
        {required && <span className="text-emerald-400 ml-0.5">*</span>}
      </span>
      {children}
    </label>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${INPUT_CLS} ${props.className ?? ""}`} />;
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`${INPUT_CLS} h-auto py-2 resize-y min-h-[80px] ${props.className ?? ""}`}
    />
  );
}

/* ---------------- Badge ---------------- */

type Tone = "emerald" | "amber" | "blue" | "zinc" | "red";
const TONES: Record<Tone, string> = {
  emerald: "bg-emerald-500/12 text-emerald-300 border-emerald-500/20",
  amber: "bg-amber-500/12 text-amber-300 border-amber-500/20",
  blue: "bg-blue-500/12 text-blue-300 border-blue-500/20",
  zinc: "bg-zinc-700/30 text-zinc-300 border-zinc-700/40",
  red: "bg-red-500/12 text-red-300 border-red-500/20",
};

export function Badge({ tone = "zinc", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border ${TONES[tone]}`}
    >
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  return status === "done" ? (
    <Badge tone="emerald">已完成</Badge>
  ) : (
    <Badge tone="amber">进行中</Badge>
  );
}

/* ---------------- States ---------------- */

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-xs text-zinc-500">
      <Loader2 size={16} className="animate-spin" />
      {label ?? "加载中…"}
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center justify-center py-12 text-xs text-zinc-500">{children}</div>
  );
}

export function ErrorState({ error }: { error: unknown }) {
  const msg = error instanceof Error ? error.message : "加载失败";
  return (
    <div className="flex items-center justify-center py-12 text-xs text-red-400">{msg}</div>
  );
}
