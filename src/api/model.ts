import type { DashboardData } from "./schema";
import {
  formatNumber,
  formatPercent,
  downtimeLabel,
  DOWNTIME_LIMIT,
} from "./format";
import { formatDelta, formatReportDate, t } from "../i18n";
import tokens from "../styles/tokens.json";
export const colors = tokens.colors;
export const seriesColors = [colors.cyan, colors.purple, colors.orange];
export type Gauge = {
  label: string;
  percent: number;
  value?: number;
  unit?: string;
  mode: "plan" | "downtime";
};
export type Metric = {
  label: string;
  value: number;
  unit?: string;
  delta?: string;
  spark?: number[];
  color: string;
};
export type Series = { label: string; points: number[]; color: string };
export type Bar = { label: string; values: number[] };
export type Slice = { label: string; value: number; color: string };
export type DashboardModel = {
  id: number;
  title: string;
  subtitle: string;
  kind: "channels" | "monthly" | "gauges" | "cash" | "staff" | "equipment";
  gauges: Gauge[];
  metrics: Metric[];
  bars: Bar[];
  series: Series[];
  days: string[];
  slices: Slice[];
  share?: number;
  unit?: string;
  facts: [string, string][];
};
export const titles: Record<number, string> = {
  1: "Платежи по каналам",
  2: "Количество платежей",
  3: "Объём платежей",
  4: "Платежи с начала года",
  5: "Операции в кассах",
  6: "Кассы с начала года",
  7: "Кассы и команда",
  8: "Операции устройств",
  9: "Объём операций устройств",
  10: "Состояние оборудования",
};
export function dashboardModel(
  data: DashboardData,
  id: number,
): DashboardModel {
  const p = data.block1_payments,
    c = data.block2_cashDesk,
    e = data.block3_atmTso;
  const m: DashboardModel = {
    id,
    title: t(titles[id]),
    subtitle: "",
    kind: "gauges",
    gauges: [],
    metrics: [],
    bars: [],
    series: [],
    days: [],
    slices: [],
    facts: [],
  };
  const plans = (
    items: { label: string; percent: number; value: number }[],
    currency: (i: number) => boolean,
  ) =>
    items.map((x, i): Gauge => ({
      ...x,
      label: t(x.label),
      mode: "plan",
      unit: currency(i) ? data.meta.currency : undefined,
    }));
  if (id === 1) {
    m.kind = "channels";
    m.subtitle = t("млн шт.");
    m.bars = p.dashboard1_channels.channels.map((x) => ({
      label: t(x.name),
      values: [x.jan, x.cur],
    }));
    m.share = p.dashboard1_channels.dboSharePercent;
    m.slices = [
      { label: t("В ДБО"), value: m.share, color: colors.purple },
      { label: t("В отделениях"), value: 100 - m.share, color: colors.border },
    ];
    m.facts = m.bars.flatMap(
      (x) =>
        [
          [
            `${x.label} · ${t("январь")}`,
            `${formatNumber(x.values[0])} ${t("млн шт.")}`,
          ],
          [
            `${x.label} · ${t("отчётный месяц")}`,
            `${formatNumber(x.values[1])} ${t("млн шт.")}`,
          ],
        ] as [string, string][],
    );
    m.facts.push([t("Доля в ДБО"), formatPercent(m.share)]);
  }
  if (id === 2 || id === 3) {
    const d = id === 2 ? p.dashboard2_monthlyCount : p.dashboard3_monthlyVolume;
    m.kind = "monthly";
    m.subtitle = t("План на месяц");
    m.unit = id === 3 ? data.meta.currency : t("шт.");
    m.bars = d.planBars.map((x) => ({
      label: t(x.label),
      values: [x.percent],
    }));
    m.metrics = d.cards.map((x, i) => ({
      label: t(x.title.replace(/ \(₴\)/g, "")),
      value: x.value,
      delta: formatDelta(x.delta),
      spark: x.spark,
      color: seriesColors[i],
      unit: m.unit,
    }));
    m.facts = [
      ...m.bars.map(
        (x) => [x.label, formatPercent(x.values[0])] as [string, string],
      ),
      ...m.metrics.map(
        (x) =>
          [x.label, `${formatNumber(x.value)} ${m.unit}`] as [string, string],
      ),
    ];
  }
  if (id === 4) {
    m.gauges = plans(p.dashboard4_ytdMain, (i) => i > 0);
    m.subtitle = t("План {period}", {
      period: formatReportDate(data.meta.ytdStartLabel),
    });
  }
  if (id === 5) {
    m.kind = "cash";
    m.subtitle = t("За месяц");
    m.slices = c.dashboard5_operationTypes.types.map((x) => ({
      label: t(x.name),
      value: x.count,
      color: x.color,
    }));
    m.gauges = [
      {
        label: t("Месячный план"),
        percent: c.dashboard5_operationTypes.monthlyPlanPercent,
        mode: "plan",
      },
    ];
    m.facts = m.slices.map((x) => [
      x.label,
      `${formatNumber(x.value)} ${t("шт.")}`,
    ]);
  }
  if (id === 6) {
    m.gauges = plans(c.dashboard6_ytdMain, (i) => i > 0);
    m.subtitle = t("План {period}", {
      period: formatReportDate(data.meta.ytdStartLabel),
    });
  }
  if (id === 7) {
    const d = c.dashboard7_operationsAndStaff;
    m.kind = "staff";
    m.series = [
      {
        label: t("Работающие кассы"),
        points: d.workingCashDesksByDay,
        color: colors.cyan,
      },
    ];
    m.days = d.workingCashDesksByDay.map((_, i) =>
      String(i + 1).padStart(2, "0"),
    );
    m.metrics = [
      {
        label: t("Открытые вакансии"),
        value: d.staffShortageVacancies,
        color: d.staffShortageVacancies > 20 ? colors.danger : colors.warning,
      },
    ];
    m.gauges = [
      {
        label: t("Простой сегодня"),
        percent: d.downtimeTodayPercent,
        mode: "downtime",
      },
    ];
    m.facts = [
      [t("Открытые вакансии"), formatNumber(d.staffShortageVacancies)],
    ];
  }
  if (id === 8 || id === 9) {
    m.gauges = plans(
      id === 8 ? e.dashboard8_operationsCount : e.dashboard9_operationsVolume,
      () => id === 9,
    );
    m.subtitle = t("Выполнение плана");
  }
  if (id === 10) {
    const d = e.dashboard10_workingEquipmentAndDowntime;
    m.kind = "equipment";
    m.subtitle = t("Работающие устройства");
    m.days = d.days;
    m.series = [
      { label: t("ТСО"), points: d.tsoLine, color: colors.success },
      { label: t("АТМ"), points: d.atmLine, color: colors.purple },
      { label: "Recycle", points: d.recLine, color: colors.cyan },
    ];
    m.gauges = d.downtime.map((x) => ({
      label: x.name === "Rec" ? "Recycle" : t(x.name),
      percent: x.percent,
      mode: "downtime",
    }));
  }
  m.facts.push(
    ...m.gauges.flatMap(
      (x) =>
        [
          [
            `${x.label} · ${t(x.mode === "plan" ? "выполнение плана" : "простой")}`,
            formatPercent(x.percent),
          ],
          ...(x.value === undefined
            ? []
            : [
                [
                  `${x.label} · ${t("значение")}`,
                  `${formatNumber(x.value)} ${x.unit ?? t("шт.")}`,
                ],
              ]),
        ] as [string, string][],
    ),
  );
  m.facts.push(
    ...m.series.flatMap((s) =>
      s.points.map(
        (v, i) =>
          [`${s.label} · ${t("день")} ${m.days[i]}`, formatNumber(v)] as [
            string,
            string,
          ],
      ),
    ),
  );
  return m;
}

