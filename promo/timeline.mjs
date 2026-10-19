// Every keyframe of promo/SCRIPT.md in one place, shared by the DOM capture (Node) and the film
// player (browser). Times are in film frames at 30 fps; fractional frames are sub-samples.

export const FPS = 30;
export const FRAMES = 1410;
/**
 * The light/dark beat adds 90 frames to the DOM part. Every 3D shot keeps the script's numbering
 * ("script frames"): script frame = film frame − XR_SHIFT from the floating window on.
 */
export const XR_SHIFT = 90;

/* ------------------------------------------------------------------ easing ---- */
/** CSS cubic-bezier(x1, y1, x2, y2) as a function of progress u in [0, 1]. */
export function cubicBezier(x1, y1, x2, y2) {
  const cx = 3 * x1,
    bx = 3 * (x2 - x1) - cx,
    ax = 1 - cx - bx;
  const cy = 3 * y1,
    by = 3 * (y2 - y1) - cy,
    ay = 1 - cy - by;
  const sx = (t) => ((ax * t + bx) * t + cx) * t;
  const sy = (t) => ((ay * t + by) * t + cy) * t;
  const dx = (t) => (3 * ax * t + 2 * bx) * t + cx;
  return (u) => {
    if (u <= 0) return 0;
    if (u >= 1) return 1;
    let t = u;
    for (let i = 0; i < 8; i++) {
      const e = sx(t) - u;
      const d = dx(t);
      if (Math.abs(e) < 1e-7) break;
      if (Math.abs(d) < 1e-6) break;
      t -= e / d;
    }
    if (t < 0 || t > 1 || Math.abs(sx(t) - u) > 1e-5) {
      let lo = 0,
        hi = 1;
      t = u;
      for (let i = 0; i < 40; i++) {
        if (sx(t) < u) lo = t;
        else hi = t;
        t = (lo + hi) / 2;
      }
    }
    return sy(t);
  };
}
export const E_calm = cubicBezier(0.37, 0, 0.63, 1);
export const E_arrive = cubicBezier(0.16, 1, 0.3, 1);
export const E_move = cubicBezier(0.77, 0, 0.175, 1);
/** Minimum jerk (also smootherstep). */
export const MJ = (u) => {
  const x = clamp01(u);
  return x * x * x * (10 + x * (-15 + 6 * x));
};
export const smoothstep = (a, b, x) => {
  const u = clamp01((x - a) / (b - a));
  return u * u * (3 - 2 * u);
};
export const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
/** Progress of t through [a, b], clamped. */
export const seg = (t, a, b) => clamp01((t - a) / (b - a));
export const lerp = (a, b, u) => a + (b - a) * u;
export const DEG = Math.PI / 180;

/**
 * Fritsch-Carlson monotone cubic through (x, y) keys. Optional end slopes (0 = ease in / out),
 * so a dolly starts and lands without a velocity jump.
 */
export function monotoneCubic(xs, ys, startSlope, endSlope) {
  const n = xs.length;
  const d = [],
    m = new Array(n);
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
  m[0] = startSlope ?? d[0];
  m[n - 1] = endSlope ?? d[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) {
      m[i] = m[i + 1] = 0;
      continue;
    }
    const a = m[i] / d[i],
      b = m[i + 1] / d[i];
    const s = a * a + b * b;
    if (s > 9) {
      const tau = 3 / Math.sqrt(s);
      m[i] = tau * a * d[i];
      m[i + 1] = tau * b * d[i];
    }
  }
  return (x) => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let i = 0;
    while (x > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i];
    const t = (x - xs[i]) / h;
    const t2 = t * t,
      t3 = t2 * t;
    return (
      (2 * t3 - 3 * t2 + 1) * ys[i] +
      (t3 - 2 * t2 + t) * h * m[i] +
      (-2 * t3 + 3 * t2) * ys[i + 1] +
      (t3 - t2) * h * m[i + 1]
    );
  };
}

/** Piecewise ease between keys: [[frame, value], ...], each segment eased with `ease`. */
export function keyed(keys, ease = E_calm) {
  return (t) => {
    if (t <= keys[0][0]) return keys[0][1];
    for (let i = 0; i < keys.length - 1; i++) {
      const [f0, v0] = keys[i],
        [f1, v1] = keys[i + 1];
      if (t <= f1) return lerp(v0, v1, ease(seg(t, f0, f1)));
    }
    return keys[keys.length - 1][1];
  };
}

/** Shutter sub-sample offsets in frames (180° shutter = half a frame). */
export function shutterOffsets(n) {
  if (n <= 1) return [0];
  return Array.from({ length: n }, (_, i) => ((i + 0.5) / n - 0.5) / 2);
}

