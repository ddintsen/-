import { useEffect, useId, useRef, useState } from "react";
import {
  formatNumber,
  formatPercent,
  gaugeTone,
  downtimeLabel,
  DOWNTIME_LIMIT,
  meterMaximum,
} from "../api/format";
import {
  colors,
  seriesColors,
  type Bar,
  type Gauge,
  type MeterTone,
  type Metric,
  type Series,
  type Slice,
} from "../api/model";
import { useDashboardStore } from "../store/dashboard";
import { t, useLocale } from "../i18n";
import { Empty } from "./ui";

/** Resolve token colours through the active DOM theme, preserving custom API colours. */
export function chartColor(color: string) {
  const key = Object.entries(colors).find(([, value]) => value === color)?.[0];
  return key ? `var(--color-${key})` : color;
}

/** Keep SVG coordinates in CSS pixels so narrow cards retain readable axis labels. */
function useChartWidth(fallback: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    const element = ref.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry.contentRect.width > 0)
        setWidth(Math.max(180, Math.floor(entry.contentRect.width)));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return { ref, width };
}

/** A column with a rounded data end and a square foot on the baseline. */
function column(x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.max(0, Math.min(r, w / 2, h));
  return `M${x} ${y + h}V${y + rr}A${rr} ${rr} 0 0 1 ${x + rr} ${y}H${x + w - rr}A${rr} ${rr} 0 0 1 ${x + w} ${y + rr}V${y + h}Z`;
}

/** Axis maximum on a 1-2-5 step, so the half tick is a clean number too. */
function niceMax(value: number) {
  const exponent = 10 ** Math.floor(Math.log10(value));
  const fraction = value / exponent;
  return (
    (fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10) * exponent
  );
}

