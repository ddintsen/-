// Shared helpers for the capture, the frame renderer and the encoder.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const PROMO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const REPO = resolve(PROMO, "..");
export const CACHE = join(PROMO, ".cache");
export const OUT = join(PROMO, "out");
export const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
export const APP_PORT = 5175;
export const PLAYER_PORT = 5176;
export const LOCALES = ["uk", "en"];

/** System Chrome on the GPU (ANGLE D3D11); software WebGL is not acceptable. */
export const CHROME_ARGS = [
  "--use-angle=d3d11",
  "--ignore-gpu-blocklist",
  "--enable-gpu-rasterization",
  "--force-color-profile=srgb",
  "--hide-scrollbars",
  "--disable-background-timer-throttling",
  "--disable-renderer-backgrounding",
  "--disable-backgrounding-occluded-windows",
];

export function args(argv = process.argv.slice(2)) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith("--")) out[key] = true;
    else {
      out[key] = next;
      i++;
    }
  }
  return out;
}

export function git(...cmd) {
  try {
    return execFileSync("git", cmd, { cwd: REPO, encoding: "utf8" }).trim();
  } catch {
    return "";
  }
}

export function sha256(file) {
  return createHash("sha256").update(readFileSync(file)).digest("hex");
}

/** One hash over every file under a directory (path + content), for freeze checks. */
export function treeHash(dir) {
  const h = createHash("sha256");
  const walk = (d) => {
    for (const name of readdirSync(d).sort()) {
      const p = join(d, name);
      const st = statSync(p);
      if (st.isDirectory()) walk(p);
      else {
        h.update(relative(dir, p).replace(/\\/g, "/"));
        h.update(readFileSync(p));
      }
    }
  };
  walk(dir);
  return h.digest("hex");
}

export function freezeInfo() {
  return {
    head: git("rev-parse", "HEAD"),
    status: git("status", "--short"),
    src: treeHash(join(REPO, "src")),
    mock: sha256(join(REPO, "public", "mock", "dashboard-data.json")),
  };
}

/** Lossless PNG straight from the compositor; optimizeForSpeed keeps 4K captures near 100 ms. */
export async function shoot(cdp) {
  const r = await cdp.send("Page.captureScreenshot", {
    format: "png",
    optimizeForSpeed: true,
    fromSurface: true,
    captureBeyondViewport: false,
  });
  return Buffer.from(r.data, "base64");
}

export const pad = (k, n = 5) => String(k).padStart(n, "0");
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const FORBIDDEN = /демодан|демонстраційн|демонстрацион|demo data|\blive\b|real[ -]?time|\bonline\b|онлайн|наживо/i;
