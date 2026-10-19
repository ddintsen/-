// Minimal static file server for the frozen app snapshot, the film player build and the
// capture cache. No dependencies; serves with correct MIME types and no caching surprises.
import { createServer } from "node:http";
import { createReadStream, statSync } from "node:fs";
import { extname, join, normalize, resolve, sep } from "node:path";

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
  ".ico": "image/x-icon",
  ".webmanifest": "application/manifest+json",
  ".txt": "text/plain; charset=utf-8",
  ".wasm": "application/wasm",
};

/**
 * @param {{ port: number, mounts: Record<string, string>, spa?: string }} options
 * mounts: URL prefix -> directory. The longest matching prefix wins.
 * spa: directory whose index.html answers unknown paths under "/".
 */
export function serve({ port, mounts, spa }) {
  const entries = Object.entries(mounts)
    .map(([prefix, dir]) => [prefix, resolve(dir)])
    .sort((a, b) => b[0].length - a[0].length);
  const server = createServer((req, res) => {
    const url = new URL(req.url, `http://localhost:${port}`);
    const path = decodeURIComponent(url.pathname);
    for (const [prefix, dir] of entries) {
      if (!path.startsWith(prefix)) continue;
      let rel = path.slice(prefix.length);
      if (rel === "" || rel.endsWith("/")) rel += "index.html";
      const file = normalize(join(dir, rel));
      if (!file.startsWith(dir + sep) && file !== dir) break;
      try {
        const st = statSync(file);
        if (st.isFile()) {
          res.writeHead(200, {
            "content-type": TYPES[extname(file).toLowerCase()] || "application/octet-stream",
            "content-length": st.size,
            "cache-control": "no-store",
          });
          createReadStream(file).pipe(res);
          return;
        }
      } catch {
        /* fall through */
      }
      break;
    }
    if (spa && !extname(path)) {
      const file = join(resolve(spa), "index.html");
      res.writeHead(200, { "content-type": TYPES[".html"], "cache-control": "no-store" });
      createReadStream(file).pipe(res);
      return;
    }
    res.writeHead(404, { "content-type": "text/plain" });
    res.end("not found");
  });
  return new Promise((ok, fail) => {
    server.once("error", fail);
    server.listen(port, "127.0.0.1", () => ok(server));
  });
}
