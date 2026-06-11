import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { NotificationDto } from "@wsop/shared";
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";
import { api } from "./api";

/** 未读数轮询间隔（ms）。 */
const POLL_INTERVAL = 60_000;

/** 上次看到的未读数；计数增加时弹系统 toast，避免每次轮询重复弹。 */
let lastUnread: number | null = null;

async function notifyOs(newCount: number) {
  try {
    let granted = await isPermissionGranted();
    if (!granted) {
      granted = (await requestPermission()) === "granted";
    }
    if (granted) {
      sendNotification({
        title: "wsop 维护提醒",
        body: `有 ${newCount} 条新的通知，请打开应用查看。`,
      });
    }
  } catch {
    // 非 Tauri 环境或权限被拒：静默忽略，应用内铃铛仍可见
  }
}

export function useUnreadCount() {
  return useQuery({
    queryKey: ["notifications", "unread-count"],
    queryFn: async () => {
      const { count } = await api.get<{ count: number }>("/notifications/unread-count");
      if (lastUnread !== null && count > lastUnread) {
        void notifyOs(count - lastUnread);
      }
      lastUnread = count;
      return count;
    },
    refetchInterval: POLL_INTERVAL,
  });
}

export function useNotifications(enabled: boolean) {
  return useQuery({
    queryKey: ["notifications", "list"],
    queryFn: () => api.get<NotificationDto[]>("/notifications"),
    enabled,
  });
}

function useInvalidateNotifications() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["notifications"] });
}

export function useMarkRead() {
  const invalidate = useInvalidateNotifications();
  return useMutation({
    mutationFn: (id: string) => api.patch(`/notifications/${id}/read`),
    onSuccess: invalidate,
  });
}

export function useMarkAllRead() {
  const invalidate = useInvalidateNotifications();
  return useMutation({
    mutationFn: () => api.post("/notifications/read-all"),
    onSuccess: invalidate,
  });
}
