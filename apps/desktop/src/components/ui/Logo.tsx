/** 中性字母标识（无任何模板 IP）。emerald 渐变圆角方块 + 字母 W。 */
export function Logo({ size = 28 }: { size?: number }) {
  return (
    <div
      style={{ width: size, height: size, fontSize: Math.round(size * 0.5) }}
      className="rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shrink-0 font-bold text-white shadow-[0_2px_10px_-2px_rgba(16,185,129,0.5)] select-none"
    >
      W
    </div>
  );
}
