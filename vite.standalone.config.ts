import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { viteSingleFile } from "vite-plugin-singlefile";
import path from "node:path";

// بناء نسخة مستقلة تعمل بفتح index.html مباشرة من القرص (بدون خادم).
export default defineConfig({
  root: path.resolve(import.meta.dirname, "standalone"),
  base: "./",
  plugins: [react(), tailwindcss(), viteSingleFile()],
  resolve: {
    alias: [
      { find: "@tanstack/react-start", replacement: path.resolve(import.meta.dirname, "standalone/stubs/react-start.ts") },
      { find: "@/lib/users.functions", replacement: path.resolve(import.meta.dirname, "standalone/stubs/server-functions.ts") },
      { find: "@/lib/password.functions", replacement: path.resolve(import.meta.dirname, "standalone/stubs/server-functions.ts") },
      { find: "@", replacement: path.resolve(import.meta.dirname, "src") },
    ],
    dedupe: ["react", "react-dom", "@tanstack/react-router", "@tanstack/react-query"],
  },
  define: { "process.env": "{}" },
  build: {
    outDir: path.resolve(import.meta.dirname, "dist-standalone"),
    emptyOutDir: true,
    target: "es2020",
    assetsInlineLimit: 100_000_000,
    chunkSizeWarningLimit: 10_000,
  },
});
