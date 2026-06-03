import { create } from "zustand";
import { load, type Store } from "@tauri-apps/plugin-store";
import { api, setAuthToken } from "../lib/api";

export type Role = "admin" | "engineer" | "viewer";
export interface AuthUser {
  id: string;
  username: string;
  role: Role;
}

type Status = "loading" | "authed" | "anon";

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  status: Status;
  /** 启动时从持久化恢复 token 并校验。 */
  init: () => Promise<void>;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

let storePromise: Promise<Store> | null = null;
function tokenStore(): Promise<Store> {
  if (!storePromise) storePromise = load("auth.json");
  return storePromise;
}

export const useAuth = create<AuthState>((set) => ({
  token: null,
  user: null,
  status: "loading",

  init: async () => {
    try {
      const store = await tokenStore();
      const token = (await store.get<string>("token")) ?? null;
      if (!token) {
        set({ status: "anon" });
        return;
      }
      setAuthToken(token);
      const me = await api.get<AuthUser>("/auth/me");
      set({ token, user: me, status: "authed" });
    } catch {
      setAuthToken(null);
      set({ token: null, user: null, status: "anon" });
    }
  },

  login: async (username, password) => {
    const resp = await api.post<{ token: string; user: AuthUser }>("/auth/login", {
      username,
      password,
    });
    setAuthToken(resp.token);
    const store = await tokenStore();
    await store.set("token", resp.token);
    await store.save();
    set({ token: resp.token, user: resp.user, status: "authed" });
  },

  logout: async () => {
    setAuthToken(null);
    const store = await tokenStore();
    await store.delete("token");
    await store.save();
    set({ token: null, user: null, status: "anon" });
  },
}));
