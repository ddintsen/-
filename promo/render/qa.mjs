// Automatic QA for a finished render (promo/SCRIPT.md §12). Reports only what it measured.
// Usage: node render/qa.mjs --locale uk [--determinism]   (determinism needs the player server)
import { chromium } from "playwright";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import ffmpegPath from "ffmpeg-static";
import { CACHE, CHROME, CHROME_ARGS, OUT, PLAYER_PORT, args, pad, shoot } from "./common.mjs";
import { mad, meanLuminance, psnr, readPng } from "./png.mjs";
import { FORBIDDEN, LOCALES } from "./common.mjs";
import { DOM_LAST, END_CARD, FRAMES, TITLES, XR_SHIFT } from "../timeline.mjs";
import { serve } from "./serve.mjs";

const opt = args();
const locales = opt.locale ? [opt.locale] : LOCALES;

function lum(hex) {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}
const contrast = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

async function qa(locale) {
  const res = { locale, joins: {}, spikes: [], titles: {}, text: {}, determinism: null, envRegistration: null };
  const k4 = (k) => join(CACHE, locale, "4k", `f${pad(k)}.png`);
  const fin = (k) => join(CACHE, locale, "final", `f${pad(k)}.png`);
  const cap = JSON.parse(readFileSync(join(CACHE, locale, "dom", "capture.json"), "utf8"));
  const wm = cap.measure.wordmark.rect;

  // Joins at 4K.
  const pair = (a, b, rect) => {
    if (!existsSync(k4(a)) || !existsSync(k4(b))) return null;
    const r = mad(readPng(k4(a)), readPng(k4(b)), rect);
    return { mad: +r.mad.toFixed(3), max: r.max };
  };
  const box = { x: Math.floor(wm.x * 2) - 4, y: Math.floor(wm.y * 2) - 4, w: Math.ceil(wm.w * 2) + 8, h: Math.ceil(wm.h * 2) + 8 };
  res.joins.lockupHandover = existsSync(k4(146)) ? { frames: "146/147", ...pair(146, 147, box) } : { frames: "144/149", ...pair(144, 149, box) };
  const X = XR_SHIFT;
  res.joins.pane = { frames: `${DOM_LAST}/${DOM_LAST + 1}`, ...pair(DOM_LAST, DOM_LAST + 1) };
  res.joins.lensIn = { frames: `${749 + X}/${750 + X}`, ...pair(749 + X, 750 + X) };
  res.joins.lensOut = { frames: `${1169 + X}/${1170 + X}`, ...pair(1169 + X, 1170 + X) };

  // Consecutive-frame differences at 1080p (sampled grid), spikes above 3× the local median.
  const diffs = [0];
  let prev = readPng(fin(0));
  for (let k = 1; k < FRAMES; k++) {
    const cur = readPng(fin(k));
    let sum = 0,
      n = 0;
    for (let y = 0; y < cur.height; y += 3)
      for (let x = 0; x < cur.width; x += 3) {
        const i = (y * cur.width + x) * cur.channels;
        sum += Math.abs(cur.data[i] - prev.data[i]) + Math.abs(cur.data[i + 1] - prev.data[i + 1]) + Math.abs(cur.data[i + 2] - prev.data[i + 2]);
        n += 3;
      }
    diffs.push(sum / n);
    prev = cur;
  }
  // Product state changes: focus open/close, night to day, spatial open, day to night, select, panorama.
  const allowed = [334, 421, 480, 553, 600, 1006 + XR_SHIFT, 1116 + XR_SHIFT];
  for (let k = 1; k < diffs.length; k++) {
    const w = diffs.slice(Math.max(1, k - 15), Math.min(diffs.length, k + 16)).sort((a, b) => a - b);
    const med = w[w.length >> 1];
    if (diffs[k] > 3 * med && diffs[k] > 1.5) {
      // Designed changes: product state changes, the cold-open dissolve, the lens light bloom.
      const expected = allowed.some((f) => k - f >= -2 && k - f <= 10) || (k >= 129 && k <= 150) || (k >= 737 + XR_SHIFT && k <= 772 + XR_SHIFT) || (k >= 1168 + XR_SHIFT && k <= 1192 + XR_SHIFT) || (k >= 480 && k <= 497) || (k >= 600 && k <= 617);
      res.spikes.push({ frame: k, mad: +diffs[k].toFixed(2), localMedian: +med.toFixed(2), expected });
    }
  }
  res.frameDiff = { max: +Math.max(...diffs).toFixed(2), mean: +(diffs.reduce((a, b) => a + b, 0) / diffs.length).toFixed(2) };

  // Title contrast against the luminance under each title box (frames just before entry and after exit).
  const textL = lum("#f5f3f8");
  const titleBox = (anchor) => (anchor === "bottom-left" ? { x: 120, y: 900, w: 900, h: 90 } : { x: 120, y: 40, w: 1100, h: 92 });
  for (const [id, t] of Object.entries(TITLES)) {
    const b = titleBox(t.anchor);
    const frames = [t.in[0] - 1, t.out[1] + 1];
    const lums = frames.map((k) => meanLuminance(readPng(fin(k)), b));
    const worst = Math.max(...lums.map((l) => l.mean));
    res.titles[id] = { text: t[locale], contrastMean: +contrast(textL, worst).toFixed(1), brightestPixel: +Math.max(...lums.map((l) => l.max)).toFixed(3) };
    res.text[id] = FORBIDDEN.test(t[locale]) ? "FORBIDDEN" : "ok";
  }
  {
    const before = readPng(fin(END_CARD.lockupIn[0] - 1));
    const a = meanLuminance(before, { x: 560, y: 420, w: 800, h: 80 });
    const d = meanLuminance(before, { x: 420, y: 505, w: 1080, h: 64 });
    res.titles.endAction = { contrastMean: +contrast(textL, a.mean).toFixed(1) };
    res.titles.endLine = { contrastMean: +contrast(lum("#c6c4ce"), d.mean).toFixed(1) };
    res.text.endCard = FORBIDDEN.test(END_CARD.action[locale] + END_CARD.line[locale]) || /github|\.io/i.test(END_CARD.line[locale]) ? "FORBIDDEN" : "ok";
  }
  res.text.dom = cap.textChecks.map((c) => ({ frame: c.frame, forbidden: c.forbidden }));

  // Phone-size strip (390 px wide) for viewing.
  mkdirSync(join(OUT, "qa"), { recursive: true });
  const mp4 = join(OUT, `orbita-promo-${locale}.mp4`);
  if (existsSync(mp4)) {
    execFileSync(ffmpegPath, [
      "-hide_banner", "-loglevel", "error", "-y", "-i", mp4,
      "-vf", "select='eq(n\\,90)+eq(n\\,520)+eq(n\\,750)+eq(n\\,890)+eq(n\\,1050)+eq(n\\,1140)+eq(n\\,1340)+eq(n\\,1400)',scale=390:219:flags=area,tile=2x4:padding=6:color=0x000000",
      "-frames:v", "1", "-fps_mode", "vfr", join(OUT, "qa", `phone-${locale}.png`),
    ]);
  }

  // Determinism and environment registration (needs the player server).
  if (opt.determinism) {
    let server = null;
    try {
      server = await serve({ port: PLAYER_PORT, mounts: { "/cache/": CACHE, "/": join(CACHE, "player") } });
    } catch {
      /* a render server is already serving the player */
    }
    const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: CHROME_ARGS });
    const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 2, serviceWorkers: "block" });
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    await page.goto(`http://127.0.0.1:${PLAYER_PORT}/?locale=${locale}`);
    await page.waitForFunction(() => window.film && window.film.ready, null, { timeout: 300000 });
    await page.evaluate(() => window.film.probeDesktop(150));
    const envShot = join(CACHE, locale, "4k", "probe-env-150.png");
    writeFileSync(envShot, await shoot(cdp));
    const domEnv = join(CACHE, locale, "dom", "f00150_env.png");
    if (existsSync(domEnv)) res.envRegistration = { psnrDb: +psnr(readPng(envShot), readPng(domEnv)).toFixed(2) };
    const det = {};
    for (let k = 0; k <= 1050 + XR_SHIFT; k++) {
      const p = await page.evaluate((k) => window.film.pointer(k), k);
      if (!p.skip) await page.mouse.move(p.x, p.y);
      if (p.down) await page.mouse.down();
      if (p.up) await page.mouse.up();
      if (p.settle || p.down || p.up) await page.evaluate(() => window.film.settle());
      if (k === 650 + XR_SHIFT || k === 1050 + XR_SHIFT) {
        await page.evaluate((k) => window.film.render(k), k);
        const png = await shoot(cdp);
        const ref = existsSync(k4(k)) ? readFileSync(k4(k)) : null;
        det[k] = ref ? (Buffer.compare(png, ref) === 0 ? "identical bytes" : `differs (MAD ${mad(readPng(k4(k)), (writeFileSync(join(CACHE, locale, "4k", `rerender-${k}.png`), png), readPng(join(CACHE, locale, "4k", `rerender-${k}.png`)))).mad.toFixed(4)})`) : "no reference";
      } else await page.evaluate((k) => window.film.skip(k), k);
    }
    res.determinism = det;
    await browser.close();
    server?.close();
  }
  writeFileSync(join(OUT, "qa", `qa-${locale}.json`), JSON.stringify(res, null, 1));
  console.log(JSON.stringify(res, null, 1));
  return res;
}

for (const l of locales) await qa(l);
