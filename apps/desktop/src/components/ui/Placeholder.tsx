import type { ReactNode } from "react";

/** 占位页：M6 业务页面尚未实现时的统一占位。 */
export function Placeholder({ title, hint }: { title: string; hint?: ReactNode }) {
  return (
    <div className="p-6 md:p-8 flex flex-col gap-6">
      <h1 className="text-lg font-bold text-white tracking-tight">{title}</h1>
      <div className="card p-10 flex items-center justify-center text-xs text-zinc-500">
        {hint ?? "该模块即将实现（M6）。"}
      </div>
    </div>
  );
}