/* -------------------------------------------------------------- DOM part ---- */
export const DOM_FIRST = 129;
export const DOM_LAST = 629;
export const DOM_DISSOLVE = [129, 147];
export const WORDMARK_SHOW = 144;
export const LOCKUP_REMOVE = 147;
export const ARRIVAL_START = 150;
export const SCROLL_DOWN = [240, 306];
export const SCROLL_UP = [427, 469];
export const FOCUS_OPEN = 334; // mouse up and click on the chip
export const FOCUS_CLOSE = 421; // release on the dimmed overlay (Radix dismisses on the click)
// The light/dark beat: the theme toggle flips the overview to the day side on the music's drop,
// «Open in space» opens the preview in the light environment, «Dark environment» brings back
// the night on the next downbeat.
export const THEME_LIGHT = 480; // release on the theme toggle
export const SPATIAL_OPEN = 553; // release on «Open in space»
export const THEME_DARK = 600; // release on «Dark environment» in the preview toolbar
/** Held-frame dissolves after instant product state changes: [from held frame, to, length]. */
export const DOM_DISSOLVES = [
  { held: 333, start: 334, end: 340 },
  { held: 420, start: 421, end: 427 },
  { held: 479, start: 480, end: 495 }, // night to day: the app's 0.2 s cross-fade eased to 0.5 s
  { held: 552, start: 553, end: 559 },
  { held: 599, start: 600, end: 615 }, // day to night
];
/** CSS transitions born at a theme change run at this speed (0.2 s becomes 0.5 s). */
export const THEME_TRANSITION_SPEED = 0.4;
/** DOM sub-frame offsets in ms through the page clock (180° shutter, N = 4). */
export const DOM_SUB_MS = [-6, -2, 2, 6];
/** Frames whose DOM state moves fast enough to need temporal sub-frames. */
export const DOM_MOVING = [
  [150, 200], // arrival
  [240, 307], // scroll down
  [282, 341], // cursor to the chip, press, focus opens
  [334, 386], // focus bars grow
  [400, 428], // cursor to the overlay, close
  [427, 470], // scroll up
  [441, 497], // cursor to the theme toggle, night to day
  [528, 629], // cursor to «Open in space», preview cascade, «Dark environment», push in
];
export function domSubframeCount(k) {
  if (k === DOM_LAST) return 1; // the pane source frame is a single, exact image
  return DOM_MOVING.some(([a, b]) => k >= a && k <= b) ? 4 : 1;
}
/** Fake page-clock time (ms after T_start) of frame k and sub-frame offset. */
export const domClockMs = (k, subMs = 0) => Math.round((k * 100) / 3) + subMs;

/** Scroll position for film time t (frames) given the live maximum. */
export function scrollAt(t, max) {
  if (t < SCROLL_DOWN[0]) return 0;
  if (t <= SCROLL_DOWN[1]) return max * E_calm(seg(t, SCROLL_DOWN[0], SCROLL_DOWN[1]));
  if (t < SCROLL_UP[0]) return max;
  if (t <= SCROLL_UP[1]) return max * (1 - E_calm(seg(t, SCROLL_UP[0], SCROLL_UP[1])));
  return 0;
}

const quad = (p0, c, p1, u) => [
  (1 - u) * (1 - u) * p0[0] + 2 * (1 - u) * u * c[0] + u * u * p1[0],
  (1 - u) * (1 - u) * p0[1] + 2 * (1 - u) * u * c[1] + u * u * p1[1],
];
/**
 * Cursor in viewport CSS px for film time t. Live centres: `chip` (at the bottom scroll
 * position), `cta` and `toggle` (at the top), `dark` (the preview's «Dark environment»).
 */
