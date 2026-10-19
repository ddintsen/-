// Film player: its own Vite root, importing the product's modules from src/ read-only.
import { createReadStream, existsSync, readFileSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, "..", "..");
const cache = resolve(here, "..", ".cache");
// Renders import the product from the HEAD snapshot (render/build.mjs); dev uses the working tree.
const src = process.env.FILM_SRC ? resolve(process.env.FILM_SRC) : repo;

/** Dev only: serve the capture cache at /cache, as the render server does for the build. */
const cacheMiddleware = {
  name: "film-cache",
  configureServer(server) {
    server.middlewares.use("/cache", (req, res, next) => {
      const file = resolve(cache, "." + decodeURIComponent(req.url.split("?")[0]));
      if (!file.startsWith(cache) || !existsSync(file) || !statSync(file).isFile()) return next();
      res.setHeader("content-type", file.endsWith(".png") ? "image/png" : "application/json");
      res.setHeader("cache-control", "no-store");
      createReadStream(file).pipe(res);
    });
  },
};

export default defineConfig({
  root: here,
  base: "/",
  publicDir: false,
  define: {
    // The same embedded mock the app's vite.config.ts defines (store and scenarios need it).
    __INITIAL_DASHBOARD_DATA__: readFileSync(resolve(src, "public/mock/dashboard-data.json"), "utf8"),
  },
  plugins: [react(), cacheMiddleware],
  resolve: {
    dedupe: ["react", "react-dom", "three", "@react-three/fiber", "zustand"],
    alias: [{ find: /^(\.\.\/)+src\//, replacement: resolve(src, "src").replace(/\\/g, "/") + "/" }],
  },
  server: { port: 5174, strictPort: true, fs: { allow: [repo, src] } },
  build: { target: "es2022", assetsInlineLimit: 0, chunkSizeWarningLimit: 8000, sourcemap: false },
  logLevel: "warn",
});
