// HTML overlay above the canvas: the lockup (cold open and end card), titles T3-T5 and the
// end-card lines. Rasterised by Chrome at 2× like the product, so the lockup handover to the
// header wordmark is pixel-identical (promo/SCRIPT.md §6).
import privatbankLogo from "../../../src/assets/privatbank.svg";
import { E_arrive, E_move, END_CARD, TITLES, lerp, seg, titleState } from "../../timeline.mjs";

type WordmarkMeasure = {
  rect: { x: number; y: number; w: number; h: number; cx: number; cy: number };
  logo: { rect: { w: number; h: number }; filter: string };
  divider: { rect: { w: number; h: number }; opacity: string; backgroundColor: string };
  label: { text: string; fontFamily: string; fontSize: string; fontWeight: string; letterSpacing: string; color: string; top: string; position: string; lineHeight: string };
  style: { gap: string; color: string; fontFamily: string; fontSize: string; fontWeight: string; letterSpacing: string; minHeight: string; lineHeight: string };
};

const TEXT = "#f5f3f8";
/** Cold-open lockup centre: in the night sky above the limb of the app's long-lens backdrop. */
const LOCKUP_Y = 140;
const MUTED = "#c6c4ce";

function lockupElement(w: WordmarkMeasure) {
  const el = document.createElement("div");
  el.className = "film-lockup";
  // Same box, flex layout and computed styles as `.topbar .wordmark` in the dark theme.
  Object.assign(el.style, {
    position: "absolute",
    left: "0px",
    top: "0px",
    display: "flex",
    alignItems: "center",
    gap: w.style.gap,
    minHeight: w.style.minHeight,
    height: `${w.rect.h}px`,
    width: `${w.rect.w}px`,
    color: w.style.color,
    fontFamily: w.style.fontFamily,
    fontSize: w.style.fontSize,
    fontWeight: w.style.fontWeight,
    letterSpacing: w.style.letterSpacing,
    lineHeight: w.style.lineHeight,
    transformOrigin: "0 0",
    willChange: "auto",
    whiteSpace: "nowrap",
  } as Partial<CSSStyleDeclaration>);
  const img = document.createElement("img");
  img.src = privatbankLogo;
  img.alt = "";
  img.width = 142;
  img.height = 24;
  Object.assign(img.style, { display: "block", width: `${w.logo.rect.w}px`, height: "auto", filter: w.logo.filter });
  const divider = document.createElement("span");
  Object.assign(divider.style, {
    display: "block",
    width: `${w.divider.rect.w}px`,
    height: `${w.divider.rect.h}px`,
    background: "currentColor",
    opacity: w.divider.opacity,
  });
  const label = document.createElement("span");
  label.textContent = w.label.text;
  Object.assign(label.style, { position: w.label.position, top: w.label.top });
  el.append(img, divider, label);
  return el;
}

function titleElement(text: string, size: number, weight: number, family: string, color: string, extra: Partial<CSSStyleDeclaration> = {}) {
  const el = document.createElement("div");
  Object.assign(el.style, {
    position: "absolute",
    left: "0px",
    top: "0px",
    fontFamily: family,
    fontWeight: String(weight),
    fontSize: `${size}px`,
    lineHeight: "1",
    letterSpacing: "-0.025em",
    color,
    whiteSpace: "nowrap",
    opacity: "0",
    ...extra,
  } as Partial<CSSStyleDeclaration>);
  el.textContent = text;
  // A zero-height inline-block sits on the baseline: its offsetTop is the baseline position.
  const probe = document.createElement("span");
  Object.assign(probe.style, { display: "inline-block", width: "0px", height: "0px", verticalAlign: "baseline" });
  el.appendChild(probe);
  return { el, probe };
}

export class Overlay {
  root: HTMLElement;
  lockup: HTMLElement;
  endLockup: HTMLElement;
  wordmark: WordmarkMeasure;
  titles: { id: string; el: HTMLElement; baseline: number; x: number; anchorBaseline: number; spec: typeof TITLES.T3 }[] = [];
  action: { el: HTMLElement; baseline: number; width: number };
  line: { el: HTMLElement; baseline: number; width: number };
  locale: "uk" | "en";

