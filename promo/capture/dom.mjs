// DOM capture of the real product, frame by frame (promo/SCRIPT.md §9).
// Usage: node capture/dom.mjs --locale uk [--app http://127.0.0.1:5175/] [--quick] [--to 539]
// Output: .cache/<loc>/dom/fNNNNN_sK.png (3840×2160) and .cache/<loc>/dom/capture.json.
import { chromium } from "playwright";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  APP_PORT,
  CACHE,
  CHROME,
  CHROME_ARGS,
  FORBIDDEN,
  args,
  freezeInfo,
  pad,
  shoot,
  sleep,
} from "../render/common.mjs";
import * as TL from "../timeline.mjs";

const opt = args();
const locale = opt.locale === "en" ? "en" : "uk";
const appUrl = opt.app || `http://127.0.0.1:${APP_PORT}/`;
const quick = !!opt.quick;
const lastFrame = Number(opt.to ?? TL.DOM_LAST);
const outDir = join(CACHE, locale, "dom");
rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

const log = (...a) => console.log(`[dom ${locale}]`, ...a);
const started = Date.now();
const freezeBefore = freezeInfo();

const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: CHROME_ARGS });
const context = await browser.newContext({
  viewport: { width: 1920, height: 1080 },
  deviceScaleFactor: 2,
  reducedMotion: "no-preference",
  serviceWorkers: "block",
  locale: locale === "uk" ? "uk-UA" : "en-GB",
  timezoneId: "Europe/Kyiv",
});
await context.addInitScript(
  ({ locale }) => {
    try {
      localStorage.setItem("orbita-locale", locale);
    } catch {}
    // three.js announces every Scene and WebGLRenderer to a devtools hook; keep weak handles
    // so the capture can read the backdrop's camera and environment clock (read only).
    const hook = new EventTarget();
    window.__filmScenes = [];
    hook.addEventListener("observe", (e) => {
      const o = e.detail;
      if (o && o.isScene) window.__filmScenes.push(new WeakRef(o));
    });
    window.__THREE_DEVTOOLS__ = hook;
  },
  { locale },
);
const page = await context.newPage();
const cdp = await context.newCDPSession(page);
const consoleErrors = [];
page.on("console", (m) => {
  if (m.type() === "error") consoleErrors.push(m.text());
});
page.on("pageerror", (e) => consoleErrors.push(String(e)));

/* ---------------------------------------------------------------- settle ---- */
await page.clock.install({ time: new Date("2026-10-18T10:00:00+03:00") });
await page.goto(appUrl, { waitUntil: "load" });
await page.waitForSelector(".cockpit .wing", { timeout: 60000 });
await page.evaluate(() => document.fonts.ready.then(() => true));
{
  const now = await page.evaluate(() => Date.now());
  await page.clock.pauseAt(new Date(now + 100));
}
const perf = () => page.evaluate(() => performance.now());
{
  const a = await perf();
  await sleep(500);
  const b = await perf();
  if (a !== b) throw new Error(`page clock not paused (${a} -> ${b})`);
}
async function step(ms, each = 16, realYield = 0) {
  let left = ms;
  while (left > 0) {
    const d = Math.min(each, left);
    await page.clock.runFor(d);
    left -= d;
    if (realYield) await sleep(realYield);
  }
}
async function until(fn, label, { timeout = 30000, advance = 16 } = {}) {
  const t0 = Date.now();
  for (;;) {
    if (await page.evaluate(fn)) return;
    if (Date.now() - t0 > timeout) throw new Error(`timeout waiting for ${label}`);
    if (advance) await page.clock.runFor(advance);
    await sleep(20);
  }
}
async function quietAnimations(label) {
  // Real-time CSS transitions (theme cross-fade) must finish before the paused sequence.
  const t0 = Date.now();
  for (;;) {
    const running = await page.evaluate(
      () =>
        document
          .getAnimations()
          .filter((a) => a.playState === "running" && !(a.animationName === "spin")).length,
    );
    if (!running) return;
    if (Date.now() - t0 > 8000) {
      log(`warning: ${running} animations still running after ${label}`);
      return;
    }
    await sleep(100);
  }
}

