import { createHashRouter, Navigate, Outlet } from "react-router";
import { Loader2 } from "lucide-react";
import AppShell from "./AppShell";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Customers from "./pages/Customers";
import CustomerDetail from "./pages/CustomerDetail";
import Maintenance from "./pages/Maintenance";
import Users from "./pages/Users";
import Audit from "./pages/Audit";
import { useAuth } from "./stores/auth";

function FullScreen({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-screen h-screen bg-[#060a0f] flex items-center justify-center text-zinc-500">
      {children}
    </div>
  );
}

/** 未登录跳转登录页；恢复中显示加载。 */
function ProtectedShell() {
  const status = useAuth((s) => s.status);
  if (status === "loading")
    return (
      <FullScreen>
        <Loader2 size={20} className="animate-spin" />
      </FullScreen>
    );
  if (status === "anon") return <Navigate to="/login" replace />;
  return <AppShell />;
}

/** 仅管理员可进入；否则回到仪表盘。 */
function AdminRoute() {
  const user = useAuth((s) => s.user);
  if (user?.role !== "admin") return <Navigate to="/" replace />;
  return <Outlet />;
}

export const router = createHashRouter([
  { path: "/login", element: <Login /> },
  {
    path: "/",
    element: <ProtectedShell />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: "customers", element: <Customers /> },
      { path: "customers/:id", element: <CustomerDetail /> },
      { path: "maintenance", element: <Maintenance /> },
      {
        element: <AdminRoute />,
        children: [
          { path: "users", element: <Users /> },
          { path: "audit", element: <Audit /> },
        ],
      },
    ],
  },
]);
