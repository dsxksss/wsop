import { useState } from "react";
import { useNavigate } from "react-router";
import { Popover } from "radix-ui";
import { Bell, CheckCheck, Inbox } from "lucide-react";
import type { NotificationDto } from "@wsop/shared";
import { fmtDateTime } from "../../lib/format";
import {
  useMarkAllRead,
  useMarkRead,
  useNotifications,
  useUnreadCount,
} from "../../lib/notifications";
import { Spinner } from "../ui/primitives";

/** 导航栏通知铃铛：未读徽标 + 通知面板。 */
export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { data: unread = 0 } = useUnreadCount();
  const { data: items, isLoading } = useNotifications(open);
  const markRead = useMarkRead();
  const markAllRead = useMarkAllRead();

  const onItemClick = (n: NotificationDto) => {
    if (!n.read_at) markRead.mutate(n.id);
    if (n.customer_id) {
      setOpen(false);
      navigate(`/customers/${n.customer_id}`);
    }
  };

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          className="relative w-7 h-7 rounded-lg hover:bg-zinc-800/40 text-zinc-400 hover:text-zinc-200 flex items-center justify-center transition-all cursor-pointer outline-none active:scale-95"
          title="通知"
        >
          <Bell size={14} />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] px-0.5 rounded-full bg-red-500 text-white text-[9px] font-bold leading-[14px] text-center pointer-events-none">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={8}
          className="wsop-popover z-[60] w-[340px] rounded-xl border border-white/10 bg-[#0c0f15] shadow-2xl overflow-hidden"
        >
          <div className="flex items-center justify-between px-3.5 h-10 border-b border-white/5">
            <span className="text-xs font-semibold text-zinc-200">通知</span>
            {unread > 0 && (
              <button
                onClick={() => markAllRead.mutate()}
                className="flex items-center gap-1 text-[11px] text-zinc-500 hover:text-emerald-300 transition-colors cursor-pointer outline-none"
              >
                <CheckCheck size={12} /> 全部已读
              </button>
            )}
          </div>
          <div className="max-h-[360px] overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-10">
                <Spinner />
              </div>
            ) : !items || items.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 text-zinc-600">
                <Inbox size={20} />
                <span className="text-xs">暂无通知</span>
              </div>
            ) : (
              items.map((n) => (
                <button
                  key={n.id}
                  onClick={() => onItemClick(n)}
                  className={`w-full text-left px-3.5 py-2.5 border-b border-white/5 last:border-b-0 hover:bg-zinc-800/30 transition-colors cursor-pointer outline-none ${
                    n.read_at ? "opacity-55" : ""
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {!n.read_at && (
                      <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                    )}
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <span className="text-xs font-medium text-zinc-200 leading-snug">
                        {n.title}
                      </span>
                      {n.body && (
                        <span className="text-[11px] text-zinc-500 leading-snug">{n.body}</span>
                      )}
                      <span className="text-[10px] text-zinc-600 font-mono-data">
                        {fmtDateTime(n.created_at)}
                      </span>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