await step(4000, 16, 0);
// Dark environment: the app starts in "office" and does not persist the theme.
await page.evaluate(() => {
  if (document.documentElement.dataset.theme !== "dark")
    document.querySelector(".topbar .icon-button").dispatchEvent(new MouseEvent("click", { bubbles: true }));
});
await until(() => document.documentElement.dataset.theme === "dark", "dark theme");
await step(1000);
await quietAnimations("theme");

const renderer = await page.evaluate(() => {
  const c = document.createElement("canvas").getContext("webgl2");
  const ext = c.getExtension("WEBGL_debug_renderer_info");
  return c.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : c.RENDERER);
});
if (/swiftshader|llvmpipe|software/i.test(renderer)) throw new Error(`software WebGL: ${renderer}`);
log("renderer", renderer);

// Pre-warm the spatial chunk, its textures and the Earth photographs, then close it.
await page.evaluate(() => document.querySelector(".xr-entry").dispatchEvent(new MouseEvent("click", { bubbles: true })));
await until(() => !!document.querySelector(".xr-canvas canvas"), "spatial canvas");
// The canvas mounts before its scene has loaded; the app marks the loaded scene.
await until(() => document.querySelector(".xr-canvas")?.dataset.sceneReady === "true", "spatial scene");
await step(1500, 16, 2);
// The preview toolbar's «Dark environment» button (same layout in either theme).
const darkButton = await page.evaluate(() => {
  const b = document.querySelectorAll(".spatial-modal .xr-environments .button")[1];
  const r = b.getBoundingClientRect();
  return { text: b.textContent.trim(), cx: r.x + r.width / 2, cy: r.y + r.height / 2, w: r.width, h: r.height };
});
await page.keyboard.press("Escape");
await page.evaluate(() => document.activeElement && document.activeElement.blur());
await until(() => !document.querySelector(".spatial-modal"), "spatial closed");
await until(() => !!document.querySelector('.space-backdrop canvas[data-space-ready="true"]'), "backdrop remount", { advance: 16 });
const T_mount = await perf();
await step(3500, 16, 0);
const motion = await page.evaluate(() => document.querySelector(".space-backdrop canvas")?.dataset.spaceMotion);
if (motion !== "drift") throw new Error(`backdrop motion is ${motion}, expected drift (GPU)`);