/** @dashboard Д4–Д10. Exact percentages; plan and downtime retain independent semantics. */
export function ArcGauge({
  gauge,
  small = false,
  tone,
}: {
  gauge: Gauge;
  small?: boolean;
  /** Colour role from meterTone(); defaults to the business band of the gauge. */
  tone?: MeterTone;
}) {
  useLocale();
  const compact = useDashboardStore((s) => s.compact);
  const semantic = gaugeTone(gauge.percent, gauge.mode);
  const visual: MeterTone =
    tone ?? (semantic === "cyan" ? "neutral" : semantic);
  const downtime = gauge.mode === "downtime";
  const label = t(gauge.label);
  const status = downtime ? downtimeLabel(gauge.percent) : t("План 100%");
  const actual =
    gauge.value === undefined
      ? undefined
      : `${formatNumber(gauge.value)} ${gauge.unit ?? t("шт.")}`;
  const maximum = meterMaximum(gauge.percent, gauge.mode);
  const target = downtime ? DOWNTIME_LIMIT : 100;
  return (
    <div
      className={`progress-gauge ${small ? "small" : ""} ${downtime ? "downtime-gauge" : "plan-gauge"}`}
      data-tone={semantic}
      data-meter-tone={visual}
    >
      <div className="progress-heading">
        <span className="progress-label">{label}</span>
        <strong className="progress-percent">
          {formatPercent(gauge.percent)}
        </strong>
      </div>
      <div
        className="progress-track"
        style={
          {
            "--risk-position": `${(gauge.percent / maximum) * 100}%`,
          } as import("react").CSSProperties
        }
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={maximum}
        aria-valuenow={gauge.percent}
        aria-valuetext={`${formatPercent(gauge.percent)}; ${status}${actual ? `; ${t("Факт")}: ${actual}` : ""}`}
      >
        <span
          className="progress-fill"
          style={{
            width: `${(gauge.percent / maximum) * 100}%`,
          }}
        />
        <span
          className="progress-target"
          style={{ left: `${(target / maximum) * 100}%` }}
        />
      </div>
      <div className="progress-detail">
        {gauge.value !== undefined ? (
          <span className="progress-actual">
            <span>{t("Факт")}</span>
            <strong title={actual}>
              {formatNumber(gauge.value, compact)}
              <small> {gauge.unit ?? t("шт.")}</small>
            </strong>
          </span>
        ) : null}
        <span className="progress-reference">
          {downtime
            ? `${status} · SLA ${formatPercent(DOWNTIME_LIMIT)}`
            : status}
        </span>
      </div>
    </div>
  );
}
/** @dashboard Д1. Emphasis pair: the reporting month in the accent, January as quiet context. */
export function GroupedBars({ bars }: { bars: Bar[] }) {
  useLocale();
  const { ref, width } = useChartWidth(480);
  if (!bars.length) return <Empty />;
  const height = 210,
    base = 160,
    plot = 114,
    max = Math.max(1, ...bars.flatMap((b) => b.values)) * 1.28,
    // Edge labels such as "Інтернет" are wider than their bar pair; keep them inside the chart.
    pad = 12,
    group = (width - pad * 2) / bars.length,
    barWidth = Math.max(8, Math.min(22, (group - 36) / 2)),
    pairGap = Math.max(4, Math.min(8, group * 0.06)),
    // Narrow stands (1251-1400px) give each channel under 60px; category labels step down.
    labelSize = group < 62 ? 11 : 12;
  const fills = [
    chartColor(colors["series-muted"]),
    chartColor(seriesColors[0]),
  ];
  // Both values of a pair share one baseline above the taller bar, so pairs read as a row.
  const pairLabelY = bars.map(
    (bar) => base - (Math.max(...bar.values) / max) * plot - 9,
  );
  return (
    <div className="grouped-bars" ref={ref}>
      <div className="chart-legend">
        <span>
          <i style={{ background: fills[0] }} />
          {t("Январь")}
        </span>
        <span>
          <i style={{ background: fills[1] }} />
          {t("Отчётный месяц")}
        </span>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={t("Платежи по каналам: январь и отчётный месяц, млн шт.")}
      >
        {bars.map((b, i) => {
          const label = t(b.label === "Автоплат." ? "Автоплатежи" : b.label);
          const labelLines = label
            .replace(/^Авто(?=плат)/, "Авто ")
            .replace(/-/g, "- ")
            .split(" ");
          const centre = pad + i * group + group / 2;
          return (
            <g key={b.label}>
              {b.values.map((v, j) => {
                const x =
                    centre + (j === 0 ? -barWidth - pairGap / 2 : pairGap / 2),
                  h = Math.max(1, (v / max) * plot);
                return (
                  <g key={j}>
                    <path
                      className={`grow-bar channel-bar${j === 0 ? " is-reference" : ""}`}
                      style={{ animationDelay: `${i * 45 + j * 20}ms` }}
                      d={column(x, base - h, barWidth, h, 4)}
                      fill={fills[j === 0 ? 0 : 1]}
                    />
                    <text
                      x={centre}
                      y={pairLabelY[i] - (j === 0 ? 0 : 14)}
                      className={`chart-value${j === 0 ? " is-reference" : ""}`}
                      textAnchor="middle"
                      style={{ fontSize: j === 0 ? 11 : 12 }}
                    >
                      {formatNumber(v)}
                    </text>
                  </g>
                );
              })}
              <text
                x={centre}
                y={base + 23}
                textAnchor="middle"
                className="chart-label"
                style={{ fontSize: labelSize }}
              >
                {labelLines.map((line, index) => (
                  <tspan key={index} x={centre} dy={index ? labelSize + 3 : 0}>
                    {line}
                  </tspan>
                ))}
              </text>
            </g>
          );
        })}
        <line
          x1="4"
          x2={width - 4}
          y1={base + 0.5}
          y2={base + 0.5}
          className="chart-baseline"
        />
      </svg>
    </div>
  );
}
/** @dashboard Д2–Д3. Glass columns: a tinted body, a solid lit data end, the 100% plan at true scale. */
export function PlanBars({ bars }: { bars: Bar[] }) {
  useLocale();
  const id = useId().replace(/:/g, "");
  const { ref, width } = useChartWidth(260);
  const max = Math.max(
    115,
    ...bars.flatMap((b) => b.values).map((v) => v * 1.14),
  );
  const base = 160,
    plot = 124,
    group = width / Math.max(1, bars.length);
  const barWidth = Math.min(48, Math.max(30, group * 0.58));
  const targetY = base - (100 / max) * plot;
  return (
    <div className="plan-bars" ref={ref}>
      <svg
        viewBox={`0 0 ${width} 204`}
        role="img"
        aria-label={bars
          .map((b) => `${b.label}: ${formatPercent(b.values[0])}`)
          .join(", ")}
      >
        <defs>
          {seriesColors.map((color, i) => (
            <linearGradient
              key={color}
              id={`${id}-${i}`}
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop
                offset="0%"
                className="tint-top"
                style={{ stopColor: chartColor(color) }}
              />
              <stop
                offset="100%"
                className="tint-bottom"
                style={{ stopColor: chartColor(color) }}
              />
            </linearGradient>
          ))}
          {/* Squares the feet of the columns on the baseline. */}
          <clipPath id={`${id}-base`}>
            <path d={`M0 0H${width}V${base}H0Z`} />
          </clipPath>
        </defs>
        <text
          x={width - 6}
          y={targetY - 7}
          textAnchor="end"
          className="chart-label plan-label"
        >
          {t("План 100%")}
        </text>
        <g clipPath={`url(#${id}-base)`}>
          {bars.map((bar, i) => {
            const height = Math.max(2, (bar.values[0] / max) * plot),
              left = (i + 0.5) * group - barWidth / 2,
              top = base - height;
            return (
              <g
                key={bar.label}
                className="grow-bar plan-column"
                style={{ animationDelay: `${i * 70}ms` }}
              >
                <rect
                  x={left}
                  y={top}
                  width={barWidth}
                  height={height + 8}
                  rx="7"
                  fill={`url(#${id}-${i % seriesColors.length})`}
                />
                <path
                  className="bar-cap"
                  d={`M${left + 4.5} ${top + 1.5}H${left + barWidth - 4.5}`}
                  stroke={chartColor(seriesColors[i % seriesColors.length])}
                />
              </g>
            );
          })}
        </g>
        <line
          x1="6"
          x2={width - 6}
          y1={targetY}
          y2={targetY}
          className="plan-target"
        />
        <line
          x1="6"
          x2={width - 6}
          y1={base + 0.5}
          y2={base + 0.5}
          className="chart-baseline"
        />
        {bars.map((bar, i) => {
          const height = Math.max(2, (bar.values[0] / max) * plot),
            x = (i + 0.5) * group,
            inside = height >= 30;
          return (
            <g key={bar.label}>
              <text
                x={x}
                y={inside ? base - height + 20 : base - height - 8}
                textAnchor="middle"
                className="bar-percent"
              >
                {formatPercent(bar.values[0])}
              </text>
              <text x={x} y="185" textAnchor="middle" className="chart-label">
                {i === 0 ? t("Всего") : bar.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/** Trend of one metric: a thin line with its latest point marked; values live beside it. */
export function Sparkline({
  points,
  color,
}: {
  points: number[];
  color: string;
}) {
  if (points.length < 2) return null;
  const min = Math.min(...points),
    max = Math.max(...points),
    range = max - min || 1;
  const xy = points.map((v, i) => [
    3 + (i / (points.length - 1)) * 75,
    25 - ((v - min) / range) * 20,
  ]);
  const line = xy.map((p) => p.join(",")).join(" ");
  const [endX, endY] = xy[xy.length - 1];
  const stroke = chartColor(color);
  return (
    <svg className="sparkline" viewBox="0 0 82 30" aria-hidden="true">
      <polygon
        className="spark-area"
        points={`${xy[0][0]},30 ${line} ${endX},30`}
        fill={stroke}
      />
      <polyline
        points={line}
        fill="none"
        stroke={stroke}
        strokeWidth="1.6"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <circle className="spark-end" cx={endX} cy={endY} r="3.2" fill={stroke} />
    </svg>
  );
}
/** @dashboard Д2–Д3. Full values remain available in the focused data table. */
export function MetricRow({ metric }: { metric: Metric }) {
  useLocale();
  const compact = useDashboardStore((s) => s.compact);
  return (
    <div className="metric-row">
      <div className="metric-info">
        <span>{t(metric.label)}</span>
        <strong title={`${formatNumber(metric.value)} ${metric.unit ?? ""}`}>
          {formatNumber(metric.value, compact)}
          {metric.unit && metric.unit !== t("шт.") ? (
            <small> {metric.unit}</small>
          ) : null}
        </strong>
      </div>
      <div className="metric-trend">
        <span>{metric.delta}</span>
        {metric.spark ? (
          <Sparkline points={metric.spark} color={metric.color} />
        ) : null}
      </div>
    </div>
  );
}
/** @dashboard Д1, Д5. Pie labels have a text equivalent; zero total is not a full circle. */
export function Donut({
  slices,
  label,
  center,
}: {
  slices: Slice[];
  label: string;
  center: string;
}) {
  useLocale();
  const total = slices.reduce((a, b) => a + b.value, 0);
  if (!total) return <Empty />;
  const radius = 57,
    ring = 10,
    circumference = 2 * Math.PI * radius;
  // A share with its remainder reads as one ring meter: the remainder is the track and the
  // value arc has round ends (trimmed so the ends do not overstate it). Several parts touch,
  // so each segment is separated by a 2px gap of the surface instead of an outline.
  const meter = slices.some((s) => s.color === colors.border);
  const trim = meter ? (ring / circumference) * 100 : (2 / circumference) * 100;
  let cursor = 0;
  return (
    <div className="donut">
      <svg
        viewBox="0 0 150 150"
        role="img"
        aria-label={`${t(label)}: ${center}. ${slices.map((s) => `${t(s.label)}: ${formatNumber(s.value)}`).join(", ")}`}
      >
        {meter ? (
          <circle
            className="donut-track"
            cx="75"
            cy="75"
            r={radius}
            fill="none"
            strokeWidth={ring}
          />
        ) : null}
        {slices.map((s) => {
          const size = (s.value / total) * 100,
            offset = cursor;
          cursor += size;
          if (s.color === colors.border || size <= 0) return null;
          const dash = Math.max(0.01, size - trim);
          return (
            <circle
              key={s.label}
              className="donut-segment"
              cx="75"
              cy="75"
              r={radius}
              fill="none"
              stroke={chartColor(s.color)}
              strokeWidth={ring}
              strokeLinecap={meter ? "round" : "butt"}
              pathLength="100"
              strokeDasharray={`${dash} ${100 - dash}`}
              strokeDashoffset={-(offset + trim / 2)}
              transform="rotate(-90 75 75)"
            />
          );
        })}
        <text
          x="75"
          y="77"
          textAnchor="middle"
          className="donut-number"
          style={center.length > 6 ? { fontSize: 23 } : undefined}
        >
          {center}
        </text>
        <text x="75" y="98" textAnchor="middle" className="donut-label">
          {t(label)}
        </text>
      </svg>
    </div>
  );
}
/** @dashboard Д7, Д10. Shared zero baseline prevents misleading cross-series scaling. */
export function LineChart({
  series,
  days,
}: {
  series: Series[];
  days: string[];
}) {
  useLocale();
  const id = useId().replace(/:/g, "");
  const { ref, width } = useChartWidth(420);
  if (!days.length || !series.some((s) => s.points.length)) return <Empty />;
  const left = 62,
    right = width - 12,
    base = 130,
    plot = 102,
    max = niceMax(Math.max(1, ...series.flatMap((s) => s.points)) * 1.06);
  const single = series.length === 1;
  return (
    <div className="line-chart" ref={ref}>
      <svg
        viewBox={`0 0 ${width} 160`}
        role="img"
        aria-label={series
          .map(
            (s) =>
              `${t(s.label)}: ${s.points.map((n, i) => `${days[i]} — ${formatNumber(n)}`).join(", ")}`,
          )
          .join("; ")}
      >
        {single ? (
          <defs>
            <linearGradient id={`${id}-area`} x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="0%"
                className="area-top"
                style={{ stopColor: chartColor(series[0].color) }}
              />
              <stop
                offset="100%"
                className="area-bottom"
                style={{ stopColor: chartColor(series[0].color) }}
              />
            </linearGradient>
          </defs>
        ) : null}
        {[0, 0.5, 1].map((t) => (
          <g key={t}>
            <line
              x1={left}
              x2={right}
              y1={base - t * plot + (t ? 0 : 0.5)}
              y2={base - t * plot + (t ? 0 : 0.5)}
              className={t ? "chart-grid" : "chart-baseline"}
            />
            <text
              x={left - 8}
              y={base - t * plot + 4}
              textAnchor="end"
              className="chart-label"
              style={{ fontSize: 12 }}
            >
              {formatNumber(Math.round(t * max), true)}
            </text>
          </g>
        ))}
        {series.map((s) => {
          const pts = s.points.map((v, i) => [
            left + (i / Math.max(1, days.length - 1)) * (right - left),
            base - (v / max) * plot,
          ]);
          const stroke = chartColor(s.color);
          const last = pts[pts.length - 1];
          return (
            <g key={s.label}>
              {single && last ? (
                <polygon
                  points={`${pts[0][0]},${base} ${pts.map((p) => p.join(",")).join(" ")} ${last[0]},${base}`}
                  fill={`url(#${id}-area)`}
                />
              ) : null}
              <polyline
                points={pts.map((p) => p.join(",")).join(" ")}
                fill="none"
                stroke={stroke}
                strokeWidth="2"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              {pts.length <= 16
                ? pts
                    .slice(0, -1)
                    .map(([x, y], i) => (
                      <circle
                        key={i}
                        className="line-point"
                        cx={x}
                        cy={y}
                        r="2.2"
                        fill={stroke}
                      />
                    ))
                : null}
              {last ? (
                <circle
                  className="line-end"
                  cx={last[0]}
                  cy={last[1]}
                  r="4"
                  fill={stroke}
                />
              ) : null}
            </g>
          );
        })}
        {days.map((d, i) =>
          i === 0 ||
          i === days.length - 1 ||
          i % Math.max(1, Math.ceil(days.length / 6)) === 0 ? (
            <text
              key={i}
              x={left + (i / Math.max(1, days.length - 1)) * (right - left)}
              y="153"
              textAnchor="middle"
              className="chart-label"
              style={{ fontSize: 12 }}
            >
              {d}
            </text>
          ) : null,
        )}
      </svg>
      <div className="chart-legend">
        {series.map((s) => (
          <span key={s.label}>
            <i
              className="line-key"
              style={{ background: chartColor(s.color) }}
            />
            {t(s.label)}
          </span>
        ))}
      </div>
    </div>
  );
}
