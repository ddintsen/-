import { CanvasTexture, SRGBColorSpace } from "three";
import {
  type DashboardModel,
  colors,
  seriesColors,
  comparisonRows,
} from "../api/model";
import {
  formatNumber,
  formatPercent,
  gaugeTone,
  downtimeLabel,
  DOWNTIME_LIMIT,
  meterMaximum,
} from "../api/format";
import { t } from "../i18n";
import { FOCUS_ROWS, focusTextureHeight } from "./layout";

/*
 * XR textures follow the DOM system: a stand is one glass surface, dashboards are tonal
 * sections on it, type is Pryvat Sans on one scale (sized for reading at 1.5-1.85 m),
 * legends are dots with neutral text, colour lives in marks and key figures only.
 * Every colour comes from DESIGN.md tokens; alpha is the only thing added here.
 */
const TEXT_FONT = '"Pryvat Sans", "Inter Variable", sans-serif';
const DISPLAY_FONT =
  '"Pryvat Sans Display", "Pryvat Sans", "Manrope Variable", sans-serif';

type Tokens = Record<string, string>;
const palette = colors as unknown as Tokens;

function alpha(color: string, a: number) {
  const rgba = color.match(/rgba?\(([^)]+)\)/);
  if (rgba) {
    const [r, g, b] = rgba[1].split(",").map((v) => parseFloat(v));
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  }
  const hex = color.replace("#", "");
  const full =
    hex.length === 3
      ? hex
          .split("")
          .map((c) => c + c)
          .join("")
      : hex.slice(0, 6);
  const n = parseInt(full, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

export type XrPalette = ReturnType<typeof xrPalette>;
/** Theme-resolved colours for canvas textures, mirroring the DOM's [data-theme] mapping. */
export function xrPalette(dark: boolean) {
  const pick = (key: string) =>
    (!dark && palette[`light-${key}`]) || palette[key];
  const tone = (color: string) => {
    if (dark) return color;
    const key = Object.entries(palette).find(([, v]) => v === color)?.[0];
    return (key && palette[`light-${key}`]) || color;
  };
  const text = pick("text");
  return {
    dark,
    text,
    muted: pick("muted"),
    tone,
    track: alpha(text, dark ? 0.12 : 0.1),
    grid: alpha(text, dark ? 0.08 : 0.09),
    section: dark
      ? alpha(palette.text, 0.06)
      : alpha(palette["light-surface"], 0.66),
    sectionRim: dark
      ? alpha(palette.text, 0.1)
      : alpha(palette["light-surface"], 1),
    standTop: dark
      ? alpha(palette.elevated, 0.8)
      : alpha(palette["light-surface"], 0.88),
    standBottom: dark
      ? alpha(palette["space-night"], 0.88)
      : alpha(palette["light-background"], 0.82),
    standRim: dark
      ? alpha(palette.text, 0.2)
      : alpha(palette["light-surface"], 1),
    control: dark
      ? alpha(palette.elevated, 0.95)
      : alpha(palette["light-surface"], 0.94),
    selected: dark ? palette.primary : palette["light-primary"],
    selectedText: dark ? palette["on-primary"] : palette["light-surface"],
    onBar: palette["on-primary"],
  };
}

type Ctx = CanvasRenderingContext2D;
type TextOptions = {
  size?: number;
  weight?: number;
  color?: string;
  align?: CanvasTextAlign;
  max?: number;
  display?: boolean;
};

function write(ctx: Ctx, value: string, x: number, y: number, o: TextOptions) {
  const size = o.size ?? 28;
  // Textures are minified in the browser preview and sit 1.5-1.85 m away in the headset:
  // one weight step heavier than the DOM keeps strokes from dissolving.
  const weight = Math.min(700, (o.weight ?? 500) + 100);
  ctx.font = `${weight} ${size}px ${o.display ? DISPLAY_FONT : TEXT_FONT}`;
  ctx.fillStyle = o.color ?? "#000";
  ctx.textAlign = o.align ?? "left";
  ctx.textBaseline = "alphabetic";
  if (o.max) ctx.fillText(value, x, y, o.max);
  else ctx.fillText(value, x, y);
}

function roundRect(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/** A tonal section with a hairline of light on its upper edge. */
function section(
  ctx: Ctx,
  pal: XrPalette,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  roundRect(ctx, x, y, w, h, r);
  ctx.fillStyle = pal.section;
  ctx.fill();
  ctx.save();
  roundRect(ctx, x + 1, y + 1, w - 2, h - 2, r);
  ctx.clip();
  const rim = ctx.createLinearGradient(0, y, 0, y + 6);
  rim.addColorStop(0, pal.sectionRim);
  // Fade to the same colour: canvas gradients interpolate unpremultiplied, so a fade to
  // transparent black would draw a grey hairline.
  rim.addColorStop(1, alpha(pal.sectionRim, 0));
  ctx.fillStyle = rim;
  ctx.fillRect(x, y, w, 6);
  ctx.restore();
}

function texture(canvas: HTMLCanvasElement, anisotropy = 8) {
  const result = new CanvasTexture(canvas);
  result.colorSpace = SRGBColorSpace;
  result.anisotropy = anisotropy;
  return result;
}

/** Truthful meter: actual length on its own scale, with the plan or SLA marker. */
function meter(
  ctx: Ctx,
  pal: XrPalette,
  percent: number,
  mode: "plan" | "downtime",
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const max = meterMaximum(percent, mode),
    target = mode === "plan" ? 100 : DOWNTIME_LIMIT;
  roundRect(ctx, x, y, width, height, height / 2);
  ctx.fillStyle = pal.track;
  ctx.fill();
  const fill = Math.max(height, (width * Math.min(percent, max)) / max);
  roundRect(ctx, x, y, fill, height, height / 2);
  ctx.fillStyle = pal.tone(colors[gaugeTone(percent, mode)]);
  ctx.fill();
  ctx.fillStyle = pal.text;
  roundRect(
    ctx,
    x + (width * target) / max - 2,
    y - height * 0.6,
    4,
    height * 2.2,
    2,
  );
  ctx.fill();
}

function legendDot(ctx: Ctx, x: number, y: number, color: string, r = 8) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
}

/** Line series with soft area under the first series and calm round joins. */
function lineChart(
  ctx: Ctx,
  pal: XrPalette,
  m: DashboardModel,
  x: number,
  y: number,
  w: number,
  h: number,
  labelSize: number,
) {
  if (!m.days.length || !m.series.length) {
    write(ctx, t("Нет данных за этот период"), x + w / 2, y + h / 2, {
      size: labelSize + 4,
      color: pal.muted,
      align: "center",
    });
    return;
  }
  const max = Math.max(1, ...m.series.flatMap((s) => s.points)) * 1.12;
  for (const f of [0, 0.5, 1]) {
    const gy = y + h - f * h;
    ctx.strokeStyle = pal.grid;
    ctx.lineWidth = 2;
    ctx.setLineDash(f === 0 ? [] : [6, 10]);
    ctx.beginPath();
    ctx.moveTo(x, gy);
    ctx.lineTo(x + w, gy);
    ctx.stroke();
    ctx.setLineDash([]);
    write(ctx, formatNumber(Math.round(max * f), true), x - 18, gy + 9, {
      size: labelSize,
      color: pal.muted,
      align: "right",
      max: 120,
    });
  }
  const px = (i: number, n: number) => x + (i / Math.max(1, n - 1)) * w;
  m.series.forEach((s, index) => {
    const color = pal.tone(s.color);
    const pts = s.points.map((v, i) => [
      px(i, s.points.length),
      y + h - (v / max) * h,
    ]);
    if (index === 0 && m.series.length === 1) {
      const area = ctx.createLinearGradient(0, y, 0, y + h);
      area.addColorStop(0, alpha(color, 0.28));
      area.addColorStop(1, alpha(color, 0));
      ctx.beginPath();
      pts.forEach(([a, b], i) => (i ? ctx.lineTo(a, b) : ctx.moveTo(a, b)));
      ctx.lineTo(pts[pts.length - 1][0], y + h);
      ctx.lineTo(pts[0][0], y + h);
      ctx.closePath();
      ctx.fillStyle = area;
      ctx.fill();
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = 5;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.beginPath();
    pts.forEach(([a, b], i) => (i ? ctx.lineTo(a, b) : ctx.moveTo(a, b)));
    ctx.stroke();
    for (const [a, b] of pts) legendDot(ctx, a, b, color, 6);
  });
  const step = Math.max(1, Math.ceil(m.days.length / 6));
  m.days.forEach((d, i) => {
    if (i % step === 0 || i === m.days.length - 1)
      write(ctx, d, px(i, m.days.length), y + h + labelSize + 16, {
        size: labelSize,
        color: pal.muted,
        align: "center",
        max: 80,
      });
  });
}

function legend(
  ctx: Ctx,
  pal: XrPalette,
  items: { label: string; color: string }[],
  x: number,
  y: number,
  size: number,
) {
  let cursor = x;
  for (const item of items) {
    legendDot(ctx, cursor + 8, y - size * 0.33, pal.tone(item.color));
    write(ctx, t(item.label), cursor + 26, y, {
      size,
      color: pal.muted,
      max: 300,
    });
    ctx.font = `500 ${size}px ${TEXT_FONT}`;
    cursor += 26 + ctx.measureText(t(item.label)).width + 36;
  }
}

/** Plan meter row: label, percent, meter, fact and reference. */
function gaugeRow(
  ctx: Ctx,
  pal: XrPalette,
  g: DashboardModel["gauges"][number],
  x: number,
  y: number,
  w: number,
  compact: boolean,
  scale = 1,
) {
  const tone = pal.tone(colors[gaugeTone(g.percent, g.mode)]);
  write(ctx, t(g.label), x, y, {
    size: 30 * scale,
    color: pal.text,
    max: w - 200 * scale,
  });
  write(ctx, formatPercent(g.percent), x + w, y + 2 * scale, {
    size: 40 * scale,
    weight: 600,
    color: tone,
    align: "right",
    max: 200 * scale,
  });
  meter(ctx, pal, g.percent, g.mode, x, y + 26 * scale, w, 14 * scale);
  const detailY = y + 84 * scale;
  if (g.value !== undefined) {
    write(ctx, t("Факт"), x, detailY, { size: 26 * scale, color: pal.muted });
    ctx.font = `500 ${26 * scale}px ${TEXT_FONT}`;
    const factX = x + ctx.measureText(t("Факт")).width + 14 * scale;
    write(
      ctx,
      `${formatNumber(g.value, compact)} ${g.unit ?? t("шт.")}`,
      factX,
      detailY,
      { size: 32 * scale, weight: 600, color: pal.text, max: w * 0.6 },
    );
  }
  if (g.value !== undefined)
    write(
      ctx,
      g.mode === "plan" ? t("План 100%") : downtimeLabel(g.percent),
      x + w,
      detailY,
      {
        size: 26 * scale,
        color: pal.muted,
        align: "right",
      },
    );
  else
    write(
      ctx,
      g.mode === "plan" ? t("План 100%") : downtimeLabel(g.percent),
      x,
      detailY,
      {
        size: 26 * scale,
        color: pal.muted,
      },
    );
}

/** Paired channel bars: one label row per pair, current value above the reference. */
function channelBars(
  ctx: Ctx,
  pal: XrPalette,
  m: DashboardModel,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const max = Math.max(1, ...m.bars.flatMap((b) => b.values)) * 1.3;
  const group = w / Math.max(1, m.bars.length);
  const bw = Math.min(40, group * 0.26),
    gap = Math.min(14, group * 0.08);
  const purple = pal.tone(colors.purple);
  ctx.strokeStyle = pal.grid;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, y + h);
  ctx.lineTo(x + w, y + h);
  ctx.stroke();
  m.bars.forEach((b, i) => {
    const cx = x + i * group + group / 2;
    const top = Math.max(...b.values);
    b.values.forEach((v, j) => {
      const bx = cx + (j === 0 ? -bw - gap / 2 : gap / 2),
        bh = Math.max(6, (v / max) * h);
      const fill = ctx.createLinearGradient(0, y + h - bh, 0, y + h);
      fill.addColorStop(0, alpha(purple, j === 0 ? 0.4 : 1));
      fill.addColorStop(1, alpha(purple, j === 0 ? 0.22 : 0.55));
      roundRect(ctx, bx, y + h - bh, bw, bh, Math.min(10, bw / 2));
      ctx.fillStyle = fill;
      ctx.fill();
    });
    const labelY = y + h - (top / max) * h - 16;
    const [jan, cur] = b.values;
    if (cur !== undefined)
      write(ctx, formatNumber(cur), cx, labelY - 34, {
        size: 34,
        weight: 600,
        color: pal.text,
        align: "center",
        max: group,
      });
    write(ctx, formatNumber(jan), cx, labelY, {
      size: 26,
      color: pal.muted,
      align: "center",
      max: group,
    });
    const words = t(b.label === "Автоплат." ? "Автоплатежи" : b.label)
      .replace(/^Авто(?=плат)/, "Авто ")
      .replace(/-/g, "- ")
      .split(" ");
    words.forEach((word, k) =>
      write(ctx, word, cx, y + h + 44 + k * 32, {
        size: 28,
        color: pal.muted,
        align: "center",
        max: group - 6,
      }),
    );
  });
}

/** Monthly plan: three vertical bars on a 100% line, the percent inside each bar. */
function planBars(
  ctx: Ctx,
  pal: XrPalette,
  m: DashboardModel,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const max = Math.max(
    115,
    ...m.bars.flatMap((b) => b.values).map((v) => v * 1.14),
  );
  const base = y + h,
    group = w / Math.max(1, m.bars.length),
    targetY = base - (100 / max) * h;
  ctx.save();
  ctx.setLineDash([12, 10]);
  ctx.strokeStyle = pal.muted;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, targetY);
  ctx.lineTo(x + w, targetY);
  ctx.stroke();
  ctx.restore();
  write(ctx, t("План 100%"), x + w, targetY - 14, {
    size: 26,
    color: pal.muted,
    align: "right",
  });
  m.bars.forEach((bar, i) => {
    const bh = (bar.values[0] / max) * h,
      cx = x + (i + 0.5) * group,
      bw = Math.min(150, group * 0.66);
    const color = pal.tone(seriesColors[i % seriesColors.length]);
    const fill = ctx.createLinearGradient(0, base - bh, 0, base);
    fill.addColorStop(0, color);
    fill.addColorStop(1, alpha(color, 0.45));
    roundRect(ctx, cx - bw / 2, base - bh, bw, bh, 18);
    ctx.fillStyle = fill;
    ctx.fill();
    write(ctx, formatPercent(bar.values[0]), cx, base - bh + 50, {
      size: 34,
      weight: 600,
      color: pal.onBar,
      align: "center",
      max: bw - 12,
    });
    write(ctx, i === 0 ? t("Всего") : bar.label, cx, base + 46, {
      size: 28,
      color: pal.muted,
      align: "center",
      max: group - 8,
    });
  });
}

