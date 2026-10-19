// One deterministic command for the whole film (promo/README.md):
//   npm --prefix promo run render            both locales
//   npm --prefix promo run render -- --locale uk
// Stages: freeze the app and the player as static builds, capture the product's DOM frames,
// render every film frame, encode with the soundtrack, write poster/contact sheet/captions/log.
// Flags: --locale uk|en, --skip-build, --skip-capture, --skip-frames, --skip-encode, --animatic.
import { spawn } from "node:child_process";
import { join } from "node:path";
import { APP_PORT, CACHE, LOCALES, PLAYER_PORT, PROMO, args, freezeInfo } from "./common.mjs";
import { buildApp, buildPlayer, snapshot } from "./build.mjs";
import { serve } from "./serve.mjs";
import { renderFrames } from "./frames.mjs";
import { encode, soundtrack } from "./encode.mjs";

const opt = args();
const locales = opt.locale ? [opt.locale] : LOCALES;
const started = Date.now();
const say = (...a) => console.log(`[render ${((Date.now() - started) / 1000).toFixed(0)} s]`, ...a);

const freeze = freezeInfo();
say("HEAD", freeze.head, freeze.status ? `(working tree changes:\n${freeze.status})` : "(clean)");
if (!opt["skip-build"]) {
  const snap = snapshot();
  say("building the app from HEAD", snap.head, snap.dirty ? "(uncommitted app edits are not in the film)" : "");
  buildApp();
  say("building the film player");
  buildPlayer();
}
const appServer = await serve({ port: APP_PORT, mounts: { "/": join(CACHE, "app") }, spa: join(CACHE, "app") });
const playerServer = await serve({ port: PLAYER_PORT, mounts: { "/cache/": CACHE, "/": join(CACHE, "player") } });
say(`serving app :${APP_PORT}, player :${PLAYER_PORT}`);

function run(cmd, argv) {
  return new Promise((ok, fail) => {
    const p = spawn(process.execPath, [cmd, ...argv], { cwd: PROMO, stdio: "inherit" });
    p.on("close", (code) => (code === 0 ? ok() : fail(new Error(`${cmd} exited ${code}`))));
  });
}

// Frames kept at 4K for the poster and QA (handover, joins, determinism).
const KEEP = [0, 144, 146, 147, 149, 150, 629, 630, 740, 839, 840, 1096, 1140, 1259, 1260, 1409].join(",");
try {
  if (!opt["skip-encode"]) soundtrack();
  for (const locale of locales) {
    if (!opt["skip-capture"]) {
      say(`capturing the DOM (${locale})`);
      await run(join("capture", "dom.mjs"), ["--locale", locale, ...(opt.animatic ? ["--quick"] : [])]);
    }
    if (!opt["skip-frames"]) {
      say(`rendering frames (${locale})`);
      await renderFrames({ locale, keep4k: KEEP, ...(opt.animatic ? { samples: 1 } : {}) });
    }
    if (!opt["skip-encode"]) {
      say(`encoding (${locale})`);
      encode(locale);
    }
  }
} finally {
  appServer.close();
  playerServer.close();
}
say("done");
