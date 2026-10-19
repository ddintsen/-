// Encode the 1080p frame sequence with the soundtrack into the deliverables, plus the poster,
// the contact sheet, captions and the render log (promo/SCRIPT.md §11).
// Usage: node render/encode.mjs --locale uk
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import ffmpegPath from "ffmpeg-static";
import { CACHE, OUT, args, freezeInfo, pad } from "./common.mjs";
import { END_CARD, FRAMES, TITLES, XR_SHIFT } from "../timeline.mjs";
import { TRACK, TRACK_OFFSET, measure, mix } from "./music.mjs";

const ff = (argv) => execFileSync(ffmpegPath, ["-hide_banner", "-loglevel", "error", "-y", ...argv], { stdio: "inherit" });

export function soundtrack() {
  const file = join(CACHE, "music", `mix-${basename(TRACK, ".mp3")}-${TRACK_OFFSET.toFixed(4)}-${FRAMES}.m4a`);
  mkdirSync(join(CACHE, "music"), { recursive: true });
  if (!existsSync(file)) {
    const r = mix(file);
    writeFileSync(file + ".json", JSON.stringify(r, null, 1));
  }
  return file;
}

function vtt(locale) {
  const ts = (f) => {
    const s = f / 30;
    const m = Math.floor(s / 60);
    return `00:${String(m).padStart(2, "0")}:${(s - m * 60).toFixed(3).padStart(6, "0")}`;
  };
  const cues = [];
  for (const t of Object.values(TITLES)) cues.push([t.in[0], t.out[1], t[locale].replace(/ /g, " ")]);
  cues.push([END_CARD.actionIn[0], FRAMES, `${END_CARD.action[locale].replace(/ /g, " ")}\n${END_CARD.line[locale].replace(/ /g, " ")}`]);
  return "WEBVTT\n\n" + cues.map(([a, b, text], i) => `${i + 1}\n${ts(a)} --> ${ts(b)}\n${text}\n`).join("\n");
}

export function encode(locale) {
  mkdirSync(OUT, { recursive: true });
  const frames = join(CACHE, locale, "final");
  const audio = soundtrack();
  const mp4 = join(OUT, `orbita-promo-${locale}.mp4`);
  const t0 = Date.now();
  ff([
    "-framerate", "30", "-start_number", "0", "-i", join(frames, "f%05d.png"),
    "-i", audio,
    "-map", "0:v:0", "-map", "1:a:0",
    "-vf", "scale=1920:1080:flags=lanczos+accurate_rnd+full_chroma_int:out_color_matrix=bt709:out_range=tv,format=yuv420p",
    "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-profile:v", "high", "-level:v", "4.1", "-pix_fmt", "yuv420p",
    "-x264-params", "keyint=60:min-keyint=30:scenecut=0:aq-mode=3",
    "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-color_range", "tv",
    "-c:a", "copy", "-frames:v", String(FRAMES), "-t", String(FRAMES / 30), "-movflags", "+faststart", mp4,
  ]);
  let size = statSync(mp4).size;
  if (size > 40e6) {
    ff([
      "-framerate", "30", "-start_number", "0", "-i", join(frames, "f%05d.png"), "-i", audio,
      "-map", "0:v:0", "-map", "1:a:0",
      "-vf", "scale=1920:1080:flags=lanczos+accurate_rnd+full_chroma_int:out_color_matrix=bt709:out_range=tv,format=yuv420p",
      "-c:v", "libx264", "-preset", "slow", "-crf", "20", "-profile:v", "high", "-level:v", "4.1", "-pix_fmt", "yuv420p",
      "-x264-params", "keyint=60:min-keyint=30:scenecut=0:aq-mode=3",
      "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-color_range", "tv",
      "-c:a", "copy", "-frames:v", String(FRAMES), "-t", String(FRAMES / 30), "-movflags", "+faststart", mp4,
    ]);
    size = statSync(mp4).size;
  }
  // Poster: the visor highlight with T3, from the 4K frame when kept, else the 1080p frame.
  const POSTER = 650 + XR_SHIFT;
  const poster4k = join(CACHE, locale, "4k", `f${pad(POSTER)}.png`);
  const posterSrc = existsSync(poster4k) ? poster4k : join(frames, `f${pad(POSTER)}.png`);
  ff(["-i", posterSrc, "-vf", "scale=1920:1080:flags=lanczos", join(OUT, `orbita-promo-${locale}-poster.png`)]);
  ff(["-i", posterSrc, "-vf", "scale=1920:1080:flags=lanczos", "-q:v", "2", join(OUT, `orbita-promo-${locale}-poster.jpg`)]);
  // Contact sheet every 2 s (frames 0, 60, …, 1380 and the last frame).
  ff([
    "-i", mp4,
    "-vf", `select='not(mod(n\\,60))+eq(n\\,${FRAMES - 1})',scale=480:270,tile=6x5:padding=8:margin=8:color=0x050a16`,
    "-frames:v", "1", "-fps_mode", "vfr", join(OUT, `orbita-promo-${locale}-contact.png`),
  ]);
  writeFileSync(join(OUT, `orbita-promo-${locale}.vtt`), vtt(locale));
  // Probe: stream facts from ffmpeg's own report, frame count by decoding.
  const probe = spawnSync(ffmpegPath, ["-hide_banner", "-i", mp4, "-map", "0:v:0", "-f", "null", "-"], { encoding: "utf8" }).stderr;
  const framesDecoded = Number((probe.match(/frame=\s*(\d+)/g) || []).pop()?.replace(/\D/g, "") || 0);
  const loud = measure(mp4);
  const captureLog = (() => {
    try {
      const c = JSON.parse(readFileSync(join(CACHE, locale, "dom", "capture.json"), "utf8"));
      return { renderer: c.renderer, T_start: c.T_start, T_mount: c.T_mount, measure: { scrollMax: c.measure.scrollMax, chip: c.chipCentre, cta: c.ctaCentre, wordmark: c.measure.wordmark.rect }, clicks: c.clicks, textChecks: c.textChecks.map((t) => ({ frame: t.frame, forbidden: t.forbidden })), freeze: c.freeze, seconds: c.seconds };
    } catch {
      return null;
    }
  })();
  const framesLog = (() => {
    try {
      return JSON.parse(readFileSync(join(CACHE, locale, "frames-final.json"), "utf8"));
    } catch {
      return null;
    }
  })();
  const log = {
    locale,
    file: mp4,
    bytes: size,
    framesDecoded,
    streams: (probe.match(/Stream #0:\d.*$/gm) || []).map((s) => s.trim()),
    duration: (probe.match(/Duration: ([\d:.]+)/) || [])[1],
    audio: { track: TRACK, offsetSeconds: TRACK_OFFSET, loudness: loud },
    capture: captureLog,
    frames: framesLog && { info: framesLog.info, seconds: framesLog.seconds, msPerFrame: framesLog.msPerFrame, errors: framesLog.errors },
    freeze: freezeInfo(),
    encodeSeconds: (Date.now() - t0) / 1000,
  };
  writeFileSync(join(OUT, `render-log-${locale}.json`), JSON.stringify(log, null, 1));
  console.log(`[encode ${locale}] ${mp4} ${(size / 1e6).toFixed(1)} MB, ${framesDecoded} frames, ${loud.integrated} LUFS, TP ${loud.truePeak} dBTP`);
  return log;
}

if (process.argv[1] && process.argv[1].endsWith("encode.mjs")) {
  const a = args();
  for (const loc of a.locale ? [a.locale] : ["uk", "en"]) encode(loc);
}
