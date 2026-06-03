import type { ReactNode } from "react";
import { Dialog } from "radix-ui";
import { X } from "lucide-react";

/**
 * 基于 Radix Dialog 的模态框（焦点陷阱 / Esc 关闭 / 滚动锁定 / 无障碍均由 Radix 处理）。
 * 对外保持简单受控 API：open / onClose / title / children / footer / width。
 */
export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  width = "max-w-md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  width?: string;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="wsop-dialog-overlay fixed inset-0 z-50 bg-black/60 backdrop-blur-sm grid place-items-center p-4">
          <Dialog.Content
            aria-describedby={undefined}
            className={`wsop-dialog-content relative w-full ${width} rounded-2xl border border-zinc-800/70 bg-[#0c0f15] shadow-2xl flex flex-col max-h-[85vh] outline-none`}
          >
          <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800/60 shrink-0">
            <Dialog.Title className="text-sm font-bold text-white tracking-tight">
              {title}
            </Dialog.Title>
            <Dialog.Close className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40 cursor-pointer outline-none">
              <X size={15} />
            </Dialog.Close>
          </div>
          <div className="px-5 py-4 overflow-y-auto flex-1">{children}</div>
          {footer && (
            <div className="px-5 py-3.5 border-t border-zinc-800/60 flex justify-end gap-2 shrink-0">
              {footer}
            </div>
          )}
          </Dialog.Content>
        </Dialog.Overlay>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