function donut(
  ctx: Ctx,
  pal: XrPalette,
  m: DashboardModel,
  cx: number,
  cy: number,
  r: number,
  center: string,
  caption: string,
) {
  const total = m.slices.reduce((a, b) => a + b.value, 0);
  ctx.lineWidth = r * 0.2;
  ctx.lineCap = "butt";
  ctx.strokeStyle = pal.track;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  let cursor = -Math.PI / 2;
  m.slices.forEach((s) => {
    const share = total ? s.value / total : 0;
    const end = cursor + share * Math.PI * 2;
    const color = s.color === colors.border ? pal.track : pal.tone(s.color);
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.arc(cx, cy, r, cursor + 0.012, Math.max(cursor + 0.012, end - 0.012));
    ctx.stroke();
    cursor = end;
  });
  write(ctx, center, cx, cy + r * 0.16, {
    size: Math.round(r * 0.52),
    weight: 500,
    display: true,
    color: pal.text,
    align: "center",
    max: r * 1.5,
  });
  write(ctx, t(caption), cx, cy + r * 0.5, {
    size: Math.max(24, Math.round(r * 0.2)),
    color: pal.muted,
    align: "center",
    max: r * 1.5,
  });
}

function sparkline(
  ctx: Ctx,
  points: number[],
  color: string,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  if (points.length < 2) return;
  const min = Math.min(...points),
    range = Math.max(...points) - min || 1;
  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  points.forEach((v, j) => {
    const px = x + (j / (points.length - 1)) * w,
      py = y + h - ((v - min) / range) * h;
    if (j) ctx.lineTo(px, py);
    else ctx.moveTo(px, py);
  });
  ctx.stroke();
}

