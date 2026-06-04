import { Select as RSelect } from "radix-ui";
import { Check, ChevronDown } from "lucide-react";

export interface Option {
  value: string;
  label: string;
}

// Radix 不允许 Item 的 value 为空字符串；用哨兵值在内部转换，
// 让调用方仍可用 value="" 表示「全部 / 未选」。
const EMPTY = "__wsop_empty__";
const toRadix = (v: string) => (v === "" ? EMPTY : v);
const fromRadix = (v: string) => (v === EMPTY ? "" : v);

/**
 * 基于 Radix Select 的下拉。API：value / onChange(value) / options。
 */
export function Select({
  value,
  onChange,
  options,
  placeholder,
  className = "",
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <RSelect.Root value={toRadix(value)} onValueChange={(v) => onChange(fromRadix(v))} disabled={disabled}>
      <RSelect.Trigger
        className={`h-10 px-3 rounded-md bg-zinc-950/40 border border-zinc-800/60 text-sm text-white outline-none focus:border-ln-primary focus:[box-shadow:var(--ring-primary)] transition-[border-color,box-shadow] duration-150 flex items-center justify-between gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed data-[placeholder]:text-zinc-600 ${className}`}
        aria-label={placeholder ?? "选择"}
      >
        <RSelect.Value placeholder={placeholder} />
        <RSelect.Icon className="text-zinc-500">
          <ChevronDown size={15} />
        </RSelect.Icon>
      </RSelect.Trigger>
      <RSelect.Portal>
        <RSelect.Content
          position="popper"
          sideOffset={6}
          className="wsop-popover z-[60] min-w-[var(--radix-select-trigger-width)] rounded-xl border border-white/10 bg-[#0c0f15] shadow-2xl overflow-hidden"
        >
          <RSelect.Viewport className="p-1 max-h-64">
            {options.map((o) => (
              <RSelect.Item
                key={o.value || EMPTY}
                value={toRadix(o.value)}
                className="flex items-center justify-between gap-2 px-2.5 h-8 rounded-lg text-sm text-zinc-300 outline-none cursor-pointer select-none data-[highlighted]:bg-emerald-500/12 data-[highlighted]:text-emerald-200 data-[state=checked]:text-emerald-300"
              >
                <RSelect.ItemText>{o.label}</RSelect.ItemText>
                <RSelect.ItemIndicator>
                  <Check size={14} className="text-emerald-400" />
                </RSelect.ItemIndicator>
              </RSelect.Item>
            ))}
          </RSelect.Viewport>
        </RSelect.Content>
      </RSelect.Portal>
    </RSelect.Root>
  );
}