  constructor(root: HTMLElement, wordmark: WordmarkMeasure, locale: "uk" | "en") {
    this.root = root;
    this.wordmark = wordmark;
    this.locale = locale;
    this.lockup = lockupElement(wordmark);
    this.endLockup = lockupElement(wordmark);
    root.append(this.lockup, this.endLockup);
    const display = '"Pryvat Sans Display", "Manrope Variable", sans-serif';
    for (const [id, spec] of Object.entries(TITLES)) {
      const { el, probe } = titleElement(spec[locale], 64, 500, display, TEXT);
      root.appendChild(el);
      const baseline = probe.offsetTop;
      const anchorBaseline = spec.anchor === "bottom-left" ? 968 : 112;
      this.titles.push({ id, el, baseline, x: 128, anchorBaseline, spec });
    }
    {
      const { el, probe } = titleElement(END_CARD.action[locale], 60, 500, display, TEXT);
      root.appendChild(el);
      this.action = { el, baseline: probe.offsetTop, width: el.getBoundingClientRect().width };
    }
    {
      // The neutral line under the action, in the style and position the address had.
      const { el, probe } = titleElement(END_CARD.line[locale], 48, 400, '"Pryvat Sans", "Inter Variable", sans-serif', MUTED, {
        letterSpacing: "0",
      } as Partial<CSSStyleDeclaration>);
      root.appendChild(el);
      this.line = { el, baseline: probe.offsetTop, width: el.getBoundingClientRect().width };
    }
    this.hideAll();
  }

  hideAll() {
    for (const el of this.root.children) (el as HTMLElement).style.opacity = "0";
  }

  /** Place a lockup with its box centre at (cx, cy) and scale s; exact layout when s = 1. */
  private placeLockup(el: HTMLElement, cx: number, cy: number, s: number, opacity: number, rise = 0) {
    const { w, h } = this.wordmark.rect;
    el.style.opacity = String(opacity);
    if (Math.abs(s - 1) < 1e-6 && Math.abs(cx - this.wordmark.rect.cx) < 1e-6 && Math.abs(cy - this.wordmark.rect.cy) < 1e-6 && rise === 0) {
      el.style.transform = "none";
      el.style.left = `${this.wordmark.rect.x}px`;
      el.style.top = `${this.wordmark.rect.y}px`;
      return;
    }
    el.style.left = "0px";
    el.style.top = "0px";
    el.style.transform = `translate(${cx - (s * w) / 2}px, ${cy - (s * h) / 2 + rise}px) scale(${s})`;
  }

  update(t: number) {
    // Cold-open lockup: enters at 2.4×, match-moves onto the header wordmark, handed over at f147.
    const L = this.lockup;
    if (t >= 54 && t < 147) {
      const wm = this.wordmark.rect;
      if (t < 114) {
        const u = E_arrive(seg(t, 54, 78));
        this.placeLockup(L, 960, LOCKUP_Y, 2.4, u, 10 * (1 - u));
      } else if (t < 144) {
        const u = E_move(seg(t, 114, 144));
        this.placeLockup(L, lerp(960, wm.cx, u), lerp(LOCKUP_Y, wm.cy, u), lerp(2.4, 1, u), 1);
      } else this.placeLockup(L, wm.cx, wm.cy, 1, 1);
    } else L.style.opacity = "0";

    for (const tt of this.titles) {
      const s = titleState(t, tt.spec);
      tt.el.style.opacity = String(s.opacity);
      tt.el.style.transform = `translate(${tt.x}px, ${tt.anchorBaseline - tt.baseline + s.rise}px)`;
    }

    // End card.
    const e = END_CARD;
    const enter = (a: number[]) => {
      const u = E_arrive(seg(t, a[0], a[1]));
      return { o: t < a[0] ? 0 : u, rise: 10 * (1 - u) };
    };
    const lk = enter(e.lockupIn);
    if (t >= e.lockupIn[0]) this.placeLockup(this.endLockup, 960, 330, 2.0, lk.o, lk.rise);
    else this.endLockup.style.opacity = "0";
    const ac = enter(e.actionIn);
    this.action.el.style.opacity = String(ac.o);
    this.action.el.style.transform = `translate(${960 - this.action.width / 2}px, ${482 - this.action.baseline + ac.rise}px)`;
    const ln = enter(e.lineIn);
    this.line.el.style.opacity = String(ln.o);
    this.line.el.style.transform = `translate(${960 - this.line.width / 2}px, ${552 - this.line.baseline + ln.rise}px)`;
  }
}