/**
 * Body of a dashboard inside a 1280 x (800 + extra) area; shared by overview panels and the
 * focus surface. `extra` lets a taller focus section grow the chart instead of leaving air.
 */
function drawBody(
  ctx: Ctx,
  pal: XrPalette,
  m: DashboardModel,
  compact: boolean,
  extra = 0,
) {
  if (m.kind === "channels") {
    legend(
      ctx,
      pal,
      [
        { label: "Январь", color: alpha(pal.tone(colors.purple), 0.5) },
        { label: "Отчётный месяц", color: colors.purple },
      ],
      56,
      196,
      26,
    );
    const barsH = 300 + extra * 0.75;
    if (m.bars.length) channelBars(ctx, pal, m, 56, 300, 800, barsH);
    else
      write(ctx, t("Нет данных по каналам"), 56, 420, {
        size: 32,
        color: pal.muted,
      });
    const r = 130 + Math.min(60, extra * 0.12),
      cy = 440 + extra * 0.4;
    donut(ctx, pal, m, 1060, cy, r, formatPercent(m.share ?? 0), "доля в ДБО");
    write(
      ctx,
      `${t("В отделениях")} ${formatPercent(100 - (m.share ?? 0))}`,
      1060,
      cy + r + 70,
      { size: 26, color: pal.muted, align: "center", max: 360 },
    );
    return;
  }
  if (m.kind === "monthly") {
    planBars(ctx, pal, m, 56, 260, 560, 390 + extra * 0.85);
    const step = 172 + (extra * 0.85) / 3;
    m.metrics.forEach((metric, i) => {
      const y = 236 + i * step;
      write(ctx, t(metric.label), 690, y, {
        size: 26,
        color: pal.muted,
        max: 360,
      });
      write(
        ctx,
        `${formatNumber(metric.value, compact)} ${metric.unit ?? ""}`,
        690,
        y + 60,
        { size: 56, weight: 500, display: true, color: pal.text, max: 330 },
      );
      const color = pal.tone(metric.color);
      write(ctx, metric.delta ?? "", 1224, y, {
        size: 26,
        weight: 600,
        color,
        align: "right",
        max: 160,
      });
      if (metric.spark)
        sparkline(ctx, metric.spark, color, 1044, y + 18, 180, 44);
    });
    return;
  }
  if (m.kind === "gauges") {
    const n = Math.max(1, m.gauges.length),
      top = 236 + extra * 0.1,
      step = Math.min(190 + extra / n, (720 + extra - top) / n + 20),
      scale = 1 + Math.min(0.2, extra / 1500);
    m.gauges.forEach((g, i) =>
      gaugeRow(ctx, pal, g, 56, top + i * step, 1168, compact, scale),
    );
    return;
  }
  if (m.kind === "cash") {
    const total = m.slices.reduce((a, b) => a + b.value, 0);
    donut(
      ctx,
      pal,
      m,
      230,
      420 + extra * 0.35,
      150 + Math.min(50, extra * 0.1),
      formatNumber(total, true),
      "операций",
    );
    const step = 78 + extra * 0.12;
    m.slices.forEach((s, i) => {
      const y = 260 + i * step;
      legendDot(ctx, 470, y - 10, pal.tone(s.color), 9);
      write(ctx, t(s.label), 494, y, { size: 30, color: pal.text, max: 380 });
      write(ctx, formatNumber(s.value, compact), 1224, y, {
        size: 32,
        weight: 600,
        color: pal.text,
        align: "right",
        max: 260,
      });
    });
    gaugeRow(ctx, pal, m.gauges[0], 470, 620 + extra * 0.85, 754, compact);
    return;
  }
  if (m.kind === "staff") {
    const grow = extra * 0.8;
    lineChart(ctx, pal, m, 150, 220, 640, 330 + grow, 24);
    legend(ctx, pal, m.series, 150, 640 + grow, 24);
    const vacancies = m.metrics[0];
    write(ctx, String(vacancies.value), 870, 360 + extra * 0.35, {
      size: 120,
      weight: 500,
      display: true,
      color: pal.tone(vacancies.color),
    });
    write(ctx, t("Открытые вакансии"), 874, 410 + extra * 0.35, {
      size: 28,
      color: pal.muted,
      max: 360,
    });
    gaugeRow(ctx, pal, m.gauges[0], 870, 560 + grow, 354, compact, 0.9);
    return;
  }
  // Equipment: working devices over the month, downtime against the SLA marker.
  const grow = extra * 0.7;
  lineChart(ctx, pal, m, 150, 200, 1070, 250 + grow, 24);
  legend(ctx, pal, m.series, 150, 530 + grow, 24);
  write(
    ctx,
    `${t("Простой")} · SLA ${formatPercent(DOWNTIME_LIMIT)}`,
    56,
    610 + grow,
    { size: 26, color: pal.muted },
  );
  const n = Math.max(1, m.gauges.length),
    colW = (1168 - (n - 1) * 48) / n,
    scale = 0.85 + Math.min(0.2, extra / 1500);
  m.gauges.forEach((g, i) =>
    gaugeRow(
      ctx,
      pal,
      g,
      56 + i * (colW + 48),
      668 + grow,
      colW,
      compact,
      scale,
    ),
  );
}