// Measurements (live) before the sequence.
const measure = await page.evaluate(() => {
  const r = (el) => {
    const b = el.getBoundingClientRect();
    return { x: b.x, y: b.y, w: b.width, h: b.height, cx: b.x + b.width / 2, cy: b.y + b.height / 2 };
  };
  const wordmark = document.querySelector(".topbar .wordmark");
  const logo = wordmark.querySelector("img");
  const divider = wordmark.querySelector(".brand-divider");
  const label = wordmark.querySelector("span:last-child");
  const cs = (el, keys) => Object.fromEntries(keys.map((k) => [k, getComputedStyle(el)[k]]));
  const chips = [...document.querySelectorAll(".workspace-footer .attention-items .button")];
  const chip = chips.find((b) => /Recycle/.test(b.textContent));
  const cta = document.querySelector(".xr-entry");
  const toggle = document.querySelector(".topbar .icon-button");
  return {
    toggle: { label: toggle.getAttribute("aria-label"), rect: r(toggle) },
    scrollMax: document.documentElement.scrollHeight - innerHeight,
    wordmark: {
      rect: r(wordmark),
      logo: { rect: r(logo), src: logo.currentSrc || logo.src, ...cs(logo, ["filter", "width", "height"]) },
      divider: { rect: r(divider), ...cs(divider, ["opacity", "backgroundColor", "width", "height"]) },
      label: { rect: r(label), text: label.textContent, ...cs(label, ["fontFamily", "fontSize", "fontWeight", "letterSpacing", "color", "top", "position", "lineHeight"]) },
      style: cs(wordmark, ["gap", "color", "fontFamily", "fontSize", "fontWeight", "letterSpacing", "minHeight", "lineHeight", "alignItems"]),
      html: wordmark.outerHTML,
    },
    chip: chip ? { text: chip.textContent.trim(), docRect: { ...r(chip), docY: chip.getBoundingClientRect().y + scrollY } } : null,
    chips: chips.map((b) => b.textContent.trim()),
    cta: { text: cta.textContent.trim(), rect: r(cta) },
    title: document.querySelector(".page-heading h1")?.textContent,
    period: document.querySelector(".report-period strong")?.textContent,
    fontsOk: document.fonts.check('600 18px "Pryvat Sans Display"') && document.fonts.check('500 14px "Pryvat Sans"'),
  };
});
if (!measure.chip) throw new Error("Recycle chip not found in the attention zones");
const chipCentre = [measure.chip.docRect.cx, measure.chip.docRect.docY + measure.chip.docRect.h / 2 - measure.scrollMax];
const ctaCentre = [measure.cta.rect.cx, measure.cta.rect.cy];
const toggleCentre = [measure.toggle.rect.cx, measure.toggle.rect.cy];
const darkCentre = [darkButton.cx, darkButton.cy];
measure.darkButton = darkButton;
log("measure", JSON.stringify({ scrollMax: measure.scrollMax, chip: chipCentre, cta: ctaCentre, toggle: toggleCentre, dark: darkCentre, wordmark: measure.wordmark.rect }));

// Hide the header wordmark until the lockup lands on it (f144).
await page.addStyleTag({ content: ".topbar .wordmark { visibility: hidden !important; }" }).then((h) =>
  page.evaluate((el) => el.setAttribute("id", "film-hide-wordmark"), h),
);

// Restart the arrival without touching inline delays, then adopt and pause it.
await page.evaluate(() => {
  const sel = ".cockpit .wing, .cockpit .wing-cards > .dashboard-card, .grow-bar, .progress-fill";
  document.querySelectorAll(sel).forEach((el) => (el.style.animationName = "none"));
  void document.body.offsetHeight;
  document.querySelectorAll(sel).forEach((el) => (el.style.animationName = ""));
  const names = new Set(["stand-arrive", "section-arrive", "bar-grow", "fill-grow"]);
  window.__film = { adopted: new Map() };
  const inventory = {};
  for (const a of document.getAnimations()) {
    if (!names.has(a.animationName)) continue;
    a.pause();
    a.currentTime = 0;
    window.__film.adopted.set(a, { birth: 150, speed: 1 });
    inventory[a.animationName] = (inventory[a.animationName] || 0) + 1;
  }
  window.__film.inventory = inventory;
  // Every other running animation and transition from here on is adopted when first seen.
  window.__film.themeFrames = [];
  window.__film.seek = (t) => {
    for (const a of document.getAnimations()) {
      if (!window.__film.adopted.has(a)) {
        a.pause();
        // The theme cross-fade (CSS transitions born at a theme change) is eased from 0.2 s to 0.5 s.
        const theme = window.__film.themeFrames.some((f) => t >= f - 0.5 && t <= f + 3);
        const isTransition = typeof CSSTransition !== "undefined" && a instanceof CSSTransition;
        window.__film.adopted.set(a, { birth: t, speed: theme && isTransition ? window.__film.themeSpeed : 1 });
      }
    }
    for (const [a, info] of window.__film.adopted) {
      if (a.playState === "idle") {
        window.__film.adopted.delete(a);
        continue;
      }
      a.currentTime = Math.max(0, ((t - info.birth) * 1000 * info.speed) / 30);
    }
  };
  window.__film.envState = () => {
    for (const ref of window.__filmScenes) {
      const s = ref.deref();
      const st = s && s.__r3f && s.__r3f.root && s.__r3f.root.getState();
      if (!st || !st.gl.domElement.isConnected || !st.gl.domElement.closest(".space-backdrop")) continue;
      const env = s.getObjectByName("space-environment");
      if (!env) continue;
      const [, stars, earth, sun] = env.children;
      const spin = earth.children[0];
      const cloud = earth.children.length > 2 ? earth.children[1] : null;
      const cam = st.camera;
      return {
        spinY: spin.rotation.y,
        cloudY: cloud ? cloud.rotation.y : null,
        starTime: stars.material.uniforms.time.value,
        cloudTime: cloud ? cloud.children[0].material.uniforms.time.value : null,
        sunScale: sun ? sun.scale.x : null,
        clock: st.clock.elapsedTime,
        camera: { p: cam.position.toArray(), q: cam.quaternion.toArray(), fov: cam.fov, near: cam.near, far: cam.far },
        dpr: st.gl.getPixelRatio(),
        size: [st.size.width, st.size.height],
      };
    }
    return null;
  };
  window.__film.cursorShape = (x, y) => {
    const el = document.elementFromPoint(x, y);
    return !!el && getComputedStyle(el).cursor === "pointer";
  };
  window.__film.visibleText = () => {
    const out = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const el = n.parentElement;
      if (!el || el.closest(".sr-only") || !n.textContent.trim()) continue;
      if (!el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) continue;
      out.push(n.textContent.trim());
    }
    return out.join(" | ");
  };
});
await page.evaluate(([f1, f2, sp]) => {
  window.__film.themeFrames = [f1, f2];
  window.__film.themeSpeed = sp;
}, [TL.THEME_LIGHT, TL.THEME_DARK, TL.THEME_TRANSITION_SPEED]);
const inventory = await page.evaluate(() => window.__film.inventory);
log("arrival inventory", JSON.stringify(inventory));

