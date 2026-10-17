import { useId } from "react";
import {
  formatNumber,
  formatPercent,
  gaugeTone,
  downtimeLabel,
} from "../api/format";
import {
  colors,
  seriesColors,
  type Bar,
  type Gauge,
  type Metric,
  type Series,
  type Slice,
} from "../api/model";
import { useDashboardStore } from "../store/dashboard";
import { Empty } from "./ui";

/** @dashboard Д4–Д10. Plan and downtime use independent semantics and exact arc lengths. */
export function ArcGauge({
  gauge,
  small = false,
}: {
  gauge: Gauge;
  small?: boolean;
}) {
  const compact = useDashboardStore((s) => s.compact);
  const tone = gaugeTone(gauge.percent, gauge.mode);
  return (
    <div
      className={`arc-gauge ${small ? "small" : ""}`}
      data-tone={tone}
      title={
        gauge.mode === "downtime" ? downtimeLabel(gauge.percent) : undefined
      }
    >
      <div
        className="gauge-graphic"
        role="img"
        aria-label={`${gauge.label}: ${formatPercent(gauge.percent)}${gauge.mode === "downtime" ? `, ${downtimeLabel(gauge.percent)}` : ""}`}
      >
        <svg viewBox="0 0 160 94" aria-hidden="true">
          <path d="M 15 79 A 65 65 0 0 1 145 79" className="gauge-track" />
          <path
            d="M 15 79 A 65 65 0 0 1 145 79"
            pathLength="100"
            stroke={colors[tone]}
            strokeDasharray={`${Math.min(100, gauge.percent)} 100`}
            className="gauge-fill"
          />
          <text x="80" y="76" textAnchor="middle" className="gauge-percent">
            {formatPercent(gauge.percent)}
          </text>
        </svg>
      </div>
      <span className="gauge-label">{gauge.label}</span>
      {gauge.value !== undefined ? (
        <strong
          className="gauge-value"
          title={`${formatNumber(gauge.value)} ${gauge.unit ?? "шт."}`}
        >
          {formatNumber(gauge.value, compact)}
          {gauge.unit ? <small> {gauge.unit}</small> : null}
        </strong>
      ) : null}
    </div>
  );
}
/** @dashboard Д1. Paired series share a zero baseline and visible values. */
export function GroupedBars({ bars }: { bars: Bar[] }) {
  const id = useId().replace(/:/g, "");
  if (!bars.length) return <Empty />;
  const width = 480,
    height = 188,
    base = 150,
    plot = 114,
    max = Math.max(1, ...bars.flatMap((b) => b.values)) * 1.2,
    group = width / bars.length;
  return (
    <div className="grouped-bars">
      <div className="chart-legend">
        <span>
          <i style={{ background: colors.purple, opacity: 0.5 }} />
          Январь
        </span>
        <span>
          <i style={{ background: colors.purple }} />
          Отчётный месяц
        </span>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Количество платежей по каналам, январь и отчётный месяц, в миллионах. Точные значения доступны в фокусе."
      >
        <defs>
          <linearGradient id={`${id}-channel`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={colors.purple} />
            <stop offset="100%" stopColor={colors.purple} stopOpacity=".45" />
          </linearGradient>
        </defs>
        {[0, 0.5, 1].map((t) => (
          <line
            key={t}
            x1="4"
            y1={base - t * plot}
            x2={width - 4}
            y2={base - t * plot}
            className="chart-grid"
          />
        ))}
        {bars.map((b, i) => (
          <g key={b.label}>
            {b.values.map((v, j) => {
              const x = i * group + group / 2 + (j === 0 ? -25 : 5),
                h = (v / max) * plot;
              return (
                <g key={j}>
                  <rect
                    x={x}
                    y={base - h}
                    width={20}
                    height={h}
                    rx="4"
                    fill={j === 0 ? colors.purple : `url(#${id}-channel)`}
                    opacity={j === 0 ? 0.3 : 1}
                    stroke={colors.purple}
                    strokeWidth=".5"
                  />
                  <text
                    x={x + 10}
                    y={base - h - 8}
                    className="chart-value"
                    textAnchor="middle"
                  >
                    {formatNumber(v)}
                  </text>
                </g>
              );
            })}
            <text
              x={i * group + group / 2}
              y={base + 24}
              textAnchor="middle"
              className="chart-label"
            >
              {b.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
/** @dashboard Д2–Д3. A 100% reference line remains at its truthful scale. */
export function PlanBars({ bars }: { bars: Bar[] }) {
  const id = useId().replace(/:/g, "");
  const max = Math.max(
    115,
    ...bars.flatMap((b) => b.values).map((v) => v * 1.14),
  );
  const base = 155,
    plot = 126;
  return (
    <div className="plan-bars">
      <svg
        viewBox="0 0 260 196"
        role="img"
        aria-label={bars
          .map((b) => `${b.label}: ${formatPercent(b.values[0])}`)
          .join(", ")}
      >
        <defs>
          {seriesColors.map((c, i) => (
            <linearGradient
              key={c}
              id={`${id}-${i}`}
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop offset="0%" stopColor={c} />
              <stop offset="100%" stopColor={c} stopOpacity=".32" />
            </linearGradient>
          ))}
        </defs>
        <line
          x1="8"
          x2="252"
          y1={base - (100 / max) * plot}
          y2={base - (100 / max) * plot}
          className="plan-target"
        />
        <text
          x="252"
          y={base - (100 / max) * plot - 8}
          textAnchor="end"
          className="chart-label"
        >
          план 100%
        </text>
        {bars.map((b, i) => {
          const h = (b.values[0] / max) * plot;
          return (
            <g key={b.label}>
              <rect
                x={26 + i * 79}
                y={base - h}
                width="49"
                height={h}
                rx="6"
                fill={`url(#${id}-${i})`}
              />
              <text
                x={50 + i * 79}
                y={base - h - 9}
                textAnchor="middle"
                className="bar-percent"
              >
                {formatPercent(b.values[0])}
              </text>
              <text
                x={50 + i * 79}
                y="179"
                textAnchor="middle"
                className="chart-label"
              >
                {i === 0 ? "Всего" : b.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
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
  const coords = points
    .map(
      (v, i) =>
        `${(i / (points.length - 1)) * 80},${25 - ((v - min) / range) * 20}`,
    )
    .join(" ");
  return (
    <svg className="sparkline" viewBox="0 0 82 30" aria-hidden="true">
      <polyline
        points={coords}
        fill="none"
        stroke={color}
        strokeWidth="1.8"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
/** @dashboard Д2–Д3. Full values remain available in the focused data table. */
export function MetricRow({ metric }: { metric: Metric }) {
  const compact = useDashboardStore((s) => s.compact);
  return (
    <div className="metric-row">
      <i style={{ background: metric.color }} />
      <div className="metric-info">
        <span>{metric.label}</span>
        <strong title={`${formatNumber(metric.value)} ${metric.unit ?? ""}`}>
          {formatNumber(metric.value, compact)}
          {metric.unit && metric.unit !== "шт." ? (
            <small> {metric.unit}</small>
          ) : null}
        </strong>
      </div>
      <div className="metric-trend">
        <span style={{ color: metric.color }}>{metric.delta}</span>
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
  const total = slices.reduce((a, b) => a + b.value, 0);
  if (!total) return <Empty />;
  let cursor = 0;
  return (
    <div className="donut">
      <svg
        viewBox="0 0 150 150"
        role="img"
        aria-label={`${label}: ${center}. ${slices.map((s) => `${s.label}: ${formatNumber(s.value)}`).join(", ")}`}
      >
        <circle
          cx="75"
          cy="75"
          r="57"
          fill="none"
          stroke={colors.border}
          strokeWidth="12"
        />
        {slices.map((s) => {
          const size = (s.value / total) * 100,
            offset = cursor;
          cursor += size;
          return (
            <circle
              key={s.label}
              cx="75"
              cy="75"
              r="57"
              fill="none"
              stroke={s.color}
              strokeWidth="12"
              pathLength="100"
              strokeDasharray={`${size} ${100 - size}`}
              strokeDashoffset={-offset}
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
          {label}
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
  if (!days.length || !series.some((s) => s.points.length)) return <Empty />;
  const width = 420,
    base = 130,
    plot = 102,
    max = Math.max(1, ...series.flatMap((s) => s.points)) * 1.12;
  return (
    <div className="line-chart">
      <svg
        viewBox={`0 0 ${width} 160`}
        role="img"
        aria-label={series
          .map(
            (s) =>
              `${s.label}: ${s.points.map((n, i) => `${days[i]} — ${formatNumber(n)}`).join(", ")}`,
          )
          .join("; ")}
      >
        {[0, 0.5, 1].map((t) => (
          <g key={t}>
            <line
              x1="38"
              x2="410"
              y1={base - t * plot}
              y2={base - t * plot}
              className="chart-grid"
            />
            <text
              x="30"
              y={base - t * plot + 4}
              textAnchor="end"
              className="chart-label"
            >
              {formatNumber(Math.round(t * max), true)}
            </text>
          </g>
        ))}
        {series.map((s) => {
          const pts = s.points.map((v, i) => [
            38 + (i / Math.max(1, days.length - 1)) * 370,
            base - (v / max) * plot,
          ]);
          return (
            <g key={s.label}>
              {series.length === 1 ? (
                <polygon
                  points={`38,${base} ${pts.map((p) => p.join(",")).join(" ")} ${pts.at(-1)?.[0] ?? 38},${base}`}
                  fill={s.color}
                  opacity=".07"
                />
              ) : null}
              <polyline
                points={pts.map((p) => p.join(",")).join(" ")}
                fill="none"
                stroke={s.color}
                strokeWidth="2.3"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              {pts.map(([x, y], i) => (
                <circle key={i} cx={x} cy={y} r="2.8" fill={s.color} />
              ))}
            </g>
          );
        })}
        {days.map((d, i) =>
          i === 0 ||
          i === days.length - 1 ||
          i % Math.max(1, Math.ceil(days.length / 6)) === 0 ? (
            <text
              key={i}
              x={38 + (i / Math.max(1, days.length - 1)) * 370}
              y="153"
              textAnchor="middle"
              className="chart-label"
            >
              {d}
            </text>
          ) : null,
        )}
      </svg>
      <div className="chart-legend">
        {series.map((s) => (
          <span key={s.label}>
            <i style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}
