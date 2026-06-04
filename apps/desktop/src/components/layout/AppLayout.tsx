import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Menu, PanelLeft, PanelRight, X } from 'lucide-react';

/**
 * A free, dependency-light re-implementation of HeroUI Pro's `AppLayout`
 * (https://heroui.pro/docs/react/components/app-layout). It composes a
 * full-height collapsible sidebar, a sticky navbar, the main content area,
 * and an optional right-side aside panel.
 *
 * Built for this borderless Tauri window, so the navbar doubles as the OS
 * drag region and hosts the window controls. Uses only deps already in the
 * project: framer-motion, lucide-react, tailwind.
 */

/* ------------------------------------------------------------------ */
/* Context                                                            */
/* ------------------------------------------------------------------ */

export type SidebarCollapsible = 'icon' | 'offcanvas' | 'none';

interface AppLayoutState {
  /** Desktop sidebar expanded (false = collapsed to icon rail / off-canvas). */
  isSidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  /** Mobile sheet sidebar. */
  isMobileSidebarOpen: boolean;
  setMobileSidebarOpen: (open: boolean) => void;
  /** Right-side aside panel. */
  isAsideOpen: boolean;
  setAsideOpen: (open: boolean) => void;
  toggleAside: () => void;
  collapsible: SidebarCollapsible;
}

const AppLayoutContext = createContext<AppLayoutState | null>(null);

/** Read/toggle sidebar state from anywhere inside `AppLayout`. */
export function useSidebar() {
  const ctx = useContext(AppLayoutContext);
  if (!ctx) throw new Error('useSidebar must be used within <AppLayout>');
  return ctx;
}

/** Read/toggle the aside panel state. Returns null outside an `AppLayout`. */
export function useAppLayout() {
  return useContext(AppLayoutContext);
}

/* ------------------------------------------------------------------ */
/* Root                                                               */
/* ------------------------------------------------------------------ */

interface AppLayoutProps {
  sidebar?: ReactNode;
  navbar?: ReactNode;
  aside?: ReactNode;
  children?: ReactNode;
  defaultSidebarOpen?: boolean;
  defaultAsideOpen?: boolean;
  collapsible?: SidebarCollapsible;
  /** Keyboard shortcut to toggle the sidebar. Defaults to Ctrl/Cmd+B. */
  toggleShortcut?: boolean;
}

