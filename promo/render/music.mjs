// Music analysis and mix for the film soundtrack.
// Onsets: spectral flux of the decoded track (mono, 22.05 kHz); tempo by autocorrelation of
// the onset envelope. The mix is a two-pass EBU R128 loudnorm with fades, cut to picture.
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import ffmpegPath from "ffmpeg-static";
import { CACHE, PROMO, args } from "./common.mjs";

export const TRACK = join(PROMO, "music", "pixabay-future-design-344320.mp3");
/**
 * The film plays the track from TRACK_OFFSET s (film t = track t − OFFSET). «Future Design»: the
 * drop's first bass hit (18.44 s) lands on the night-to-day theme flip (f480); the downbeats every
 * two bars (3.99 s) fall on the return to night (f600), the headset's reveal (f719) and the lens
 * bloom (f839), within four frames of the head turn (f963) and the «Panorama» press (f1202); the breakdown
 * (45.28 s) opens under the pull-out, so the end card rides into it.
 */
export const TRACK_OFFSET = 2.443;
export const FILM_SECONDS = 47;

function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang),
      wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1,
        ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const ar = re[i + k],
          ai = im[i + k];
        const br = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci;
        const bi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr;
        re[i + k] = ar + br;
        im[i + k] = ai + bi;
        re[i + k + len / 2] = ar - br;
        im[i + k + len / 2] = ai - bi;
        const t = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = t;
      }
    }
  }
}

export function analyse(seconds = 60) {
  mkdirSync(join(CACHE, "music"), { recursive: true });
  const pcmFile = join(CACHE, "music", "track-mono-22050.f32");
  execFileSync(ffmpegPath, ["-hide_banner", "-loglevel", "error", "-y", "-i", TRACK, "-t", String(seconds), "-ac", "1", "-ar", "22050", "-f", "f32le", pcmFile]);
  const buf = readFileSync(pcmFile);
  const pcm = new Float32Array(buf.buffer, buf.byteOffset, buf.length / 4);
  const sr = 22050,
    N = 1024,
    hop = 256;
  const win = new Float32Array(N).map((_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N));
  let prev = new Float32Array(N / 2);
  const flux = [],
    rms = [];
  for (let s = 0; s + N <= pcm.length; s += hop) {
    const re = new Float64Array(N),
      im = new Float64Array(N);
    let e = 0;
    for (let i = 0; i < N; i++) {
      re[i] = pcm[s + i] * win[i];
      e += pcm[s + i] * pcm[s + i];
    }
    fft(re, im);
    const mag = new Float32Array(N / 2);
    let f = 0;
    for (let b = 1; b < N / 2; b++) {
      mag[b] = Math.log1p(100 * Math.hypot(re[b], im[b]));
      const d = mag[b] - prev[b];
      if (d > 0) f += d;
    }
    prev = mag;
    flux.push(f);
    rms.push(Math.sqrt(e / N));
  }
  const dt = hop / sr;
  // Adaptive threshold: local median + offset.
  const W = Math.round(0.5 / dt);
  const onsets = [];
  for (let i = 1; i < flux.length - 1; i++) {
    const lo = Math.max(0, i - W),
      hi = Math.min(flux.length, i + W);
    const local = flux.slice(lo, hi).sort((a, b) => a - b);
    const med = local[local.length >> 1];
    const mean = local.reduce((a, b) => a + b, 0) / local.length;
    if (flux[i] > flux[i - 1] && flux[i] >= flux[i + 1] && flux[i] > med * 1.5 && flux[i] > mean * 1.25)
      onsets.push({ t: i * dt + N / 2 / sr, strength: flux[i] / med });
  }
  // Tempo: autocorrelation of the onset envelope between 70 and 180 BPM.
  const env = flux.map((v, i) => Math.max(0, v - (flux[i - 1] ?? v)));
  let best = { bpm: 0, score: -Infinity };
  for (let bpm = 70; bpm <= 180; bpm += 0.25) {
    const lag = 60 / bpm / dt;
    let score = 0;
    for (let i = 0; i + lag + 1 < env.length; i++) {
      const j = i + lag,
        j0 = Math.floor(j),
        fr = j - j0;
      score += env[i] * (env[j0] * (1 - fr) + env[j0 + 1] * fr);
    }
    if (score > best.score) best = { bpm, score };
  }
  return { onsets, bpm: best.bpm, dt, flux, rms };
}

