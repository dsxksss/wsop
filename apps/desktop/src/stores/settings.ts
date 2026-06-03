import { create } from "zustand";
import { load, type Store } from "@tauri-apps/plugin-store";
import { API_BASE } from "../lib/config";
import { setApiBase } from "../lib/api";

export type Theme = "dark" | "light";

const THEME_CACHE_KEY = "wsop-theme"; // localStorage 镜像，启动即同步应用，避免主题闪烁

interface SettingsState {
  apiBase: string;
  theme: Theme;
  ready: boolean;
  /** 启动时从持久化恢复设置并应用。 */
  init: () => Promise<void>;
  setApiBaseUrl: (url: string) => Promise<void>;
  setTheme: (theme: Theme) => Promise<void>;
}

/** 把主题作用到根元素（index.css 里的 .light 主题）。 */
export function applyTheme(theme: Theme) {
  const el = document.documentElement;
  el.classList.toggle("light", theme === "light");
  try {
    localStorage.setItem(THEME_CACHE_KEY, theme);
  } catch {
    /* ignore */
  }
}

/** 在 React 挂载前同步应用缓存主题，消除首屏闪烁。在 main.tsx 顶部调用。 */
export function applyCachedThemeEarly() {
  try {
    if (localStorage.getItem(THEME_CACHE_KEY) === "light") {
      document.documentElement.classList.add("light");
    }
  } catch {
    /* ignore */
  }
}

let storePromise: Promise<Store> | null = null;
function settingsStore(): Promise<Store> {
  if (!storePromise) storePromise = load("settings.json");
  return storePromise;
}

export const useSettings = create<SettingsState>((set) => ({
  apiBase: API_BASE,
  theme: "dark",
  ready: false,

  init: async () => {
    try {
      const store = await settingsStore();
      const apiBase = (await store.get<string>("apiBase")) ?? API_BASE;
      const theme = ((await store.get<Theme>("theme")) ?? "dark") as Theme;
      setApiBase(apiBase);
      applyTheme(theme);
      set({ apiBase, theme, ready: true });
    } catch {
      applyTheme("dark");
      set({ ready: true });
    }
  },

  setApiBaseUrl: async (url) => {
    const clean = url.trim().replace(/\/+$/, "");
    setApiBase(clean);
    const store = await settingsStore();
    await store.set("apiBase", clean);
    await store.save();
    set({ apiBase: clean });
  },

  setTheme: async (theme) => {
    applyTheme(theme);
    const store = await settingsStore();
    await store.set("theme", theme);
    await store.save();
    set({ theme });
  },
}));