export function AppLayout({
  sidebar,
  navbar,
  aside,
  children,
  defaultSidebarOpen = true,
  defaultAsideOpen = true,
  collapsible = 'icon',
  toggleShortcut = true,
}: AppLayoutProps) {
  const [isSidebarOpen, setSidebarOpen] = useState(defaultSidebarOpen);
  const [isMobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [isAsideOpen, setAsideOpen] = useState(defaultAsideOpen);

  const value = useMemo<AppLayoutState>(
    () => ({
      isSidebarOpen,
      setSidebarOpen,
      toggleSidebar: () => setSidebarOpen((v) => !v),
      isMobileSidebarOpen,
      setMobileSidebarOpen,
      isAsideOpen,
      setAsideOpen,
      toggleAside: () => setAsideOpen((v) => !v),
      collapsible,
    }),
    [isSidebarOpen, isMobileSidebarOpen, isAsideOpen, collapsible],
  );

  // Ctrl/Cmd+B toggles the sidebar, mirroring HeroUI Pro's default shortcut.
  useEffect(() => {
    if (!toggleShortcut) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        setSidebarOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggleShortcut]);

  const offcanvasCollapsed = collapsible === 'offcanvas' && !isSidebarOpen;

  return (
    <AppLayoutContext.Provider value={value}>
      <div className="app-layout flex w-screen h-screen overflow-hidden bg-[#060a0f] text-zinc-300 antialiased select-none relative">
        {/* Ambient glass-scene blur */}
        <div className="absolute -bottom-40 -right-40 w-[700px] h-[700px] rounded-full bg-blue-500/10 blur-[150px] pointer-events-none" />

        {/* ---------- Full-height sidebar (desktop) ---------- */}
        {sidebar && !offcanvasCollapsed && (
          <aside
            data-state={isSidebarOpen ? 'open' : 'collapsed'}
            className={`app-layout__sidebar hidden md:flex flex-col shrink-0 border-r border-[#11141c] bg-[#08090d]/65 backdrop-blur-xl z-20 transition-[width] duration-200 ${
              isSidebarOpen ? 'w-64' : collapsible === 'icon' ? 'w-16' : 'w-64'
            }`}
          >
            {sidebar}
          </aside>
        )}

        {/* ---------- Mobile sidebar sheet ---------- */}
        <AnimatePresence>
          {sidebar && isMobileSidebarOpen && (
            <>
              <motion.div
                className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setMobileSidebarOpen(false)}
              />
              <motion.aside
                className="fixed left-0 top-0 bottom-0 z-50 w-64 flex flex-col border-r border-[#11141c] bg-[#08090d] md:hidden"
                initial={{ x: '-100%' }}
                animate={{ x: 0 }}
                exit={{ x: '-100%' }}
                transition={{ type: 'tween', duration: 0.2 }}
              >
                <button
                  onClick={() => setMobileSidebarOpen(false)}
                  className="absolute right-3 top-3 w-7 h-7 rounded-lg flex items-center justify-center text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40"
                  title="Close menu"
                >
                  <X size={14} />
                </button>
                {sidebar}
              </motion.aside>
            </>
          )}
        </AnimatePresence>

        {/* ---------- Body column ---------- */}
        <div className="app-layout__body flex flex-col flex-1 min-w-0 z-10">
          {navbar && (
            <header
              className="app-layout__header h-20 shrink-0 border-b border-[#11141c] bg-[#0b0c10]/75 backdrop-blur-xl z-30 flex items-center"
              data-tauri-drag-region
            >
              {navbar}
            </header>
          )}

          <div className="flex flex-1 min-h-0">
            <main className="app-layout__main flex-1 min-w-0 overflow-y-auto">
              {children}
            </main>

            {/* ---------- Optional aside ---------- */}
            {aside && (
              <aside
                data-state={isAsideOpen ? 'open' : 'closed'}
                className={`app-layout__aside hidden lg:block shrink-0 border-l border-[#11141c] bg-[#08090d]/65 backdrop-blur-xl overflow-hidden transition-[width] duration-200 ${
                  isAsideOpen ? 'w-80' : 'w-0'
                }`}
              >
                <div className="w-80 h-full overflow-y-auto">{aside}</div>
              </aside>
            )}
          </div>
        </div>
      </div>
    </AppLayoutContext.Provider>
  );
}

/* ------------------------------------------------------------------ */
/* Triggers                                                           */
/* ------------------------------------------------------------------ */

/** Mobile-only button that opens the sidebar sheet. Hidden on desktop. */
AppLayout.MenuToggle = function MenuToggle() {
  const { setMobileSidebarOpen } = useSidebar();
  return (
    <button
      onClick={() => setMobileSidebarOpen(true)}
      className="md:hidden w-8 h-8 rounded-lg flex items-center justify-center text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40 transition-colors cursor-pointer active:scale-95"
      title="Open menu"
    >
      <Menu size={16} />
    </button>
  );
};

/** Desktop button that collapses/expands the sidebar (Ctrl/Cmd+B). */
AppLayout.SidebarTrigger = function SidebarTrigger() {
  const { toggleSidebar } = useSidebar();
  return (
    <button
      onClick={toggleSidebar}
      className="hidden md:flex w-8 h-8 rounded-lg items-center justify-center text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40 transition-colors cursor-pointer active:scale-95"
      title="Toggle sidebar (Ctrl+B)"
    >
      <PanelLeft size={16} />
    </button>
  );
};

/** Toggles the right-side aside panel. Hidden below the lg breakpoint. */
AppLayout.AsideTrigger = function AsideTrigger() {
  const { isAsideOpen, toggleAside } = useSidebar();
  return (
    <button
      onClick={toggleAside}
      aria-expanded={isAsideOpen}
      data-state={isAsideOpen ? 'open' : 'closed'}
      className="hidden lg:flex w-8 h-8 rounded-lg items-center justify-center text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40 transition-colors cursor-pointer active:scale-95 data-[state=open]:text-emerald-400"
      title={isAsideOpen ? 'Hide panel' : 'Show panel'}
    >
      <PanelRight size={16} />
    </button>
  );
};
