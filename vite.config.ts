import { readFileSync } from "node:fs";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import basicSsl from "@vitejs/plugin-basic-ssl";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig(({ mode }) => ({
  base: mode === "standalone" ? "./" : process.env.VITE_BASE_PATH || "/",
  build:
    mode === "standalone"
      ? {
          outDir: "standalone-dist",
          copyPublicDir: false,
          assetsInlineLimit: Number.MAX_SAFE_INTEGER,
          cssCodeSplit: false,
          rollupOptions: { output: { inlineDynamicImports: true } },
        }
      : {},
  define: {
    __INITIAL_DASHBOARD_DATA__: readFileSync(
      new URL("./public/mock/dashboard-data.json", import.meta.url),
      "utf8",
    ),
  },
  plugins: [
    react(),
    ...(mode === "https" ? [basicSsl()] : []),
    ...(mode === "standalone"
      ? []
      : [
          VitePWA({
            registerType: "prompt",
            injectRegister: false,
            includeAssets: ["icon.svg", "icon-192.png", "icon-512.png"],
            manifest: {
              name: "Орбита — аналитика департамента",
              short_name: "Орбита",
              description:
                "Пространственная аналитика платежей, касс и оборудования",
              lang: "ru",
              start_url: ".",
              scope: ".",
              display: "standalone",
              background_color: "#24262b",
              theme_color: "#24262b",
              icons: [
                {
                  src: "icon-192.png",
                  sizes: "192x192",
                  type: "image/png",
                  purpose: "any",
                },
                {
                  src: "icon-512.png",
                  sizes: "512x512",
                  type: "image/png",
                  purpose: "any",
                },
              ],
            },
            workbox: {
              clientsClaim: true,
              importScripts: ["sw-recovery.js"],
              globPatterns: [
                "**/*.{js,css,html,svg,png,jpg,jpeg,webp,woff2,json}",
              ],
              globIgnores: [
                "**/emulate-*.js",
                "**/office_*.js",
                "**/meeting_room-*.js",
                "**/living_room-*.js",
                "**/music_room-*.js",
              ],
              maximumFileSizeToCacheInBytes: 5000000,
              navigateFallbackDenylist: [/^\/api\//],
            },
          }),
        ]),
  ],
  server: {
    port: 5173,
    strictPort: true,
    proxy: process.env.API_PROXY_TARGET
      ? {
          "/api": {
            target: process.env.API_PROXY_TARGET,
            changeOrigin: true,
            secure: true,
          },
        }
      : undefined,
  },
  test: { include: ["tests/**/*.test.ts"], environment: "node" },
}));
