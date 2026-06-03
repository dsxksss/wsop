import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { useSidebar } from './AppLayout';

/**
 * Sidebar building blocks for `AppLayout`. `Sidebar` is the shell;
 * `Sidebar.Item` collapses to an icon rail when the sidebar is collapsed
 * (collapsible="icon"), showing the label as a native tooltip.
 */

export function Sidebar({ children }: { children: ReactNode }) {
  return <div className="flex flex-col h-full min-h-0">{children}</div>;
}

/** Top brand row. Doubles as a drag region for the borderless window. */
Sidebar.Header = function SidebarHeader({ children }: { children: ReactNode }) {
  return (
    <div
      className="h-20 shrink-0 flex items-center gap-2.5 px-4 border-b border-[#11141c]"
      data-tauri-drag-region
    >
      {children}
    </div>
  );
};

/** Scrollable nav region between header and footer. */
Sidebar.Content = function SidebarContent({ children }: { children: ReactNode }) {
  return (
    <nav className="flex-1 min-h-0 overflow-y-auto px-2.5 py-3 flex flex-col gap-0.5">
      {children}
    </nav>
  );
};

/** Section label. Hidden when the sidebar is collapsed to the icon rail. */
Sidebar.Group = function SidebarGroup({ label }: { label: string }) {
  const { isSidebarOpen } = useSidebar();
  if (!isSidebarOpen) return <div className="h-3" />;
  return (
    <div className="meta-label-tag px-2.5 pt-4 pb-1.5 text-zinc-600">{label}</div>
  );
};

interface SidebarItemProps {
  icon: LucideIcon;
  label: string;
  active?: boolean;
  badge?: ReactNode;
  onClick?: () => void;
}

Sidebar.Item = function SidebarItem({
  icon: Icon,
  label,
  active = false,
  badge,
  onClick,
}: SidebarItemProps) {
  const { isSidebarOpen } = useSidebar();
  return (
    <button
      onClick={onClick}
      title={!isSidebarOpen ? label : undefined}
      className={`group relative flex items-center gap-3 rounded-xl px-2.5 h-9 text-sm transition-colors cursor-pointer outline-none ${
        active
          ? 'bg-emerald-500/12 text-emerald-300'
          : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/40'
      } ${isSidebarOpen ? '' : 'justify-center'}`}
    >
      {active && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-0.5 rounded-r bg-emerald-400" />
      )}
      <Icon size={17} className="shrink-0" />
      {isSidebarOpen && (
        <>
          <span className="truncate flex-1 text-left">{label}</span>
          {badge}
        </>
      )}
    </button>
  );
};

/** Bottom-pinned region (user card, etc.). */
Sidebar.Footer = function SidebarFooter({ children }: { children: ReactNode }) {
  return (
    <div className="shrink-0 border-t border-[#11141c] p-2.5">{children}</div>
  );
};