function header(ctx: Ctx, pal: XrPalette, m: DashboardModel, scale = 1) {
  write(ctx, t(m.title), 56 * scale, 92 * scale, {
    size: 44 * scale,
    weight: 600,
    display: true,
    color: pal.text,
    max: 1100 * scale,
  });
  if (m.subtitle)
    write(ctx, t(m.subtitle), 56 * scale, 138 * scale, {
      size: 28 * scale,
      color: pal.muted,
      max: 1100 * scale,
    });
}

/** @dashboard Д1–Д10. Rasterize the same data model into the XR framebuffer, with Cyrillic fonts. */
export function drawPanel(
  m: DashboardModel,
  compact: boolean,
  dark = true,
): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 1280;
  canvas.height = 800;
  const ctx = canvas.getContext("2d")!;
  const pal = xrPalette(dark);
  section(ctx, pal, 4, 4, 1272, 792, 48);
  header(ctx, pal, m);
  drawBody(ctx, pal, m, compact);
  return texture(canvas);
}

/** Wide bottom equipment/cash panels fill the stand without distorting their type. */
export function drawOverviewPanel(
  m: DashboardModel,
  wide = false,
  dark = true,
): CanvasTexture {
  if (!wide) return drawPanel(m, true, dark);
  const c = document.createElement("canvas");
  c.width = 1280;
  c.height = 400;
  const ctx = c.getContext("2d")!;
  const pal = xrPalette(dark);
  section(ctx, pal, 3, 3, 1274, 394, 40);
  write(ctx, t(m.title), 44, 66, {
    size: 40,
    weight: 600,
    display: true,
    color: pal.text,
    max: 700,
  });
  if (m.subtitle)
    write(ctx, t(m.subtitle), 44, 106, {
      size: 26,
      color: pal.muted,
      max: 700,
    });
  if (m.kind === "equipment") {
    lineChart(ctx, pal, m, 120, 150, 560, 150, 22);
    legend(ctx, pal, m.series, 120, 372, 22);
    write(
      ctx,
      `${t("Простой")} · SLA ${formatPercent(DOWNTIME_LIMIT)}`,
      790,
      66,
      {
        size: 26,
        color: pal.muted,
        max: 440,
      },
    );
    // The status sits beside its label: under the meter it read as the next row's caption.
    m.gauges.forEach((g, i) => {
      const y = 134 + i * 88;
      const tone = pal.tone(colors[gaugeTone(g.percent, g.mode)]);
      write(ctx, t(g.label), 790, y, { size: 28, color: pal.text, max: 150 });
      write(ctx, downtimeLabel(g.percent), 1124, y, {
        size: 24,
        color: pal.muted,
        align: "right",
        max: 190,
      });
      write(ctx, formatPercent(g.percent), 1236, y, {
        size: 34,
        weight: 600,
        color: tone,
        align: "right",
        max: 100,
      });
      meter(ctx, pal, g.percent, g.mode, 790, y + 20, 446, 12);
    });
  } else if (m.kind === "cash") {
    const total = m.slices.reduce((n, s) => n + s.value, 0);
    write(ctx, formatNumber(total, true), 44, 214, {
      size: 92,
      weight: 500,
      display: true,
      color: pal.text,
      max: 440,
    });
    write(ctx, t("операций"), 48, 256, { size: 28, color: pal.muted });
    gaugeRow(ctx, pal, m.gauges[0], 44, 312, 420, true, 0.8);
    m.slices.forEach((slice, index) => {
      const y = 92 + index * 76;
      legendDot(ctx, 560, y - 10, pal.tone(slice.color), 9);
      write(ctx, t(slice.label), 584, y, {
        size: 30,
        color: pal.text,
        max: 400,
      });
      write(ctx, formatNumber(slice.value, true), 1236, y, {
        size: 32,
        weight: 600,
        color: pal.text,
        align: "right",
        max: 240,
      });
    });
  } else {
    drawBody(ctx, pal, m, true);
  }
  return texture(c);
}

