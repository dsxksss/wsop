import { useMemo } from 'react';
import { Minus, Square, X } from 'lucide-react';
import { getCurrentWindow } from '@tauri-apps/api/window';

/**
 * Native window controls for the borderless Tauri window (decorations are
 * disabled in tauri.conf.json). Lives at the right end of the navbar.
 */
export function WindowControls() {
  const appWindow = useMemo(() => getCurrentWindow(), []);

  const minimize = () => appWindow.minimize().catch(console.error);
  const toggleMaximize = async () => {
    try {
      (await appWindow.isMaximized())
        ? await appWindow.unmaximize()
        : await appWindow.maximize();
    } catch (err) {
      console.error('Failed to toggle maximize window:', err);
    }
  };
  const close = () => appWindow.close().catch(console.error);

  return (
    <div className="flex items-center gap-1.5 shrink-0">
      <button
        onClick={minimize}
        className="w-9 h-9 rounded-lg hover:bg-zinc-800/40 text-zinc-400 hover:text-zinc-200 flex items-center justify-center transition-all cursor-pointer outline-none active:scale-95"
        title="Minimize"
      >
        <Minus size={16} />
      </button>
      <button
        onClick={toggleMaximize}
        className="w-9 h-9 rounded-lg hover:bg-zinc-800/40 text-zinc-400 hover:text-zinc-200 flex items-center justify-center transition-all cursor-pointer outline-none active:scale-95"
        title="Maximize"
      >
        <Square size={13} />
      </button>
      <button
        onClick={close}
        className="w-9 h-9 rounded-lg hover:bg-red-500/20 hover:text-red-400 text-zinc-400 flex items-center justify-center transition-all cursor-pointer outline-none active:scale-95"
        title="Close"
      >
        <X size={16} />
      </button>
    </div>
  );
}
