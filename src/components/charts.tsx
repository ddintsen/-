import { useEffect, useId, useRef, useState } from "react";
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
import { t, useLocale } from "../i18n";
import { Empty } from "./ui";

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

/** @dashboard Д4–Д10. Exact percentages; plan and downtime retain independent semantics. */
export function ArcGauge({
  gauge,
  small = false,
}: {
  gauge: Gauge;
  small?: boolean;
}) {
  useLocale();
  const compact = useDashboardStore((s) => s.compact);
  const tone = gaugeTone(gauge.percent, gauge.mode);
  const downtime = gauge.mode === "downtime";
  const label = t(gauge.label);
  const status = downtime ? downtimeLabel(gauge.percent) : t("План 100%");
  const actual =
    gauge.value === undefined
      ? undefined
      : `${formatNumber(gauge.value)} ${gauge.unit ?? t("шт.")}`;
  return (
    <div className={`progress-gauge ${small ? "small" : ""}`} data-tone={tone}>
      <div className="progress-heading">
        <span className="progress-label">{label}</span>
        <strong className="progress-percent" style={{ color: colors[tone] }}>
          {formatPercent(gauge.percent)}
        </strong>
      </div>
      <div
        className="progress-track"
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.min(100, Math.max(0, gauge.percent))}
        aria-valuetext={`${formatPercent(gauge.percent)}; ${status}${actual ? `; ${t("Факт")}: ${actual}` : ""}`}
      >
        <span
          className="progress-fill"
          style={{
            width: `${Math.min(100, Math.max(0, gauge.percent))}%`,
            background: colors[tone],
          }}
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
        <span className="progress-reference">{status}</span>
      </div>
    </div>
  );
}
/** @dashboard Д1. Paired series share a zero baseline and visible values. */
export function GroupedBars({ bars }: { bars: Bar[] }) {
  useLocale();
  const id = useId().replace(/:/g, "");
  const { ref, width } = useChartWidth(480);
  if (!bars.length) return <Empty />;
  const height = 210,
    base = 160,
    plot = 114,
    max = Math.max(1, ...bars.flatMap((b) => b.values)) * 1.2,
    group = width / bars.length,
    barWidth = Math.max(8, Math.min(24, (group - 36) / 2)),
    pairGap = Math.max(10, Math.min(18, group * 0.14));
  const valueLabels: {
    x: number;
    y: number;
    text: string;
    halfWidth: number;
  }[] = [];
  bars.forEach((bar, i) =>
    bar.values.forEach((value, j) => {
      const text = formatNumber(value);
      const label = {
        x:
          i * group +
          group / 2 +
          (j === 0 ? -(barWidth + pairGap) / 2 : (barWidth + pairGap) / 2),
        y: base - (value / max) * plot - 8,
        text,
        halfWidth: text.length * 3.9,
      };
      // Make room above the true bar rather than shrinking the financial labels.
      let collision;
      do {
        collision = valueLabels.find(
          (other) =>
            Math.abs(label.x - other.x) <
              label.halfWidth + other.halfWidth + 3 &&
            Math.abs(label.y - other.y) < 18,
        );
        if (collision) label.y = collision.y - 18;
      } while (collision);
      valueLabels.push(label);
    }),
  );
  return (
    <div className="grouped-bars" ref={ref}>
      <div className="chart-legend">
        <span>
          <i style={{ background: colors.purple, opacity: 0.5 }} />
          {t("Январь")}
        </span>
        <span>
          <i style={{ background: colors.purple }} />
          {t("Отчётный месяц")}
        </span>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={t("Платежи по каналам: январь и отчётный месяц, млн шт.")}
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
        {bars.map((b, i) => {
          const label = t(b.label === "Автоплат." ? "Автоплатежи" : b.label);
          const labelLines = label
            .replace(/^Авто(?=плат)/, "Авто ")
            .replace(/-/g, "- ")
            .split(" ");
          return (
            <g key={b.label}>
              {b.values.map((v, j) => {
                const valueLabel = valueLabels[i * 2 + j];
                const x =
                    i * group +
                    group / 2 +
                    (j === 0 ? -barWidth - pairGap / 2 : pairGap / 2),
                  h = (v / max) * plot;
                return (
                  <g key={j}>
                    <rect
                      x={x}
                      y={base - h}
                      width={barWidth}
                      height={h}
                      rx="4"
                      fill={j === 0 ? colors.purple : `url(#${id}-channel)`}
                      opacity={j === 0 ? 0.3 : 1}
                      stroke={colors.purple}
                      strokeWidth=".5"
                    />
                    <text
                      x={x + barWidth / 2}
                      y={valueLabel.y}
                      className="chart-value"
                      textAnchor="middle"
                      style={{ fontSize: 12 }}
                    >
                      {formatNumber(v)}
                    </text>
                  </g>
                );
              })}
              <text
                x={i * group + group / 2}
                y={base + 23}
                textAnchor="middle"
                className="chart-label"
                style={{ fontSize: 12 }}
              >
                {labelLines.map((line, index) => (
                  <tspan
                    key={index}
                    x={i * group + group / 2}
                    dy={index ? 15 : 0}
                  >
                    {line}
                  </tspan>
                ))}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
/** @dashboard Д2–Д3. A 100% reference line remains at its truthful scale. */
export function PlanBars({ bars }: { bars: Bar[] }) {
  useLocale();
  const id = useId().replace(/:/g, "");
  const { ref, width } = useChartWidth(260);
  const max = Math.max(
    115,
    ...bars.flatMap((b) => b.values).map((v) => v * 1.14),
  );
  const base = 162,
    plot = 126,
    group = width / Math.max(1, bars.length),
    barWidth = Math.min(49, group * 0.58),
    targetY = base - (100 / max) * plot;
  return (
    <div className="plan-bars" ref={ref}>
      <svg
        viewBox={`0 0 ${width} 208`}
        role="img"
        aria-label={bars
          .map((b) => `${t(b.label)}: ${formatPercent(b.values[0])}`)
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
          x2={width - 8}
          y1={targetY}
          y2={targetY}
          className="plan-target"
        />
        <text x="10" y="17" className="chart-label" style={{ fontSize: 12 }}>
          {t("План 100%")}
        </text>
        {bars.map((b, i) => {
          const h = (b.values[0] / max) * plot;
          const top = base - h;
          const candidate = h < 38 ? top - 9 : top + 24;
          const valueY =
            Math.abs(candidate - targetY) < 18 ? targetY + 25 : candidate;
          const center = group * (i + 0.5);
          return (
            <g key={b.label}>
              <rect
                x={center - barWidth / 2}
                y={base - h}
                width={barWidth}
                height={h}
                rx="6"
                fill={`url(#${id}-${i})`}
              />
              <text
                x={center}
                y={valueY}
                textAnchor="middle"
                className="bar-percent"
                style={{
                  fontSize: 15,
                  fill: h < 38 ? colors.text : colors["on-primary"],
                }}
              >
                {formatPercent(b.values[0])}
              </text>
              <text
                x={center}
                y="187"
                textAnchor="middle"
                className="chart-label"
                style={{ fontSize: 12 }}
              >
                {i === 0 ? t("Всего") : t(b.label)}
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
  useLocale();
  const total = slices.reduce((a, b) => a + b.value, 0);
  if (!total) return <Empty />;
  let cursor = 0;
  return (
    <div className="donut">
      <svg
        viewBox="0 0 150 150"
        role="img"
        aria-label={`${t(label)}: ${center}. ${slices.map((s) => `${t(s.label)}: ${formatNumber(s.value)}`).join(", ")}`}
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
  const { ref, width } = useChartWidth(420);
  if (!days.length || !series.some((s) => s.points.length)) return <Empty />;
  const left = 62,
    right = width - 12,
    base = 130,
    plot = 102,
    max = Math.max(1, ...series.flatMap((s) => s.points)) * 1.12;
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
        {[0, 0.5, 1].map((t) => (
          <g key={t}>
            <line
              x1={left}
              x2={right}
              y1={base - t * plot}
              y2={base - t * plot}
              className="chart-grid"
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
          return (
            <g key={s.label}>
              {series.length === 1 ? (
                <polygon
                  points={`${left},${base} ${pts.map((p) => p.join(",")).join(" ")} ${pts.at(-1)?.[0] ?? left},${base}`}
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
            <i style={{ background: s.color }} />
            {t(s.label)}
          </span>
        ))}
      </div>
    </div>
  );
}
