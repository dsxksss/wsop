import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Boxes,
  CheckCircle2,
  FileUp,
  Plug,
  UserPlus,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import type {
  CustomerSummaryDto,
  CustomerFile,
  CustomerRemoteConnection,
  Deployment,
  MaintenanceListItem,
} from "@wsop/shared";
import { api } from "../../lib/api";
import { fmtDateTime, fmtSize, maintenanceTypeLabel } from "../../lib/format";
import { Badge, EmptyState, Spinner } from "../ui/primitives";

type Tone = "emerald" | "amber" | "blue" | "violet" | "zinc";

/** 时间线分类：用于上方筛选与圆点配色。 */
type Category = "customer" | "deploy" | "remote" | "maintenance" | "file";

interface TimelineEvent {
  id: string;
  at: string; // ISO 时间
  category: Category;
  icon: LucideIcon;
  tone: Tone;
  title: string;
  desc?: string | null;
  actor?: string | null;
  badge?: { label: string; tone: "emerald" | "amber" | "blue" | "zinc" | "red" };
}

const DOT_TONES: Record<Tone, string> = {
  emerald: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  amber: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  blue: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  violet: "bg-violet-500/15 text-violet-300 border-violet-500/30",
  zinc: "bg-zinc-700/40 text-zinc-300 border-zinc-700/50",
};

const FILTERS: { value: Category | "all"; label: string }[] = [
  { value: "all", label: "全部" },
  { value: "maintenance", label: "维护" },
  { value: "deploy", label: "部署" },
  { value: "remote", label: "远程连接" },
  { value: "file", label: "文件" },
  { value: "customer", label: "客户" },
];

export function OperationTimelineTab({
  customerId,
  customer,
  deployments,
  connections,
}: {
  customerId: string;
  customer: CustomerSummaryDto;
  deployments: Deployment[];
  connections: CustomerRemoteConnection[];
}) {
  const [filter, setFilter] = useState<Category | "all">("all");

  const maint = useQuery({
    queryKey: ["maintenance", customerId],
    queryFn: () =>
      api.get<MaintenanceListItem[]>(`/maintenance-records?customer_id=${customerId}`),
  });
  const files = useQuery({
    queryKey: ["files", customerId],
    queryFn: () => api.get<CustomerFile[]>(`/customers/${customerId}/files`),
  });

  const events = useMemo<TimelineEvent[]>(() => {
    const list: TimelineEvent[] = [];

    // 客户登记
    list.push({
      id: `customer-${customer.id}`,
      at: customer.created_at,
      category: "customer",
      icon: UserPlus,
      tone: "violet",
      title: `登记客户「${customer.name}」`,
      desc: customer.industry ? `行业：${customer.industry}` : null,
    });

    // 部署
    for (const d of deployments) {
      list.push({
        id: `deploy-${d.id}`,
        at: d.created_at,
        category: "deploy",
        icon: Boxes,
        tone: "blue",
        title: `新增部署「${d.product}」`,
        desc: [
          d.approval_no ? `审批号 ${d.approval_no}` : null,
          d.department,
          d.modules ? `模块：${d.modules}` : null,
        ]
          .filter(Boolean)
          .join(" · ") || null,
        badge:
          d.status === "active"
            ? { label: "在用", tone: "emerald" }
            : { label: "已退役", tone: "zinc" },
      });
    }

    // 远程连接
    for (const c of connections) {
      list.push({
        id: `remote-${c.id}`,
        at: c.created_at,
        category: "remote",
        icon: Plug,
        tone: "zinc",
        title: `新增远程连接「${c.name}」`,
        desc: c.wemol_username ? `账号 ${c.wemol_username}` : null,
      });
    }

    // 维护：发起 + 完成两个事件
    for (const m of maint.data ?? []) {
      list.push({
        id: `maint-open-${m.id}`,
        at: m.maintained_at,
        category: "maintenance",
        icon: Wrench,
        tone: "amber",
        title: `发起维护「${m.title}」`,
        actor: m.assignees?.map((a) => a.username).join("、") || null,
        badge: { label: maintenanceTypeLabel(m.type), tone: "blue" },
      });
      if (m.status === "done" && m.completed_at) {
        list.push({
          id: `maint-done-${m.id}`,
          at: m.completed_at,
          category: "maintenance",
          icon: CheckCircle2,
          tone: "emerald",
          title: `完成维护「${m.title}」`,
          actor: m.assignees?.map((a) => a.username).join("、") || null,
          badge: { label: "已完成", tone: "emerald" },
        });
      }
    }

    // 文件
    for (const f of files.data ?? []) {
      list.push({
        id: `file-${f.id}`,
        at: f.created_at,
        category: "file",
        icon: FileUp,
        tone: "blue",
        title: `上传文件「${f.filename}」`,
        desc: `${fmtSize(f.size_bytes)} · ${f.folder_path}`,
        actor: f.uploaded_by_username,
      });
    }

    // 时间倒序（最新在上）
    return list.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
  }, [customer, deployments, connections, maint.data, files.data]);

  const loading = maint.isLoading || files.isLoading;
  const shown = filter === "all" ? events : events.filter((e) => e.category === filter);

  return (
    <div className="flex flex-col gap-3">
      {/* 筛选 */}
      <div className="flex flex-wrap items-center gap-1.5">
        {FILTERS.map((f) => {
          const active = filter === f.value;
          return (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`px-3 h-7 rounded-full text-xs font-medium border transition-colors cursor-pointer outline-none ${
                active
                  ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                  : "text-zinc-400 border-zinc-800/60 hover:text-zinc-200 hover:border-zinc-700"
              }`}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      <div className="card p-5 md:p-6">
        {loading ? (
          <Spinner />
        ) : shown.length === 0 ? (
          <EmptyState>暂无操作记录。</EmptyState>
        ) : (
          <ol className="relative flex flex-col">
            {shown.map((e, i) => {
              const Icon = e.icon;
              const isLast = i === shown.length - 1;
              return (
                <li key={e.id} className="relative flex gap-4 pb-6 last:pb-0">
                  {/* 连接线 */}
                  {!isLast && (
                    <span className="absolute left-4 top-9 -bottom-0 w-px bg-zinc-800/70" />
                  )}
                  {/* 圆点 */}
                  <span
                    className={`relative z-10 mt-0.5 w-8 h-8 rounded-full flex items-center justify-center border shrink-0 ${DOT_TONES[e.tone]}`}
                  >
                    <Icon size={14} />
                  </span>
                  {/* 正文 */}
                  <div className="flex-1 min-w-0 pt-0.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm text-white font-medium">{e.title}</span>
                      {e.badge && <Badge tone={e.badge.tone}>{e.badge.label}</Badge>}
                    </div>
                    {e.desc && (
                      <p className="text-xs text-zinc-400 mt-1 truncate">{e.desc}</p>
                    )}
                    <div className="flex items-center gap-2 mt-1.5 text-[11px] text-zinc-500">
                      <span className="font-mono-data">{fmtDateTime(e.at)}</span>
                      {e.actor && <span>· {e.actor}</span>}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
}