/** Render the cut-to-picture mix: AAC 192 kbps, 48 kHz, −14 LUFS, true peak ≤ −1 dBTP. */
export function mix(outFile, { offset = TRACK_OFFSET, seconds = FILM_SECONDS } = {}) {
  const pre = `atrim=start=${offset}:duration=${seconds},asetpts=PTS-STARTPTS,afade=t=in:st=0:d=0.3,afade=t=out:st=${seconds - 2.5}:d=2.5,apad=whole_dur=${seconds + 0.25}`;
  // Pass 1 measures the cut; loudnorm reports on stderr.
  const r = spawnCapture(["-hide_banner", "-nostats", "-i", TRACK, "-af", `${pre},loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json`, "-f", "null", "-"]);
  const json = JSON.parse(r.slice(r.lastIndexOf("{"), r.lastIndexOf("}") + 1));
  const second = `${pre},loudnorm=I=-14:TP=-1.5:LRA=11:measured_I=${json.input_i}:measured_TP=${json.input_tp}:measured_LRA=${json.input_lra}:measured_thresh=${json.input_thresh}:offset=${json.target_offset}:linear=true:print_format=json,aresample=48000`;
  const r2 = spawnCapture(["-hide_banner", "-nostats", "-y", "-i", TRACK, "-af", second, "-ar", "48000", "-ac", "2", "-c:a", "aac", "-b:a", "192k", outFile]);
  const json2 = JSON.parse(r2.slice(r2.lastIndexOf("{"), r2.lastIndexOf("}") + 1));
  return { pass1: json, pass2: json2 };
}

/** Measure integrated loudness and true peak of a finished file. */
export function measure(file) {
  const r = spawnCapture(["-hide_banner", "-nostats", "-i", file, "-map", "0:a:0", "-af", "ebur128=peak=true", "-f", "null", "-"]);
  const I = /I:\s+(-?[\d.]+) LUFS/.exec(r.slice(r.lastIndexOf("Summary")));
  const TP = /Peak:\s+(-?[\d.]+) dBFS/.exec(r.slice(r.lastIndexOf("True peak")));
  return { integrated: I ? Number(I[1]) : null, truePeak: TP ? Number(TP[1]) : null };
}

import { spawnSync } from "node:child_process";
function spawnCapture(argv) {
  const r = spawnSync(ffmpegPath, argv, { encoding: "utf8", maxBuffer: 1 << 26 });
  if (r.status !== 0) throw new Error(r.stderr.slice(-2000));
  return r.stderr;
}

if (process.argv[1] && process.argv[1].endsWith("music.mjs")) {
  const a = args();
  const res = analyse(70);
  console.log("tempo", res.bpm, "BPM");
  const strong = res.onsets.filter((o) => o.strength > (Number(a.min) || 2.2));
  for (const o of strong) {
    const film = o.t - TRACK_OFFSET;
    if (film < -0.5 || film > 44.5) continue;
    console.log(`track ${o.t.toFixed(3)} s  film ${film.toFixed(3)} s  frame ${(film * 30).toFixed(1)}  strength ${o.strength.toFixed(2)}`);
  }
  // Loudness profile in 0.5 s windows (RMS dBFS) for the edit.
  const per = Math.round(0.5 / res.dt);
  const rows = [];
  for (let i = 0; i < res.rms.length; i += per) {
    const w = res.rms.slice(i, i + per);
    const v = Math.sqrt(w.reduce((a, b) => a + b * b, 0) / w.length);
    rows.push(`${(i * res.dt).toFixed(1)}:${(20 * Math.log10(v + 1e-9)).toFixed(1)}`);
  }
  writeFileSync(join(CACHE, "music", "profile.txt"), rows.join("\n"));
  console.log("profile written");
}
