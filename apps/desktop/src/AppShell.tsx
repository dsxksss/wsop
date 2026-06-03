import { useMemo, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router";
import {
  Activity,
  LayoutDashboard,
  LogOut,
  Moon,
  ScrollText,
  Settings,
  Sun,
  Users2,
  Building2,
  Shield,
  type LucideIcon,
} from "lucide-react";
import { AppLayout, useSidebar } from "./components/layout/AppLayout";
import { Sidebar } from "./components/layout/Sidebar";
import { WindowControls } from "./components/layout/WindowControls";
import { Logo } from "./components/ui/Logo";
import { SettingsModal } from "./components/ui/SettingsModal";
import { useAuth } from "./stores/auth";
import { useSettings } from "./stores/settings";

interface NavEntry {
  path: string;
  label: string;
  icon: LucideIcon;
  page?: string;
}

const NAV: NavEntry[] = [
  { path: "/", label: "仪表盘", icon: LayoutDashboard, page: "dashboard" },
  { path: "/customers", label: "客户", icon: Building2, page: "customers" },
  { path: "/maintenance", label: "维护记录", icon: Activity, page: "maintenance" },
  { path: "/users", label: "用户管理", icon: Users2, page: "users" },
  { path: "/roles", label: "角色管理", icon: Shield, page: "roles" },
  { path: "/audit", label: "审计日志", icon: ScrollText, page: "audit" },
];

function titleFor(pathname: string): string {
  if (pathname === "/") return "仪表盘";
  const entry = NAV.find((n) => n.path !== "/" && pathname.startsWith(n.path));
  return entry?.label ?? "wsop";
}

function BrandHeader() {
  const { isSidebarOpen } = useSidebar();
  return (
    <div className="flex items-center pointer-events-none select-none">
      <Logo size={28} />
      <span
        className={`text-sm font-bold text-white tracking-tight transition-all duration-200 origin-left ${
          isSidebarOpen
            ? "opacity-100 max-w-[120px] ml-2.5"
            : "opacity-0 max-w-0 ml-0 overflow-hidden pointer-events-none"
        }`}
      >
        wsop
      </span>
    </div>
  );
}

export default function AppShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuth((s) => s.user);
  const theme = useSettings((s) => s.theme);
  const setTheme = useSettings((s) => s.setTheme);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const items = useMemo(
    () =>
      NAV.filter(
        (n) =>
          !n.page ||
          (user && (user.role === "admin" || user.permissions.view_pages.includes(n.page))),
      ),
    [user],
  );

  const isActive = (path: string) =>
    path === "/" ? location.pathname === "/" : location.pathname.startsWith(path);

  return (
    <AppLayout
      collapsible="icon"
      sidebar={
        <Sidebar>
          <Sidebar.Header>
            <BrandHeader />
          </Sidebar.Header>

          <Sidebar.Content>
            <Sidebar.Group label="工作区" />
            {items.map((item) => (
              <Sidebar.Item
                key={item.path}
                icon={item.icon}
                label={item.label}
                active={isActive(item.path)}
                onClick={() => navigate(item.path)}
              />
            ))}
          </Sidebar.Content>

          <Sidebar.Footer>
            <UserFooter />
          </Sidebar.Footer>
        </Sidebar>
      }
      navbar={
        <div className="flex items-center justify-between w-full h-full px-4" data-tauri-drag-region>
          <div className="flex items-center gap-2" data-tauri-drag-region>
            <AppLayout.MenuToggle />
            <AppLayout.SidebarTrigger />
            <span className="text-sm font-bold text-white tracking-tight pointer-events-none select-none">
              {titleFor(location.pathname)}
            </span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="w-7 h-7 rounded-lg hover:bg-zinc-800/40 text-zinc-400 hover:text-zinc-200 flex items-center justify-center transition-all cursor-pointer outline-none active:scale-95"
              title={theme === "dark" ? "切换到浅色主题" : "切换到深色主题"}
            >
              {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
            </button>
            <button
              onClick={() => setSettingsOpen(true)}
              className="w-7 h-7 rounded-lg hover:bg-zinc-800/40 text-zinc-400 hover:text-zinc-200 flex items-center justify-center transition-all cursor-pointer outline-none active:scale-95"
              title="设置"
            >
              <Settings size={14} />
            </button>
            <div className="w-px h-4 bg-zinc-800/70 mx-0.5" />
            <WindowControls />
          </div>
        </div>
      }
    >
      <Outlet />
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </AppLayout>
  );
}

/** 侧边栏底部用户卡 + 退出。随侧边栏折叠自适应。 */
function UserFooter() {
  const { isSidebarOpen } = useSidebar();
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);

  if (!isSidebarOpen) {
    return (
      <button
        onClick={() => logout()}
        title="退出登录"
        className="w-full h-9 rounded-xl flex items-center justify-center text-zinc-400 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
      >
        <LogOut size={16} />
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2 px-1.5 py-1">
      <div className="min-w-0 flex-1">
        <div className="text-xs font-semibold text-white truncate">{user?.username ?? "—"}</div>
        <div className="text-[10px] text-zinc-500 truncate">{roleLabel(user?.role)}</div>
      </div>
      <button
        onClick={() => logout()}
        title="退出登录"
        className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-400 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer shrink-0"
      >
        <LogOut size={15} />
      </button>
    </div>
  );
}

function roleLabel(role?: string): string {
  switch (role) {
    case "admin":
      return "管理员";
    case "engineer":
      return "工程师";
    case "viewer":
      return "查看者";
    default:
      return role ?? "";
  }
}
