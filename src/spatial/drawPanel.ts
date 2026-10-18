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

/** Shared truthful canvas scales: actual fill and an explicit plan/SLA reference. */
function paintMeter(
  ctx: CanvasRenderingContext2D,
  percent: number,
  mode: "plan" | "downtime",
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const max = meterMaximum(percent, mode),
    target = mode === "plan" ? 100 : DOWNTIME_LIMIT;
  ctx.fillStyle = colors.border;
  ctx.fillRect(x, y, width, height);
  ctx.fillStyle = colors[gaugeTone(percent, mode)];
  ctx.fillRect(x, y, (width * percent) / max, height);
  ctx.fillStyle = colors.text;
  ctx.fillRect(x + (width * target) / max, y - 4, 2, height + 8);
}

/** @dashboard Д1–Д10. Rasterize the same data model into the XR framebuffer, with Cyrillic fonts. */
export function drawPanel(m: DashboardModel, compact: boolean): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 1280;
  canvas.height = 800;
  const ctx = canvas.getContext("2d")!;
  const text = (
    value: string,
    x: number,
    y: number,
    size = 26,
    color = colors.text,
    align: CanvasTextAlign = "left",
  ) => {
    size = Math.max(26, size);
    ctx.font = `${size >= 36 ? 600 : 500} ${size}px PrivatSans, "Inter Variable", sans-serif`;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.fillText(
      t(value),
      x,
      y,
      align === "center" ? 360 : align === "right" ? x - 30 : 1230 - x,
    );
  };
  const line = (
    x: number,
    y: number,
    x2: number,
    y2: number,
    color = colors.border,
    width = 2,
  ) => {
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.moveTo(x, y);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  };
  const panelFill = ctx.createLinearGradient(0, 0, 1280, 800);
  panelFill.addColorStop(0, colors.elevated);
  panelFill.addColorStop(1, colors.background);
  ctx.fillStyle = panelFill;
  ctx.beginPath();
  ctx.roundRect(3, 3, 1274, 794, 34);
  ctx.fill();
  text(m.title, 45, 64, 34);
  text(m.subtitle, 45, 108, 23, colors.muted);
  const gauge = (
    g: DashboardModel["gauges"][number],
    x: number,
    y: number,
    w: number,
  ) => {
    const tone = colors[gaugeTone(g.percent, g.mode)];
    text(g.label, x, y + 32, 32, colors.muted);
    text(formatPercent(g.percent), x, y + 92, 48, tone);
    paintMeter(ctx, g.percent, g.mode, x, y + 120, w - 30, 12);
    text(
      g.mode === "plan" ? "План 100%" : downtimeLabel(g.percent),
      x,
      y + 183,
      32,
      colors.muted,
    );
    if (g.value !== undefined)
      text(
        `${formatNumber(g.value, compact)} ${g.unit ?? t("шт.")}`,
        x,
        y + 238,
        34,
      );
  };
  const bars = (x: number, y: number, w: number, h: number) => {
    if (m.kind === "monthly") {
      const max = Math.max(
        115,
        ...m.bars.flatMap((b) => b.values).map((v) => v * 1.14),
      );
      const base = y + h,
        group = w / Math.max(1, m.bars.length);
      const targetY = base - (100 / max) * h;
      ctx.save();
      ctx.setLineDash([10, 8]);
      line(x, targetY, x + w, targetY, colors.muted, 2);
      ctx.restore();
      text("План 100%", x, y - 25, 28, colors.muted);
      m.bars.forEach((bar, i) => {
        const height = (bar.values[0] / max) * h,
          bx = x + (i + 0.5) * group,
          bw = group * 0.6;
        const fill = ctx.createLinearGradient(0, base - height, 0, base);
        fill.addColorStop(0, seriesColors[i % 3]);
        fill.addColorStop(1, colors.elevated);
        ctx.fillStyle = fill;
        ctx.beginPath();
        ctx.roundRect(bx - bw / 2, base - height, bw, height, 10);
        ctx.fill();
        text(
          formatPercent(bar.values[0]),
          bx,
          base - height + 44,
          32,
          colors["on-primary"],
          "center",
        );
        ctx.save();
        ctx.font = '500 28px PrivatSans, "Inter Variable", sans-serif';
        ctx.fillStyle = colors.muted;
        ctx.textAlign = "center";
        ctx.fillText(
          i === 0 ? t("Всего") : bar.label,
          bx,
          base + 45,
          group - 12,
        );
        ctx.restore();
      });
      return;
    }
    const max = Math.max(1, ...m.bars.flatMap((b) => b.values)) * 1.1;
    const group = w / Math.max(1, m.bars.length);
    line(x, y + h, x + w, y + h);
    m.bars.forEach((b, i) => {
      const count = b.values.length,
        bw = Math.min(55, group / (count + 1));
      b.values.forEach((v, j) => {
        const bx = x + i * group + (group - count * bw - 8) / 2 + j * (bw + 8),
          bh = (v / max) * h;
        ctx.globalAlpha = j === 0 && count === 2 ? 0.5 : 1;
        ctx.fillStyle = count === 2 ? colors.purple : seriesColors[i % 3];
        ctx.beginPath();
        ctx.roundRect(bx, y + h - bh, bw, bh, 6);
        ctx.fill();
        ctx.globalAlpha = 1;
        text(
          formatNumber(v),
          bx + bw / 2,
          y + h - bh - 18 - (j === 1 ? 36 : 0),
          26,
          colors.text,
          "center",
        );
      });
      const label = t(b.label === "Автоплат." ? "Автоплатежи" : b.label);
      const words = label
        .replace(/^Авто(?=плат)/, "Авто ")
        .replace(/-/g, "- ")
        .split(" ");
      ctx.save();
      ctx.font = '500 26px PrivatSans, "Inter Variable", sans-serif';
      ctx.fillStyle = colors.muted;
      ctx.textAlign = "center";
      words.forEach((word, j) =>
        ctx.fillText(
          word,
          x + i * group + group / 2,
          y + h + 42 + j * 31,
          group - 8,
        ),
      );
      ctx.restore();
    });
  };
  const donut = (cx: number, cy: number, r: number) => {
    const total = m.slices.reduce((a, b) => a + b.value, 0);
    let cursor = -Math.PI / 2;
    ctx.lineWidth = 28;
    m.slices.forEach((s) => {
      const end = cursor + (total ? s.value / total : 0) * Math.PI * 2;
      ctx.strokeStyle = s.color;
      ctx.beginPath();
      ctx.arc(cx, cy, r, cursor, end);
      ctx.stroke();
      cursor = end;
    });
    text(
      m.share === undefined
        ? formatNumber(total, true)
        : formatPercent(m.share),
      cx,
      cy + 12,
      43,
      colors.text,
      "center",
    );
    text(
      m.share === undefined ? "операций" : "доля в ДБО",
      cx,
      cy + 53,
      24,
      colors.muted,
      "center",
    );
  };
  const lines = (x: number, y: number, w: number, h: number) => {
    if (!m.days.length) {
      text(
        "Нет данных за этот период",
        x + w / 2,
        y + h / 2,
        32,
        colors.muted,
        "center",
      );
      return;
    }
    const max = Math.max(1, ...m.series.flatMap((s) => s.points)) * 1.1;
    [0, 0.5, 1].forEach((t) => {
      line(x, y + h - t * h, x + w, y + h - t * h);
      text(
        formatNumber(Math.round(max * t), true),
        x - 24,
        y + h - t * h + 8,
        20,
        colors.muted,
        "right",
      );
    });
    m.series.forEach((s, index) => {
      ctx.strokeStyle = s.color;
      ctx.lineWidth = 5;
      ctx.beginPath();
      s.points.forEach((v, i) => {
        const px = x + (i / Math.max(1, s.points.length - 1)) * w,
          py = y + h - (v / max) * h;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.stroke();
      text(s.label, x + index * 220, y + h + 110, 26, s.color);
    });
    m.days.forEach((d, i) => {
      if (
        i % Math.max(1, Math.ceil(m.days.length / 6)) === 0 ||
        i === m.days.length - 1
      )
        text(
          d,
          x + (i / Math.max(1, m.days.length - 1)) * w,
          y + h + 56,
          20,
          colors.muted,
          "center",
        );
    });
  };
  if (m.kind === "channels") {
    if (m.bars.length) bars(50, 250, 820, 370);
    else text("Нет данных по каналам", 70, 350, 32);
    donut(1060, 400, 115);
    text("Январь / отчётный месяц", 60, 190, 24, colors.purple);
  }
  if (m.kind === "monthly") {
    bars(45, 235, 570, 385);
    m.metrics.forEach((metric, i) => {
      const y = 230 + i * 160;
      text(metric.label, 690, y, 26, colors.muted);
      text(
        `${formatNumber(metric.value, compact)} ${metric.unit ?? ""}`,
        690,
        y + 53,
        40,
      );
      text(metric.delta ?? "", 1190, y + 53, 26, metric.color, "right");
      if (metric.spark && metric.spark.length > 1) {
        const min = Math.min(...metric.spark),
          range = Math.max(...metric.spark) - min || 1;
        ctx.strokeStyle = metric.color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        metric.spark.forEach((v, j) => {
          const px = 1010 + (j / (metric.spark!.length - 1)) * 180,
            py = y + 110 - ((v - min) / range) * 40;
          if (j) ctx.lineTo(px, py);
          else ctx.moveTo(px, py);
        });
        ctx.stroke();
      }
    });
  }
  if (m.kind === "gauges") {
    m.gauges.forEach((g, i) =>
      gauge(g, 40 + (i * 1200) / m.gauges.length, 260, 1200 / m.gauges.length),
    );
  }
  if (m.kind === "cash") {
    donut(230, 350, 120);
    m.slices.forEach((s, i) => {
      const y = 200 + i * 85;
      text(s.label, 450, y, 28, s.color);
      text(formatNumber(s.value, compact), 900, y, 29, colors.text, "right");
    });
    gauge(m.gauges[0], 920, 290, 300);
  }
  if (m.kind === "staff") {
    lines(165, 200, 615, 330);
    text(
      String(m.metrics[0].value),
      1020,
      270,
      78,
      m.metrics[0].color,
      "center",
    );
    text("Открытые вакансии", 1020, 315, 25, colors.muted, "center");
    gauge(m.gauges[0], 850, 410, 340);
  }
  if (m.kind === "equipment") {
    lines(155, 165, 1040, 200);
    text("Простой", 70, 530, 25, colors.muted);
    m.gauges.forEach((g, i) => gauge(g, 150 + i * 360, 550, 230));
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}
export function drawLabel(
  label: string,
  aspect = 6.4,
  selected = false,
): CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 1024;
  c.height = Math.round(c.width / aspect);
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = selected ? colors.purple : colors.elevated;
  ctx.beginPath();
  ctx.roundRect(2, 2, 1020, c.height - 4, c.height / 2 - 2);
  ctx.fill();
  ctx.font = `500 ${Math.round(c.height * 0.3)}px PrivatSans, "Inter Variable", sans-serif`;
  ctx.fillStyle = selected ? colors["on-primary"] : colors.text;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(t(label), 512, c.height / 2, 930);
  const texture = new CanvasTexture(c);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

/** Wide bottom equipment/cash cards fill the stand without distorting their type. */
export function drawOverviewPanel(
  m: DashboardModel,
  wide = false,
): CanvasTexture {
  if (!wide) return drawPanel(m, true);
  const c = document.createElement("canvas");
  c.width = 1280;
  c.height = 400;
  const ctx = c.getContext("2d")!;
  const fill = ctx.createLinearGradient(0, 0, 1280, 400);
  fill.addColorStop(0, colors.elevated);
  fill.addColorStop(1, colors.background);
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.roundRect(2, 2, 1276, 396, 24);
  ctx.fill();
  const text = (
    value: string,
    x: number,
    y: number,
    size = 28,
    color = colors.text,
    align: CanvasTextAlign = "left",
    max = 1150,
  ) => {
    ctx.font = `500 ${size}px PrivatSans, "Inter Variable", sans-serif`;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.fillText(t(value), x, y, max);
  };
  text(m.title, 40, 52, 36);
  text(m.subtitle, 40, 91, 25, colors.muted);
  if (m.kind === "equipment") {
    const left = 90,
      right = 740,
      top = 140,
      base = 290,
      max = Math.max(1, ...m.series.flatMap((s) => s.points)) * 1.12;
    for (const fraction of [0, 0.5, 1]) {
      const y = base - fraction * (base - top);
      ctx.strokeStyle = colors.border;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(left, y);
      ctx.lineTo(right, y);
      ctx.stroke();
      text(
        formatNumber(Math.round(max * fraction), true),
        left - 15,
        y + 7,
        23,
        colors.muted,
        "right",
        70,
      );
    }
    m.series.forEach((series, index) => {
      ctx.strokeStyle = series.color;
      ctx.lineWidth = 4;
      ctx.beginPath();
      series.points.forEach((v, i) => {
        const x =
            left + (i / Math.max(1, series.points.length - 1)) * (right - left),
          y = base - (v / max) * (base - top);
        if (i) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
      });
      ctx.stroke();
      text(
        series.label,
        left + index * 210,
        375,
        25,
        series.color,
        "left",
        190,
      );
    });
    m.days.forEach((day, i) => {
      if (
        i % Math.max(1, Math.ceil(m.days.length / 6)) === 0 ||
        i === m.days.length - 1
      )
        text(
          day,
          left + (i / Math.max(1, m.days.length - 1)) * (right - left),
          332,
          23,
          colors.muted,
          "center",
          80,
        );
    });
    text(
      `${t("Простой")} · SLA ${formatPercent(DOWNTIME_LIMIT)}`,
      820,
      91,
      25,
      colors.muted,
      "left",
      400,
    );
    m.gauges.forEach((g, i) => {
      const y = 155 + i * 90;
      text(g.label, 820, y, 27, colors.muted, "left", 220);
      text(
        formatPercent(g.percent),
        1225,
        y,
        32,
        colors[gaugeTone(g.percent, g.mode)],
        "right",
        190,
      );
      paintMeter(ctx, g.percent, g.mode, 820, y + 18, 405, 8);
    });
  } else if (m.kind === "cash") {
    const total = m.slices.reduce((n, s) => n + s.value, 0);
    text(formatNumber(total, true), 45, 190, 66);
    text("операций", 45, 232, 27, colors.muted);
    text("Месячный план", 45, 295, 27, colors.muted);
    text(
      formatPercent(m.gauges[0].percent),
      430,
      295,
      37,
      colors.success,
      "right",
      180,
    );
    paintMeter(ctx, m.gauges[0].percent, "plan", 45, 322, 385, 8);
    m.slices.forEach((slice, index) => {
      const y = 147 + index * 63;
      text(slice.label, 540, y, 29, slice.color, "left", 420);
      text(
        formatNumber(slice.value, true),
        1225,
        y,
        31,
        colors.text,
        "right",
        250,
      );
    });
  }
  const texture = new CanvasTexture(c);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

/** @dashboard Д1–Д10. Decorative group material; headings encode the real data groups. */
export function drawWing(title: string, aspect: number): CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 1280;
  c.height = Math.round(c.width / aspect);
  const ctx = c.getContext("2d")!;
  const fill = ctx.createLinearGradient(0, 0, c.width, c.height);
  fill.addColorStop(0, colors.elevated);
  fill.addColorStop(1, colors.background);
  ctx.fillStyle = fill;
  ctx.globalAlpha = 0.78;
  ctx.beginPath();
  ctx.roundRect(3, 3, c.width - 6, c.height - 6, 58);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.font = '600 48px "Manrope Variable", sans-serif';
  ctx.fillStyle = colors.text;
  ctx.fillText(t(title), 60, 82, c.width - 120);
  const texture = new CanvasTexture(c);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

/** A chart and a dense exact-value table share one focus surface. Long API series scroll by row. */
export function drawFocusPanel(
  model: DashboardModel,
  compact: boolean,
  offset = 0,
): CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 2048;
  c.height = focusTextureHeight(model.facts.length);
  const ctx = c.getContext("2d")!;
  const fill = ctx.createLinearGradient(0, 0, c.width, c.height);
  fill.addColorStop(0, colors.elevated);
  fill.addColorStop(1, colors.background);
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.roundRect(3, 3, c.width - 6, c.height - 6, 36);
  ctx.fill();
  const text = (
    value: string,
    x: number,
    y: number,
    size: number,
    color = colors.text,
    align: CanvasTextAlign = "left",
    max = 1900,
  ) => {
    ctx.font = `500 ${size}px PrivatSans, "Inter Variable", sans-serif`;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.fillText(t(value), x, y, max);
  };
  text(model.title, 55, 82, 56);
  text(model.subtitle, 55, 133, 32, colors.muted);
  const chart = drawPanel(model, compact);
  ctx.drawImage(
    chart.image as HTMLCanvasElement,
    0,
    145,
    1280,
    655,
    35,
    195,
    1000,
    512,
  );
  chart.dispose();
  text("Точные значения", 1100, 155, 36);
  text("Показатель", 1100, 200, 25, colors.muted, "left", 300);
  text("Факт", 1615, 200, 25, colors.muted, "right", 200);
  text("План / Порог", 1700, 200, 24, colors.muted, "center", 155);
  text("Выполнение", 1985, 200, 24, colors.muted, "right", 195);
  const facts = comparisonRows(model);
  const start = Math.min(
    Math.max(0, offset),
    Math.max(0, facts.length - FOCUS_ROWS),
  );
  const rows = facts.slice(start, start + FOCUS_ROWS),
    step = Math.min(72, (c.height - 275) / Math.max(1, rows.length));
  rows.forEach(({ label, actual, reference, status }, index) => {
    const y = 255 + index * step;
    ctx.strokeStyle = colors.border;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(1090, y + 17);
    ctx.lineTo(1990, y + 17);
    ctx.stroke();
    text(label, 1100, y, 25, colors.muted, "left", 300);
    text(actual, 1615, y, 25, colors.text, "right", 200);
    text(reference, 1700, y, 24, colors.muted, "center", 155);
    text(status, 1985, y, 24, colors.text, "right", 195);
  });
  const texture = new CanvasTexture(c);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}