/* --------------------------------------------------------------- sequence ---- */
const T_start = (await perf()) - TL.domClockMs(TL.DOM_FIRST);
let mouseOn = false;
const frames = {};
const textChecks = [];
const events = new Map(TL.MOUSE_EVENTS.map(([f, e]) => [`${f}`, e]));
let clicks = [];
for (let k = TL.DOM_FIRST; k <= lastFrame; k++) {
  const n = quick ? 1 : TL.domSubframeCount(k);
  const subs = n === 4 ? TL.DOM_SUB_MS : [0];
  const info = { subs: [], env: null };
  for (let i = 0; i < subs.length; i++) {
    const target = T_start + TL.domClockMs(k, subs[i]);
    const t = ((target - T_start) * 3) / 100; // film frames
    // Scroll and pointer for this instant, then let the page clock reach it.
    const y = TL.scrollAt(t, measure.scrollMax);
    await page.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" }), y);
    const c = TL.cursorAt(t, chipCentre, ctaCentre, toggleCentre, darkCentre);
    if (t >= 282) {
      await page.mouse.move(c.x, c.y);
      mouseOn = true;
    }
    if (i === 0 && events.has(`${k}`)) {
      const e = events.get(`${k}`);
      if (e === "down") await page.mouse.down();
      else await page.mouse.up();
      clicks.push({ frame: k, e });
    }
    if (i === 0 && k === TL.WORDMARK_SHOW) await page.evaluate(() => document.getElementById("film-hide-wordmark")?.remove());
    const now = await perf();
    if (target > now) await page.clock.runFor(target - now);
    // Product state changes driven by the clicks above.
    if (i === 0 && k === TL.FOCUS_OPEN) await until(() => !!document.querySelector(".focus-modal"), "focus modal", { advance: 0 });
    if (i === 0 && k === TL.FOCUS_CLOSE) await until(() => !document.querySelector(".focus-modal"), "focus closed", { advance: 0 });
    if (i === 0 && k === TL.THEME_LIGHT) await until(() => document.documentElement.dataset.theme === "office", "light theme", { advance: 0 });
    if (i === 0 && k === TL.THEME_DARK) await until(() => document.documentElement.dataset.theme === "dark", "dark theme again", { advance: 0 });
    if (i === 0 && k === TL.SPATIAL_OPEN) {
      await until(() => !!document.querySelector(".spatial-modal .xr-canvas canvas"), "spatial canvas", { advance: 0 });
      await sleep(400); // real-time canvas sizing (ResizeObserver) before the first clock frame
    }
    await page.evaluate((t) => window.__film.seek(t), t);
    const hand = mouseOn ? await page.evaluate(([x, y]) => window.__film.cursorShape(x, y), [c.x, c.y]) : false;
    const png = await shoot(cdp);
    writeFileSync(join(outDir, `f${pad(k)}_s${i}.png`), png);
    info.subs.push({ t, scroll: y, cursor: { ...c, hand }, ms: target - T_start });
  }
  if (k <= 150) info.env = await page.evaluate(() => window.__film.envState());
  if (k === 150) {
    // QA: the backdrop alone at f150, to check the player's environment registration (§9.4).
    const h = await page.addStyleTag({ content: ".app-shell, .skip-link { visibility: hidden !important; }" });
    writeFileSync(join(outDir, "f00150_env.png"), await shoot(cdp));
    await h.evaluate((el) => el.remove());
  }
  if ([149, 200, 300, 380, 470, 520, 580, TL.DOM_LAST].includes(k)) {
    const text = await page.evaluate(() => window.__film.visibleText());
    textChecks.push({ frame: k, forbidden: FORBIDDEN.test(text) ? text.match(FORBIDDEN)[0] : null, sample: text.slice(0, 400) });
  }
  if (k === 380) info.focusModal = await page.evaluate(() => {
    const m = document.querySelector(".focus-modal");
    if (!m) return null;
    const b = m.getBoundingClientRect();
    return { x: b.x, y: b.y, w: b.width, h: b.height, title: m.querySelector("h2")?.textContent, description: m.querySelector(".modal-header p")?.textContent };
  });
  if (k === lastFrame) {
    info.spatialModal = await page.evaluate(() => {
      const m = document.querySelector(".spatial-modal");
      if (!m) return null;
      const b = m.getBoundingClientRect();
      const canvas = m.querySelector(".xr-canvas");
      const cb = canvas?.getBoundingClientRect();
      return {
        x: b.x,
        y: b.y,
        w: b.width,
        h: b.height,
        radius: parseFloat(getComputedStyle(m).borderTopLeftRadius),
        canvas: cb ? { x: cb.x, y: cb.y, w: cb.width, h: cb.height } : null,
        // The scene finishes loading as the film clock advances (React reveals a resolved
        // Suspense boundary on a timer), so it is checked here rather than awaited at the click.
        sceneReady: canvas?.dataset.sceneReady === "true",
        support: m.querySelector(".xr-support")?.textContent ?? null,
        title: m.querySelector("h2")?.textContent,
      };
    });
    if (info.spatialModal && !info.spatialModal.sceneReady) throw new Error("spatial scene not loaded by the last DOM frame");
  }
  frames[k] = info;
  if (k % 30 === 0) log(`frame ${k} (${((Date.now() - started) / 1000).toFixed(0)} s)`);
}

const freezeAfter = freezeInfo();
const result = {
  locale,
  appUrl,
  quick,
  renderer,
  T_start,
  T_mount,
  measure,
  chipCentre,
  ctaCentre,
  toggleCentre,
  darkCentre,
  clicks,
  frames,
  textChecks,
  consoleErrors,
  freeze: { before: freezeBefore, after: freezeAfter, stable: JSON.stringify(freezeBefore) === JSON.stringify(freezeAfter) },
  seconds: (Date.now() - started) / 1000,
};
writeFileSync(join(outDir, "capture.json"), JSON.stringify(result, null, 1));
for (const c of textChecks) if (c.forbidden) log(`FORBIDDEN TEXT at f${c.frame}: ${c.forbidden}`);
if (!result.freeze.stable) log("WARNING: source tree changed during capture");
log(`done in ${result.seconds.toFixed(0)} s`);
await browser.close();
