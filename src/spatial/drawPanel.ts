import { CanvasTexture, SRGBColorSpace } from "three";
import { type DashboardModel, colors, seriesColors } from "../api/model";
import { formatNumber, formatPercent, gaugeTone } from "../api/format";

/** @dashboard Д1–Д10. Rasterize the same data model into the XR framebuffer, with Cyrillic fonts. */
export function drawPanel(
  m: DashboardModel,
  compact: boolean,
  source: string,
): CanvasTexture {
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
    ctx.font = `${size >= 36 ? 600 : 500} ${size}px "Inter Variable", sans-serif`;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.fillText(value, x, y);
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
  text(source, 1235, 108, 21, colors.muted, "right");
  const gauge = (
    g: DashboardModel["gauges"][number],
    x: number,
    y: number,
    w: number,
  ) => {
    const radius = w * 0.37,
      cx = x + w / 2,
      cy = y + radius + 16;
    ctx.lineWidth = 18;
    ctx.lineCap = "butt";
    ctx.strokeStyle = colors.border;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, Math.PI, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = colors[gaugeTone(g.percent, g.mode)];
    ctx.beginPath();
    ctx.arc(
      cx,
      cy,
      radius,
      Math.PI,
      Math.PI + (Math.min(g.percent, 100) / 100) * Math.PI,
    );
    ctx.stroke();
    text(formatPercent(g.percent), cx, cy - 8, 42, colors.text, "center");
    text(g.label, cx, cy + 52, 25, colors.muted, "center");
    if (g.value !== undefined)
      text(
        `${formatNumber(g.value, compact)} ${g.unit ?? ""}`,
        cx,
        cy + 102,
        30,
        colors.text,
        "center",
      );
  };
  const bars = (x: number, y: number, w: number, h: number) => {
    const max =
      Math.max(
        m.kind === "monthly" ? 115 : 1,
        ...m.bars.flatMap((b) => b.values),
      ) * 1.1;
    const group = w / Math.max(1, m.bars.length);
    line(x, y + h, x + w, y + h);
    if (m.kind === "monthly") {
      const target = y + h - (100 / max) * h;
      ctx.setLineDash([8, 8]);
      line(x, target, x + w, target, colors.muted);
      ctx.setLineDash([]);
      text("План 100%", x + w, target - 16, 21, colors.muted, "right");
    }
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
          m.kind === "monthly" ? formatPercent(v) : formatNumber(v),
          bx + bw / 2,
          y + h - bh - 18,
          26,
          colors.text,
          "center",
        );
      });
      text(
        b.label,
        x + i * group + group / 2,
        y + h + 43,
        23,
        colors.muted,
        "center",
      );
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
        x - 8,
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
      text(s.label, x + index * 220, y + h + 58, 24, s.color);
    });
    m.days.forEach((d, i) => {
      if (
        i % Math.max(1, Math.ceil(m.days.length / 6)) === 0 ||
        i === m.days.length - 1
      )
        text(
          d,
          x + (i / Math.max(1, m.days.length - 1)) * w,
          y + h + 30,
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
      line(690, y + 90, 1210, y + 90);
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
    lines(90, 200, 690, 330);
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
    lines(85, 200, 1110, 230);
    m.gauges.forEach((g, i) => gauge(g, 150 + i * 360, 510, 230));
  }
  text(
    "Нажмите на панель, чтобы вернуться к обзору",
    640,
    765,
    22,
    colors.muted,
    "center",
  );
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}
export function drawLabel(label: string, aspect = 6.4): CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 1024;
  c.height = Math.round(c.width / aspect);
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = colors.elevated;
  ctx.beginPath();
  ctx.roundRect(2, 2, 1020, c.height - 4, c.height / 2 - 2);
  ctx.fill();
  ctx.font = `500 ${Math.round(c.height * 0.3)}px "Inter Variable", sans-serif`;
  ctx.fillStyle = colors.text;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, 512, c.height / 2, 930);
  const texture = new CanvasTexture(c);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