/** Keep unavailable absolute targets explicit; never derive them from rounded percentages. */
export function comparisonRows(model: DashboardModel) {
  if (model.kind === "monthly")
    return model.metrics.map((metric, index) => ({
      label: metric.label,
      actual: `${formatNumber(metric.value)} ${model.unit ?? ""}`,
      reference: t("План 100%"),
      status: formatPercent(model.bars[index].values[0]),
    }));
  const gaugeLabels = model.gauges.map((g) => g.label);
  return [
    ...model.gauges.map((g) => ({
      label: g.label,
      actual:
        g.mode === "downtime"
          ? formatPercent(g.percent)
          : g.value === undefined
            ? t("Не передано")
            : `${formatNumber(g.value)} ${g.unit ?? t("шт.")}`,
      reference:
        g.mode === "downtime"
          ? `${t("Порог внимания")} ${formatPercent(DOWNTIME_LIMIT)}`
          : t("План 100%"),
      status:
        g.mode === "downtime"
          ? downtimeLabel(g.percent)
          : formatPercent(g.percent),
    })),
    ...model.facts
      .filter(
        ([label]) => !gaugeLabels.some((g) => label.startsWith(`${g} · `)),
      )
      .map(([label, actual]) => ({
        label,
        actual,
        reference: "—",
        status: "—",
      })),
  ];
}
