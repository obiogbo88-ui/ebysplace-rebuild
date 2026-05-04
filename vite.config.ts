// @ts-nocheck
import { jsxLocPlugin } from "@builder.io/vite-plugin-jsx-loc";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig, type PluginOption } from "vite";

const isProductionBuild = process.env.NODE_ENV === "production";

const plugins: PluginOption[] = [
  react() as PluginOption,
  tailwindcss() as PluginOption,
  ...(isProductionBuild ? [] : [jsxLocPlugin() as PluginOption]),
];

export default defineConfig({
  plugins,
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  envDir: path.resolve(import.meta.dirname),
  root: path.resolve(import.meta.dirname, "client"),
  publicDir: path.resolve(import.meta.dirname, "client", "public"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("heic2any")) return "heic2any";
          if (id.includes("react") || id.includes("scheduler")) return "vendor-react";
          if (id.includes("@trpc") || id.includes("@tanstack") || id.includes("superjson")) return "vendor-data";
          if (id.includes("@radix-ui") || id.includes("lucide-react") || id.includes("sonner") || id.includes("cmdk") || id.includes("vaul")) return "vendor-ui";
          if (id.includes("stripe") || id.includes("recharts") || id.includes("date-fns")) return "vendor-feature";
          return "vendor-core";
        },
      },
    },
  },
  server: {
    host: true,
    allowedHosts: ["localhost", "127.0.0.1"],
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