/** @dashboard Д1–Д10. At overview distance prioritize large readings; full charts open in focus. */
export function drawOverviewPanel(
  m: DashboardModel,
  source: string,
): CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 1280;
  c.height = 800;
  const ctx = c.getContext("2d")!;
  const text = (
    s: string,
    x: number,
    y: number,
    size = 42,
    color = colors.text,
    align: CanvasTextAlign = "left",
  ) => {
    ctx.font = `${size >= 60 ? 600 : 500} ${size}px "Inter Variable", sans-serif`;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.fillText(s, x, y, 1160);
  };
  const fill = ctx.createLinearGradient(0, 0, 1280, 800);
  fill.addColorStop(0, colors.elevated);
  fill.addColorStop(1, colors.background);
  ctx.fillStyle = fill;
  ctx.globalAlpha = 0.94;
  ctx.beginPath();
  ctx.roundRect(3, 3, 1274, 794, 35);
  ctx.fill();
  ctx.globalAlpha = 1;
  text(m.title, 55, 87, 48);
  text(source, 55, 145, 32, colors.muted);
  const metric = (
    label: string,
    value: string,
    x: number,
    y: number,
    color = colors.text,
  ) => {
    text(value, x, y, 82, color);
    text(label, x, y + 60, 32, colors.muted);
  };
  if (m.kind === "channels") {
    metric(
      "Доля платежей в ДБО",
      formatPercent(m.share ?? 0),
      65,
      310,
      colors.purple,
    );
    const max = Math.max(1, ...m.bars.flatMap((x) => x.values));
    m.bars.forEach((b, i) => {
      const step = 1120 / Math.max(1, m.bars.length);
      b.values.forEach((v, j) => {
        ctx.fillStyle = colors.purple;
        ctx.globalAlpha = j === 0 ? 0.45 : 1;
        ctx.fillRect(
          65 + i * step + j * 45,
          630 - (v / max) * 230,
          35,
          (v / max) * 230,
        );
        ctx.globalAlpha = 1;
      });
    });
  }
  if (m.kind === "monthly") {
    metric(
      m.metrics[0].label,
      `${formatNumber(m.metrics[0].value, true)} ${m.unit ?? ""}`,
      65,
      320,
      seriesColors[0],
    );
    m.bars.forEach((b, i) => {
      const x = 65 + i * 385;
      text(formatPercent(b.values[0]), x, 530, 75, seriesColors[i]);
      text(b.label, x, 590, 30, colors.muted);
    });
  }
  if (m.kind === "gauges" || m.kind === "equipment") {
    m.gauges.forEach((g, i) => {
      const w = 1160 / m.gauges.length,
        x = 60 + i * w;
      const r = w * 0.37,
        cx = x + w / 2,
        cy = 425;
      ctx.lineWidth = 22;
      ctx.strokeStyle = colors.border;
      ctx.beginPath();
      ctx.arc(cx, cy, r, Math.PI, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = colors[gaugeTone(g.percent, g.mode)];
      ctx.beginPath();
      ctx.arc(
        cx,
        cy,
        r,
        Math.PI,
        Math.PI + (Math.min(100, g.percent) / 100) * Math.PI,
      );
      ctx.stroke();
      text(formatPercent(g.percent), cx, cy - 15, 62, colors.text, "center");
      text(g.label, cx, 490, 30, colors.muted, "center");
      if (g.value !== undefined)
        text(
          `${formatNumber(g.value, true)} ${g.unit ?? ""}`,
          cx,
          565,
          44,
          colors.text,
          "center",
        );
      else text("простой", cx, 550, 32, colors.muted, "center");
    });
  }
  if (m.kind === "cash") {
    metric(
      "Операций за месяц",
      formatNumber(
        m.slices.reduce((a, b) => a + b.value, 0),
        true,
      ),
      65,
      330,
      colors.success,
    );
    metric(
      "Выполнение месячного плана",
      formatPercent(m.gauges[0].percent),
      65,
      560,
    );
  }
  if (m.kind === "staff") {
    metric(
      "Открытые вакансии",
      formatNumber(m.metrics[0].value),
      65,
      340,
      m.metrics[0].color,
    );
    metric(
      "Простой касс сегодня",
      formatPercent(m.gauges[0].percent),
      680,
      340,
      colors[gaugeTone(m.gauges[0].percent, "downtime")],
    );
    const pts = m.series[0].points,
      max = Math.max(1, ...pts);
    if (pts.length) {
      ctx.lineWidth = 6;
      ctx.strokeStyle = colors.cyan;
      ctx.beginPath();
      pts.forEach((v, i) => {
        const x = 65 + (i / Math.max(1, pts.length - 1)) * 1120,
          y = 650 - (v / max) * 180;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    } else text("Нет данных по работающим кассам", 65, 580, 36, colors.muted);
  }
  const texture = new CanvasTexture(c);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

/** @dashboard Д1–Д10. Decorative group material; headings encode the real data groups. */
export function drawWing(
  title: string,
  subtitle: string,
  aspect: number,
): CanvasTexture {
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
  ctx.font = '600 64px "Manrope Variable", sans-serif';
  ctx.fillStyle = colors.text;
  ctx.fillText(title, 60, 100, c.width - 120);
  ctx.font = '400 32px "Inter Variable", sans-serif';
  ctx.fillStyle = colors.muted;
  ctx.fillText(subtitle, 60, 153, c.width - 120);
  const texture = new CanvasTexture(c);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}
