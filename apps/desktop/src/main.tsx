import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "react-router";
import { queryClient } from "./lib/queryClient";
import { router } from "./router";
import { useAuth } from "./stores/auth";
import { applyCachedThemeEarly, useSettings } from "./stores/settings";
import "./index.css";

// 先用缓存主题同步上色，消除首屏闪烁
applyCachedThemeEarly();

// 先恢复设置（后端地址必须在校验登录态之前生效），再恢复登录态
void (async () => {
  await useSettings.getState().init();
  await useAuth.getState().init();
})();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </React.StrictMode>,
);