/** @dashboard Д1–Д10. The stand: one glass surface carrying its subject heading. */
export function drawWing(
  title: string,
  aspect: number,
  dark = true,
  aside?: string,
): CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 1280;
  c.height = Math.round(c.width / aspect);
  const ctx = c.getContext("2d")!;
  const pal = xrPalette(dark);
  const fill = ctx.createLinearGradient(0, 0, 0, c.height);
  fill.addColorStop(0, pal.standTop);
  fill.addColorStop(1, pal.standBottom);
  roundRect(ctx, 3, 3, c.width - 6, c.height - 6, 64);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.save();
  roundRect(ctx, 4, 4, c.width - 8, c.height - 8, 64);
  ctx.clip();
  const rim = ctx.createLinearGradient(0, 0, 0, 10);
  rim.addColorStop(0, pal.standRim);
  rim.addColorStop(1, alpha(pal.standRim, 0));
  ctx.fillStyle = rim;
  ctx.fillRect(0, 0, c.width, 10);
  ctx.restore();
  write(ctx, t(title), 64, 96, {
    size: 56,
    weight: 600,
    display: true,
    color: pal.text,
    max: aside ? c.width - 520 : c.width - 128,
  });
  if (aside)
    write(ctx, aside, c.width - 64, 94, {
      size: 32,
      color: pal.muted,
      align: "right",
      max: 380,
    });
  return texture(c, 4);
}

