import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Tabs } from "radix-ui";
import { ArrowLeft, Pencil, Trash2 } from "lucide-react";
import type { CustomerSummaryDto, Deployment } from "@wsop/shared";
import { api } from "../lib/api";
import { fmtDate } from "../lib/format";
import { useAuth } from "../stores/auth";
import { Button, ErrorState, Spinner } from "../components/ui/primitives";
import { ConfirmModal } from "../components/ui/ConfirmModal";
import { CustomerFormModal } from "../components/customers/CustomerFormModal";
import { DeploymentsTab } from "../components/customers/DeploymentsTab";
import { CustomerMaintenanceTab } from "../components/customers/CustomerMaintenanceTab";
import { FilesTab } from "../components/customers/FilesTab";

interface DetailResponse {
  customer: CustomerSummaryDto;
  deployments: Deployment[];
}

const TABS = ["概览", "部署", "维护记录", "文件空间"] as const;
type Tab = (typeof TABS)[number];

export default function CustomerDetail() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const role = useAuth((s) => s.user?.role);
  const canWrite = role === "admin" || role === "engineer";
  const isAdmin = role === "admin";

  const [tab, setTab] = useState<Tab>("概览");
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const query = useQuery({
    queryKey: ["customer", id],
    queryFn: () => api.get<DetailResponse>(`/customers/${id}`),
  });

  const del = useMutation({
    mutationFn: () => api.del(`/customers/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customers"] });
      navigate("/customers", { replace: true });
    },
  });

  if (query.isLoading) return <Spinner />;
  if (query.isError || !query.data) return <ErrorState error={query.error} />;

  const { customer, deployments } = query.data;

  return (
    <div className="p-6 md:p-8 flex flex-col gap-5">
      {/* header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => navigate("/customers")}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800/40 cursor-pointer shrink-0"
          >
            <ArrowLeft size={16} />
          </button>
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-white tracking-tight truncate">
              {customer.name}
            </h1>
            <div className="flex items-center gap-3 text-[11px] text-zinc-500 mt-0.5">
              <span>维护 {customer.maintenance_count} 次</span>
              <span>最近 {fmtDate(customer.last_maintained_at)}</span>
              <span>在用部署 {customer.active_deployments}</span>
            </div>
          </div>
        </div>
        {canWrite && (
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="ghost" icon={<Pencil size={13} />} onClick={() => setEditing(true)}>
              编辑
            </Button>
            {isAdmin && (
              <Button
                variant="ghost"
                icon={<Trash2 size={13} />}
                onClick={() => setDeleting(true)}
              >
                删除
              </Button>
            )}
          </div>
        )}
      </div>

      {/* tabs */}
      <Tabs.Root
        value={tab}
        onValueChange={(v) => setTab(v as Tab)}
        className="flex flex-col gap-5"
      >
        <Tabs.List className="flex items-center gap-1 border-b border-zinc-800/50">
          {TABS.map((t) => (
            <Tabs.Trigger
              key={t}
              value={t}
              className="px-3.5 h-9 text-xs font-medium border-b-2 -mb-px transition-colors cursor-pointer outline-none text-zinc-400 border-transparent hover:text-zinc-200 data-[state=active]:text-emerald-300 data-[state=active]:border-emerald-400"
            >
              {t}
            </Tabs.Trigger>
          ))}
        </Tabs.List>

        <Tabs.Content value="概览" className="outline-none">
          <Overview customer={customer} />
        </Tabs.Content>
        <Tabs.Content value="部署" className="outline-none">
          <DeploymentsTab customerId={id} deployments={deployments} canWrite={canWrite} />
        </Tabs.Content>
        <Tabs.Content value="维护记录" className="outline-none">
          <CustomerMaintenanceTab customerId={id} canWrite={canWrite} deployments={deployments} />
        </Tabs.Content>
        <Tabs.Content value="文件空间" className="outline-none">
          <FilesTab customerId={id} canWrite={canWrite} />
        </Tabs.Content>
      </Tabs.Root>

      <CustomerFormModal
        open={editing}
        onClose={() => setEditing(false)}
        initial={customer}
      />

      {deleting && (
        <ConfirmModal
          open
          onClose={() => setDeleting(false)}
          onConfirm={() => del.mutate()}
          title="删除客户"
          message={`确认删除客户「${customer.name}」？将级联删除其部署、维护记录及文件空间。`}
          confirmText="删除"
          confirmVariant="danger"
          loading={del.isPending}
        />
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] text-zinc-500">{label}</span>
      <span className="text-sm text-zinc-200">{value || "—"}</span>
    </div>
  );
}

function Overview({ customer }: { customer: CustomerSummaryDto }) {
  return (
    <div className="card p-6 grid grid-cols-2 md:grid-cols-3 gap-5">
      <Row label="企业名称" value={customer.name} />
      <Row label="简称" value={customer.short_name} />
      <Row label="行业" value={customer.industry} />
      <Row label="联系人" value={customer.contact_name} />
      <Row label="联系电话" value={customer.contact_phone} />
      <Row label="联系邮箱" value={customer.contact_email} />
      <Row label="地址" value={customer.address} />
      <Row label="登记时间" value={fmtDate(customer.created_at)} />
      <div className="col-span-2 md:col-span-3">
        <Row label="备注" value={customer.notes} />
      </div>
    </div>
  );
}
