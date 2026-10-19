// Drives the film player frame by frame: pointer events for the in-headset select, the
// deterministic render of each frame (temporal supersampling inside the page), a lossless 4K
// screenshot, and a lanczos downscale to 1080p PNGs through ffmpeg.
// Usage: node render/frames.mjs --locale uk [--player http://127.0.0.1:5176/] [--from 0 --to 1319]
//        [--only 0,60,650] [--samples 1] [--keep4k 650,1050] [--out <dir>]
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import ffmpegPath from "ffmpeg-static";
import { CACHE, CHROME, CHROME_ARGS, PLAYER_PORT, args, pad, shoot } from "./common.mjs";
import { FRAMES } from "../timeline.mjs";

export async function renderFrames(opt) {
  const locale = opt.locale === "en" ? "en" : "uk";
  const player = opt.player || `http://127.0.0.1:${PLAYER_PORT}/`;
  const from = Number(opt.from ?? 0);
  const only = opt.only ? new Set(String(opt.only).split(",").map(Number)) : null;
  const to = only ? Math.max(...only) : Number(opt.to ?? FRAMES - 1);
  const keep4k = new Set(String(opt.keep4k ?? "").split(",").filter(Boolean).map(Number));
  const samples = opt.samples ? Number(opt.samples) : undefined;
  const outDir = opt.out || join(CACHE, locale, only ? "probe" : "final");
  const dir4k = join(CACHE, locale, "4k");
  if (!only && !opt.keepOut) rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });
  mkdirSync(dir4k, { recursive: true });
  const log = (...a) => console.log(`[frames ${locale}]`, ...a);

  const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: CHROME_ARGS });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 2,
    serviceWorkers: "block",
    locale: locale === "uk" ? "uk-UA" : "en-GB",
    timezoneId: "Europe/Kyiv",
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  const cdp = await context.newCDPSession(page);
  await page.goto(`${player}?locale=${locale}`);
  await page.waitForFunction(() => window.film && window.film.ready, null, { timeout: 300000 });
  const info = await page.evaluate(() => window.film.info);
  log("player ready", JSON.stringify(info));
  if (/swiftshader|llvmpipe|software/i.test(String(info.renderer))) throw new Error("software WebGL in the player");

  // Encoder for the 1080p frame sequence (only for contiguous renders).
  let ff = null;
  if (!only) {
    ff = spawn(
      ffmpegPath,
      [
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-f",
        "image2pipe",
        "-c:v",
        "png",
        "-framerate",
        "30",
        "-i",
        "-",
        "-vf",
        "scale=1920:1080:flags=lanczos+accurate_rnd+full_chroma_int",
        "-pix_fmt",
        "rgb24",
        "-start_number",
        String(from),
        join(outDir, "f%05d.png"),
      ],
      { stdio: ["pipe", "inherit", "inherit"] },
    );
  }
  let pipeError = null;
  if (ff) ff.stdin.on("error", (e) => (pipeError = e));
  const write = (buf) =>
    new Promise((ok, fail) => {
      if (pipeError) return fail(pipeError);
      if (ff.stdin.write(buf)) ok();
      else ff.stdin.once("drain", ok);
    });

  let mouse = { x: -1, y: -1 };
  const t0 = Date.now();
  const timings = [];
  const states = {};
  const hashes = {};
  for (let k = 0; k <= to; k++) {
    const want = k >= from && (!only || only.has(k));
    const p = await page.evaluate((k) => window.film.pointer(k), k);
    if (!p.skip && (p.x !== mouse.x || p.y !== mouse.y)) {
      await page.mouse.move(p.x, p.y);
      mouse = { x: p.x, y: p.y };
    }
    if (p.down) await page.mouse.down();
    if (p.up) await page.mouse.up();
    if (p.settle || p.down || p.up) await page.evaluate(() => window.film.settle());
    if (!want) {
      await page.evaluate((k) => window.film.skip(k), k);
      continue;
    }
    const ts = Date.now();
    const r = await page.evaluate(([k, s]) => window.film.render(k, s ? { samples: s } : {}), [k, samples]);
    const png = await shoot(cdp);
    hashes[k] = createHash("sha256").update(png).digest("hex").slice(0, 16);
    if (ff) await write(png);
    else writeFileSync(join(outDir, `f${pad(k)}.png`), png);
    if (keep4k.has(k)) writeFileSync(join(dir4k, `f${pad(k)}.png`), png);
    timings.push(Date.now() - ts);
    states[k] = r;
    if (k % 60 === 0) log(`frame ${k} ${r.mode} n=${r.samples} (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
  }
  if (ff) {
    ff.stdin.end();
    await new Promise((ok) => ff.on("close", ok));
  }
  const focusLog = Object.entries(states)
    .filter(([k]) => [1091, 1096, 1097, 1140, 1205, 1207].includes(Number(k)))
    .map(([k, v]) => `${k}:${v.focused}`);
  log("focus states", focusLog.join(" "));
  if (errors.length) log("page errors", errors.slice(0, 5));
  const summary = {
    locale,
    info,
    from,
    to,
    frames: timings.length,
    seconds: (Date.now() - t0) / 1000,
    msPerFrame: timings.reduce((a, b) => a + b, 0) / Math.max(1, timings.length),
    errors,
    hashes,
  };
  writeFileSync(join(CACHE, locale, `frames-${opt.tag || (only ? "probe" : "final")}.json`), JSON.stringify(summary, null, 1));
  await browser.close();
  log(`done ${summary.frames} frames in ${summary.seconds.toFixed(0)} s (${summary.msPerFrame.toFixed(0)} ms/frame)`);
  return summary;
}

if (process.argv[1] && process.argv[1].endsWith("frames.mjs")) {
  await renderFrames(args());
}