/** Buttons are pills in the control fill; a non-interactive label is a tinted state notice. */
export function drawLabel(
  label: string,
  aspect = 6.4,
  selected = false,
  dark = true,
  notice = false,
): CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 1024;
  c.height = Math.round(c.width / aspect);
  const ctx = c.getContext("2d")!;
  const pal = xrPalette(dark);
  roundRect(ctx, 2, 2, 1020, c.height - 4, c.height / 2 - 2);
  ctx.fillStyle = notice
    ? alpha(pal.tone(colors.warning), dark ? 0.24 : 0.3)
    : selected
      ? pal.selected
      : pal.control;
  ctx.fill();
  ctx.font = `600 ${Math.round(c.height * (notice ? 0.4 : 0.32))}px ${TEXT_FONT}`;
  ctx.fillStyle = selected && !notice ? pal.selectedText : pal.text;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(t(label), 512, c.height / 2, 930);
  return texture(c, 4);
}

/** A chart and a dense exact-value table share one focus surface. Long API series scroll by row. */
export function drawFocusPanel(
  model: DashboardModel,
  compact: boolean,
  offset = 0,
  dark = true,
  period = "",
): CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 2048;
  c.height = focusTextureHeight(model.facts.length);
  const ctx = c.getContext("2d")!;
  const pal = xrPalette(dark);
  const fill = ctx.createLinearGradient(0, 0, 0, c.height);
  fill.addColorStop(0, pal.standTop);
  fill.addColorStop(1, pal.standBottom);
  roundRect(ctx, 3, 3, c.width - 6, c.height - 6, 56);
  ctx.fillStyle = fill;
  ctx.fill();
  const text = (
    value: string,
    x: number,
    y: number,
    size: number,
    color = pal.text,
    align: CanvasTextAlign = "left",
    max = 1900,
    weight = 500,
  ) => write(ctx, t(value), x, y, { size, color, align, max, weight });
  write(ctx, t(model.title), 64, 96, {
    size: 60,
    weight: 600,
    display: true,
    color: pal.text,
    max: 1200,
  });
  if (model.subtitle) text(model.subtitle, 64, 146, 32, pal.muted);
  if (period) text(period, c.width - 64, 96, 34, pal.muted, "right", 420);
  // The chart is the overview body, grown to fill its section instead of floating in it.
  const chartH = c.height - 232,
    scale = 990 / 1280,
    cropH = (chartH - 40) / scale,
    extra = Math.max(0, cropH - 620);
  const chart = document.createElement("canvas");
  chart.width = 1280;
  chart.height = Math.ceil(800 + extra);
  const chartCtx = chart.getContext("2d")!;
  drawBody(chartCtx, pal, model, compact, extra);
  section(ctx, pal, 48, 184, 1010, chartH, 40);
  ctx.drawImage(chart, 0, 160, 1280, cropH, 58, 204, 990, cropH * scale);
  const tableX = 1092,
    tableW = c.width - tableX - 48;
  section(ctx, pal, tableX, 184, tableW, chartH, 40);
  text("Точные значения", tableX + 36, 252, 36, pal.text, "left", 600, 600);
  const facts = comparisonRows(model);
  const start = Math.min(
    Math.max(0, offset),
    Math.max(0, facts.length - FOCUS_ROWS),
  );
  const rows = facts.slice(start, start + FOCUS_ROWS),
    step = Math.min(84, (c.height - 400) / Math.max(1, rows.length));
  // A short table reads at a larger size instead of floating in its section.
  const roomy = step >= 76,
    rowSize = roomy ? 28 : 25,
    smallSize = roomy ? 26 : 23,
    headSize = 24;
  // Columns are measured from their real content, so no header or status is squeezed.
  const measure = (value: string, size: number, weight: number) => {
    ctx.font = `${Math.min(700, weight + 100)} ${size}px ${TEXT_FONT}`;
    return ctx.measureText(t(value)).width;
  };
  const widest = (values: string[], size: number, weight: number) =>
    Math.max(0, ...values.map((value) => measure(value, size, weight)));
  const gap = 28,
    inner = tableW - 72;
  const factW = Math.max(
      widest(
        rows.map((r) => r.actual),
        rowSize,
        600,
      ),
      measure("Факт", headSize, 500),
    ),
    refW = Math.max(
      widest(
        rows.map((r) => r.reference),
        smallSize,
        500,
      ),
      measure("План / Порог", headSize, 500),
    ),
    statusW = Math.max(
      widest(
        rows.map((r) => r.status),
        smallSize,
        500,
      ),
      measure("Выполнение / Статус", headSize, 500),
    );
  let labelW = inner - (factW + refW + statusW + gap * 3);
  let refMax = refW,
    statusMax = statusW;
  if (labelW < 250) {
    // Too narrow: the reference and status columns give up width evenly.
    const short = 250 - labelW;
    refMax = Math.max(110, refW - short / 2);
    statusMax = Math.max(130, statusW - short / 2);
    labelW = inner - (factW + refMax + statusMax + gap * 3);
  }
  const labelX = tableX + 36,
    factX = labelX + labelW + gap + factW,
    refX = factX + gap,
    statusX = tableX + tableW - 36;
  text("Показатель", labelX, 304, headSize, pal.muted, "left", labelW);
  text("Факт", factX, 304, headSize, pal.muted, "right", factW);
  text("План / Порог", refX, 304, headSize, pal.muted, "left", refMax);
  text(
    "Выполнение / Статус",
    statusX,
    304,
    headSize,
    pal.muted,
    "right",
    statusMax,
  );
  rows.forEach(({ label, actual, reference, status }, index) => {
    const y = 360 + index * step;
    ctx.strokeStyle = pal.grid;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(labelX, y + 20);
    ctx.lineTo(statusX, y + 20);
    ctx.stroke();
    text(label, labelX, y, rowSize, pal.muted, "left", labelW);
    text(actual, factX, y, rowSize, pal.text, "right", factW, 600);
    text(reference, refX, y, smallSize, pal.muted, "left", refMax);
    text(status, statusX, y, smallSize, pal.text, "right", statusMax);
  });
  return texture(c);
}
