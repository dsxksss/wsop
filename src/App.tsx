import { useMemo } from 'react';
import { Minus, Square, X } from 'lucide-react';
import { getCurrentWindow } from '@tauri-apps/api/window';

export default function App() {
  const appWindow = useMemo(() => getCurrentWindow(), []);

  const handleMinimize = async () => {
    try {
      await appWindow.minimize();
    } catch (err) {
      console.error('Failed to minimize window:', err);
    }
  };

  const handleMaximize = async () => {
    try {
      const isMax = await appWindow.isMaximized();
      if (isMax) {
        await appWindow.unmaximize();
      } else {
        await appWindow.maximize();
      }
    } catch (err) {
      console.error('Failed to toggle maximize window:', err);
    }
  };

  const handleClose = async () => {
    try {
      await appWindow.close();
    } catch (err) {
      console.error('Failed to close window:', err);
    }
  };

  return (
    <div className="w-screen h-screen bg-[#0b0c10] dark:bg-[#08090d] text-zinc-300 font-sans flex flex-col overflow-hidden relative select-none antialiased">
      {/* Premium floating glass-scene background blurs */}
      <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full bg-emerald-500/10 dark:bg-emerald-600/8 blur-[130px] pointer-events-none animate-pulse duration-[10000ms]"></div>
      <div className="absolute -bottom-40 -right-40 w-[700px] h-[700px] rounded-full bg-blue-500/15 dark:bg-blue-600/8 blur-[150px] pointer-events-none"></div>

      {/* TOP HEADER DRAG REGION & WINDOW CONTROLS */}
      <header className="h-14 border-b border-[#11141c] px-6 flex items-center justify-between select-none shrink-0 z-10" id="main-top-navbar" data-tauri-drag-region>
        <div className="flex items-center gap-3" data-tauri-drag-region>
          <span className="text-sm font-bold text-white tracking-tight" data-tauri-drag-region>
            Application
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {/* Minimize Button */}
          <button
            onClick={handleMinimize}
            className="w-7 h-7 rounded-lg hover:bg-zinc-800/40 text-zinc-400 hover:text-zinc-200 flex items-center justify-center transition-all cursor-pointer outline-none active:scale-95"
            title="Minimize"
          >
            <Minus size={13} />
          </button>
          {/* Maximize Button */}
          <button
            onClick={handleMaximize}
            className="w-7 h-7 rounded-lg hover:bg-zinc-800/40 text-zinc-400 hover:text-zinc-200 flex items-center justify-center transition-all cursor-pointer outline-none active:scale-95"
            title="Maximize"
          >
            <Square size={11} />
          </button>
          {/* Close Button */}
          <button
            onClick={handleClose}
            className="w-7 h-7 rounded-lg hover:bg-red-500/20 hover:text-red-400 text-zinc-400 flex items-center justify-center transition-all cursor-pointer outline-none active:scale-95"
            title="Close"
          >
            <X size={13} />
          </button>
        </div>
      </header>

      {/* MAIN VIEWPORT */}
      <main className="flex-grow p-6 md:p-8 overflow-y-auto flex flex-col items-center justify-center z-10" id="main-content-panel">
        <div className="p-8 rounded-2xl border border-zinc-800/60 bg-zinc-950/30 shadow-xl max-w-xl text-center backdrop-blur-md">
          <h2 className="text-lg font-bold text-white tracking-tight mb-2">
            Tauri Starter Template
          </h2>
          <p className="text-xs text-zinc-400 leading-relaxed mb-6">
            This is an ultra-clean, boilerplate desktop layout. Equipped with native borderless dragging, minimizing, maximizing, and closing window controls, backed by the premium floating background visual aesthetics.
          </p>
          <div className="flex justify-center">
            <span className="text-[10px] px-2 py-1 font-mono rounded bg-zinc-900 border border-zinc-800 text-zinc-500">
              edit src/App.tsx to start
            </span>
          </div>
        </div>
      </main>
    </div>
  );
}
