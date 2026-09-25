import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient } from "@tanstack/react-query";
import { RouterProvider, createRouter, createHashHistory } from "@tanstack/react-router";
import { routeTree } from "../src/routeTree.gen";
import "../src/styles.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: 1000 * 60 * 60 * 24 * 30,
      staleTime: 30_000,
      networkMode: "offlineFirst",
      retry: 1,
    },
    mutations: { networkMode: "offlineFirst" },
  },
});

// في النسخة المحمولة لا نرسم وسوم html/head/body داخل عنصر root (يسبب تجمّد الصفحة)
const rootOpts = (routeTree as any).options;
rootOpts.shellComponent = ({ children }: { children: React.ReactNode }) => <>{children}</>;
if (rootOpts.head) {
  const origHead = rootOpts.head;
  rootOpts.head = (ctx: any) => ({ ...origHead(ctx), links: [] });
}

const router = createRouter({
  routeTree,
  context: { queryClient },
  history: createHashHistory(),
  scrollRestoration: true,
  defaultPreload: false,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

document.documentElement.lang = "ar";
document.documentElement.dir = "rtl";

const rootEl = document.getElementById("root")!;
ReactDOM.createRoot(rootEl).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
);
