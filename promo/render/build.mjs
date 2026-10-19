// Freeze the product and the film player as static builds from the committed HEAD, so captures
// are immune to the dev server's hot reload and to uncommitted edits in the working tree, and
// reproducible from one commit. Nothing is written outside promo/.cache.
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CACHE, PROMO, REPO, freezeInfo, git, treeHash } from "./common.mjs";

const vite = join(REPO, "node_modules", "vite", "bin", "vite.js");
export const SNAPSHOT = join(CACHE, "snapshot");
const PATHS = ["src", "public", "index.html", "vite.config.ts", "tsconfig.json", "package.json"];

/** Export HEAD's app sources into promo/.cache/snapshot (packages resolve from the repo root). */
export function snapshot() {
  rmSync(SNAPSHOT, { recursive: true, force: true });
  mkdirSync(SNAPSHOT, { recursive: true });
  const head = git("rev-parse", "HEAD");
  const tarFile = join(CACHE, "snapshot.tar");
  execFileSync("git", ["archive", "--format=tar", "-o", tarFile, head, ...PATHS], { cwd: REPO, stdio: "inherit" });
  // Relative names: GNU tar would read a drive letter as a remote host.
  execFileSync("tar", ["-xf", "snapshot.tar", "-C", "snapshot"], { cwd: CACHE, stdio: "inherit" });
  rmSync(tarFile, { force: true });
  const info = { head, srcHash: treeHash(join(SNAPSHOT, "src")), dirty: git("status", "--short", "--", "src", "public") };
  writeFileSync(join(SNAPSHOT, "snapshot.json"), JSON.stringify(info, null, 1));
  return info;
}

export function buildApp() {
  const outDir = join(CACHE, "app");
  execFileSync(process.execPath, [vite, "build", "--outDir", outDir, "--emptyOutDir", "--logLevel", "warn"], {
    cwd: SNAPSHOT,
    stdio: "inherit",
    env: { ...process.env, VITE_BASE_PATH: "/" },
  });
  return outDir;
}

export function buildPlayer() {
  const outDir = join(CACHE, "player");
  execFileSync(
    process.execPath,
    [vite, "build", "--config", join(PROMO, "player", "vite.config.mjs"), "--outDir", outDir, "--emptyOutDir", "--logLevel", "warn"],
    { cwd: join(PROMO, "player"), stdio: "inherit", env: { ...process.env, FILM_SRC: SNAPSHOT } },
  );
  return outDir;
}

if (process.argv[1] && process.argv[1].endsWith("build.mjs")) {
  const what = process.argv[2] || "all";
  const info = freezeInfo();
  console.log("[build] HEAD", info.head, info.status ? "(working tree has changes; building HEAD)" : "(clean)");
  const snap = snapshot();
  console.log("[build] snapshot", snap.head, snap.dirty ? `(uncommitted app edits ignored:\n${snap.dirty})` : "");
  if (what === "app" || what === "all") console.log("[build] app ->", buildApp());
  if (what === "player" || what === "all") console.log("[build] player ->", buildPlayer());
}