export function cursorAt(t, chip, cta, toggle, dark) {
  const start = [1240, 700],
    overlay = [300, 900];
  let p;
  if (t < 282) p = start;
  else if (t <= 324) p = quad(start, [760, 860], chip, MJ(seg(t, 282, 324)));
  else if (t < 400) p = chip;
  else if (t <= 418) p = quad(chip, [(chip[0] + overlay[0]) / 2, (chip[1] + overlay[1]) / 2], overlay, MJ(seg(t, 400, 418)));
  else if (t < 441) p = overlay;
  else if (t <= 475) p = quad(overlay, [1250, 640], toggle, MJ(seg(t, 441, 475)));
  else if (t < 530) p = toggle;
  else if (t <= 547) p = quad(toggle, [(toggle[0] + cta[0]) / 2 + 30, (toggle[1] + cta[1]) / 2 + 20], cta, MJ(seg(t, 530, 547)));
  else if (t < 562) p = cta;
  else if (t <= 594) p = quad(cta, [1050, 330], dark, MJ(seg(t, 562, 594)));
  else p = dark;
  const opacity = t < 282 ? 0 : t < 291 ? seg(t, 282, 291) : t < 606 ? 1 : 1 - seg(t, 606, 615);
  let scale = 1;
  const press = (down, up) => {
    if (t >= down && t <= up) scale = 0.92;
    else if (t > up && t < up + 6) scale = lerp(0.92, 1, E_calm(seg(t, up, up + 6)));
  };
  press(332, 334);
  press(419, 421);
  press(478, 480);
  press(551, 553);
  press(598, 600);
  return { x: p[0], y: p[1], opacity, scale };
}
/** Mouse buttons by frame: [frame, "down" | "up"]. */
export const MOUSE_EVENTS = [
  [332, "down"],
  [334, "up"],
  [419, "down"],
  [421, "up"],
  [478, "down"],
  [480, "up"],
  [551, "down"],
  [553, "up"],
  [598, "down"],
  [600, "up"],
];

/** The DOM virtual camera V = (s, cx, cy) for film time t. */
export function vCameraAt(t) {
  const A = [1.0, 960, 540],
    B = [1.08, 889, 580],
    // As the cursor reaches the chip and presses, the view tilts up 40 px so the focus dialog's title is in frame
    // the moment it opens (the chip stays 44 px above the bottom edge).
    B2 = [1.08, 889, 540],
    C = [1.18, 955, 498],
    D = [1.0, 960, 540],
    // A slow push across the day-side overview and the light preview, then in on the 3D view.
    L = [1.03, 975, 545],
    E = [1.06, 955, 560];
  let v;
  if (t <= 150) v = A;
  else if (t <= 316) v = mix3(A, B, E_calm(seg(t, 150, 316)));
  else if (t < 334) v = mix3(B, B2, E_calm(seg(t, 316, 334)));
  else if (t <= 370) v = mix3(B2, C, E_calm(seg(t, 334, 370)));
  else if (t < 427) v = C;
  else if (t <= 469) v = mix3(C, D, E_calm(seg(t, 427, 469)));
  else if (t < 482) v = D;
  else if (t <= 560) v = mix3(D, L, E_calm(seg(t, 482, 560)));
  else if (t < 602) v = L;
  else v = mix3(L, E, E_calm(seg(t, 602, DOM_LAST + 1)));
  return clampV(v);
}
const mix3 = (a, b, u) => [lerp(a[0], b[0], u), lerp(a[1], b[1], u), lerp(a[2], b[2], u)];
function clampV([s, cx, cy]) {
  const hx = 960 / s,
    hy = 540 / s;
  return [s, Math.min(1920 - hx, Math.max(hx, cx)), Math.min(1080 - hy, Math.max(hy, cy))];
}

/* --------------------------------------------------------------- titles ---- */
export const TITLES = {
  T3: { uk: "Тепер у\u00a0Meta\u00a0Quest\u00a03S", en: "Now in Meta\u00a0Quest\u00a03S", in: [720, 738], out: [792, 804], anchor: "bottom-left" },
  T4: { uk: "Ті самі стенди — навколо вас", en: "The same stands, all around you", in: [852, 870], out: [936, 948], anchor: "top-left" },
  T5: { uk: "Наведіть промінь, натисніть курок", en: "Point the ray, pull the trigger", in: [1008, 1026], out: [1086, 1095], anchor: "top-left" },
};
export const END_CARD = {
  action: { uk: "Відкрийте в\u00a0Meta\u00a0Quest\u00a0Browser", en: "Open in Meta\u00a0Quest\u00a0Browser" },
  // A neutral, factual line (the owner asked not to show the address anywhere).
  line: { uk: "Платежі, каси й обладнання в\u00a0одному просторі", en: "Payments, cash desks and equipment in\u00a0one\u00a0space" },
  lockupIn: [1302, 1320],
  actionIn: [1311, 1329],
  lineIn: [1317, 1335],
};
/** Title visibility: opacity and rise (px) for film time t. */
export function titleState(t, title) {
  const [i0, i1] = title.in;
  const [o0, o1] = title.out;
  if (t < i0 || t >= o1) return { opacity: 0, rise: 10 };
  if (t < i1) {
    const u = E_arrive(seg(t, i0, i1));
    return { opacity: u, rise: 10 * (1 - u) };
  }
  if (t < o0) return { opacity: 1, rise: 0 };
  return { opacity: 1 - E_calm(seg(t, o0, o1)), rise: 0 };
}
