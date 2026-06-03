import { useMemo } from "react";
import { Outlet, useLocation, useNavigate } from "react-router";
import {
  Activity,
  LayoutDashboard,
  LogOut,
  ScrollText,
  Users2,
  Building2,
  type LucideIcon,
} from "lucide-react";
import { AppLayout, useSidebar } from "./components/layout/AppLayout";
import { Sidebar } from "./components/layout/Sidebar";
import { WindowControls } from "./components/layout/WindowControls";
import { Logo } from "./components/ui/Logo";
import { useAuth, type Role } from "./stores/auth";

interface NavEntry {
  path: string;
  label: string;
  icon: LucideIcon;
  /** 限定可见的角色；省略表示所有登录用户可见。 */
  roles?: Role[];
}

const NAV: NavEntry[] = [
  { path: "/", label: "仪表盘", icon: LayoutDashboard },
  { path: "/customers", label: "客户", icon: Building2 },
  { path: "/maintenance", label: "维护记录", icon: Activity },
  { path: "/users", label: "用户管理", icon: Users2, roles: ["admin"] },
  { path: "/audit", label: "审计日志", icon: ScrollText, roles: ["admin"] },
];

function titleFor(pathname: string): string {
  if (pathname === "/") return "仪表盘";
  const entry = NAV.find((n) => n.path !== "/" && pathname.startsWith(n.path));
  return entry?.label ?? "wsop";
}

export default function AppShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuth((s) => s.user);

  const items = useMemo(
    () => NAV.filter((n) => !n.roles || (user && n.roles.includes(user.role))),
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
            <div className="flex items-center gap-2.5 pointer-events-none select-none">
              <Logo size={28} />
              <span className="text-sm font-bold text-white tracking-tight truncate">wsop</span>
            </div>
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
          <WindowControls />
        </div>
      }
    >
      <Outlet />
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

function roleLabel(role?: Role): string {
  switch (role) {
    case "admin":
      return "管理员";
    case "engineer":
      return "工程师";
    case "viewer":
      return "查看者";
    default:
      return "";
  }
}
