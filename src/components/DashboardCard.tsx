import { Maximize2 } from "lucide-react";
import type { ReactNode } from "react";
import { comparisonRows, type DashboardModel } from "../api/model";
import { formatNumber, formatPercent } from "../api/format";
import { useDashboardStore } from "../store/dashboard";
import { t, useLocale } from "../i18n";
import {
  ArcGauge,
  GroupedBars,
  PlanBars,
  MetricRow,
  Sparkline,
  Donut,
  LineChart,
} from "./charts";
import { Button } from "./ui";

/** @dashboard Д1–Д10. One shared card/view adapter drives overview and Deep Focus. */
export function DashboardContent({ model: m }: { model: DashboardModel }) {
  useLocale();
  const compact = useDashboardStore((s) => s.compact);
  if (m.kind === "channels")
    return (
      <div className="channels-layout">
        <GroupedBars bars={m.bars} />
        <div className="dbo-share">
          <Donut
            slices={m.slices}
            center={formatPercent(m.share ?? 0)}
            label={t("доля в ДБО")}
          />
          <div className="chart-legend">
            <span>
              {t("В отделениях")} {formatPercent(100 - (m.share ?? 0))}
            </span>
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
            label={t("операций")}
          />
          <ArcGauge gauge={m.gauges[0]} small />
        </div>
        <div className="slice-legend">
          {m.slices.map((s) => (
            <div key={s.label}>
              <span>
                <i style={{ background: s.color }} />
                {t(s.label)}
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
            <strong
              style={{
                color:
                  m.metrics[0].value > 20
                    ? "var(--color-danger)"
                    : "var(--color-warning)",
              }}
            >
              {m.metrics[0].value}
              <span>{t("вакансий")}</span>
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
        <p>{t("Простой")}</p>
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
  controls,
  comparison,
}: {
  model: DashboardModel;
  onFocus: (id: number) => void;
  controls?: ReactNode;
  comparison?: DashboardModel;
}) {
  useLocale();
  return (
    <article
      className={`dashboard-card card-${model.id}`}
      data-dashboard-id={model.id}
    >
      <header className="card-heading">
        <div>
          <div className="card-title">
            <h3>{t(comparison ? "Месячный план платежей" : model.title)}</h3>
          </div>
          {model.subtitle ? <p>{t(model.subtitle)}</p> : null}
        </div>
        <Button
          className="focus-button icon-button"
          aria-label={`${t("В фокус")}: ${t(model.title)}`}
          title={t("В фокус")}
          onClick={() => onFocus(model.id)}
        >
          <Maximize2 size={15} />
        </Button>
      </header>
      {controls ? <div className="card-controls">{controls}</div> : null}
      {comparison ? (
        <div className="monthly-comparison">
          {[model, comparison].map((item) => (
            <section key={item.id}>
              <Button onClick={() => onFocus(item.id)}>{item.title}</Button>
              <strong>
                {formatNumber(item.metrics[0].value, true)} {item.unit}
                <small> / {formatPercent(item.bars[0].values[0])}</small>
              </strong>
              <Sparkline
                points={item.metrics[0].spark ?? []}
                color={item.metrics[0].color}
              />
              <dl>
                {item.bars.slice(1).map((bar) => (
                  <div key={bar.label}>
                    <dt>{bar.label}</dt>
                    <dd>{formatPercent(bar.values[0])}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
      ) : (
        <DashboardContent model={model} />
      )}
    </article>
  );
}
export function DataTable({ model }: { model: DashboardModel }) {
  useLocale();
  return (
    <details className="data-details" open>
      <summary>{t("Точные значения")}</summary>
      <div className="table-scroll">
        <table>
          <caption className="sr-only">
            {t(model.title)}: {t("Точные значения")}
          </caption>
          <thead>
            <tr>
              <th scope="col">{t("Показатель")}</th>
              <th scope="col">{t("Факт")}</th>
              <th scope="col">{t("План / Порог")}</th>
              <th scope="col">{t("Выполнение / Статус")}</th>
            </tr>
          </thead>
          <tbody>
            {comparisonRows(model).map(
              ({ label, actual, reference, status }, i) => (
                <tr key={i}>
                  <th scope="row">{t(label)}</th>
                  <td>{actual}</td>
                  <td>{reference}</td>
                  <td>{status}</td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>
    </details>
  );
}
