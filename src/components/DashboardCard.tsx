import { Maximize2 } from "lucide-react";
import { type DashboardModel } from "../api/model";
import { formatNumber, formatPercent } from "../api/format";
import { useDashboardStore } from "../store/dashboard";
import {
  ArcGauge,
  GroupedBars,
  PlanBars,
  MetricRow,
  Donut,
  LineChart,
} from "./charts";
import { Button } from "./ui";

/** @dashboard Д1–Д10. One shared card/view adapter drives overview and Deep Focus. */
export function DashboardContent({ model: m }: { model: DashboardModel }) {
  const compact = useDashboardStore((s) => s.compact);
  if (m.kind === "channels")
    return (
      <div className="channels-layout">
        <GroupedBars bars={m.bars} />
        <div className="dbo-share">
          <Donut
            slices={m.slices}
            center={formatPercent(m.share ?? 0)}
            label="доля в ДБО"
          />
          <div className="chart-legend">
            <span>В отделениях {formatPercent(100 - (m.share ?? 0))}</span>
          </div>
        </div>
      </div>
    );
  if (m.kind === "monthly")
    return (
      <div className="monthly-layout">
        <PlanBars bars={m.bars} />
        <div className="metric-list">
          {m.metrics.map((x) => (
            <MetricRow key={x.label} metric={x} />
          ))}
        </div>
      </div>
    );
  if (m.kind === "gauges")
    return (
      <div className="gauges-row">
        {m.gauges.map((g) => (
          <ArcGauge key={g.label} gauge={g} />
        ))}
      </div>
    );
  if (m.kind === "cash")
    return (
      <div className="cash-layout">
        <div className="cash-pie">
          <Donut
            slices={m.slices}
            center={formatNumber(
              m.slices.reduce((a, b) => a + b.value, 0),
              true,
            )}
            label="операций"
          />
          <ArcGauge gauge={m.gauges[0]} small />
        </div>
        <div className="slice-legend">
          {m.slices.map((s) => (
            <div key={s.label}>
              <span>
                <i style={{ background: s.color }} />
                {s.label}
              </span>
              <strong title={formatNumber(s.value)}>
                {formatNumber(s.value, compact)}
              </strong>
            </div>
          ))}
        </div>
      </div>
    );
  if (m.kind === "staff")
    return (
      <>
        <LineChart series={m.series} days={m.days} />
        <div className="staff-bottom">
          <div className="vacancy">
            <strong style={{ color: m.metrics[0].color }}>
              {m.metrics[0].value}
              <span>вакансий</span>
            </strong>
          </div>
          <ArcGauge gauge={m.gauges[0]} small />
        </div>
      </>
    );
  return (
    <>
      <LineChart series={m.series} days={m.days} />
      <div className="equipment-downtime">
        <p>Простой</p>
        <div className="gauges-row equipment-gauges">
          {m.gauges.map((g) => (
            <ArcGauge key={g.label} gauge={g} small />
          ))}
        </div>
      </div>
    </>
  );
}
export function DashboardCard({
  model,
  onFocus,
}: {
  model: DashboardModel;
  onFocus: (id: number) => void;
}) {
  return (
    <article
      className={`dashboard-card card-${model.id}`}
      data-dashboard-id={model.id}
    >
      <header className="card-heading">
        <div>
          <div className="card-title">
            <h3>{model.title}</h3>
          </div>
          {model.subtitle ? <p>{model.subtitle}</p> : null}
        </div>
        <Button
          className="focus-button icon-button"
          aria-label={`В фокус: ${model.title}`}
          title="В фокус"
          onClick={() => onFocus(model.id)}
        >
          <Maximize2 size={15} />
        </Button>
      </header>
      <DashboardContent model={model} />
    </article>
  );
}
export function DataTable({ model }: { model: DashboardModel }) {
  return (
    <details className="data-details">
      <summary>Точные значения</summary>
      <div className="table-scroll">
        <table>
          <caption className="sr-only">{model.title}: точные значения</caption>
          <thead>
            <tr>
              <th scope="col">Показатель</th>
              <th scope="col">Значение</th>
            </tr>
          </thead>
          <tbody>
            {model.facts.map(([label, value], i) => (
              <tr key={i}>
                <th scope="row">{label}</th>
                <td>{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
