declare const __INITIAL_DASHBOARD_DATA__: unknown;
import { parseData, type DashboardData } from "./schema";
export const baseline = parseData(__INITIAL_DASHBOARD_DATA__);
export type Scenario = "baseline" | "stress" | "yearend";

/** Keep linked demo views consistent without losing whole transactions to rounding. */
function syncMonthlyChannels(data: DashboardData) {
  const channels = data.block1_payments.dashboard1_channels;
  const counts = channels.channels.map((channel) =>
    Math.round(channel.cur * 1e6),
  );
  const previousTotal = counts.reduce((sum, count) => sum + count, 0);
  if (!previousTotal) return;
  const total = data.block1_payments.dashboard2_monthlyCount.cards[0].value;
  const scaled = counts.map((count) =>
    Math.floor((count * total) / previousTotal),
  );
  const remainder = total - scaled.reduce((sum, count) => sum + count, 0);
  const largest = counts.indexOf(Math.max(...counts));
  scaled[largest] += remainder;
  channels.channels.forEach((channel, index) => {
    channel.cur = scaled[index] / 1e6;
  });
  const cash = channels.channels.find((channel) => channel.name === "Кассы");
  if (cash) {
    channels.dboSharePercent =
      Math.round((1 - (cash.cur * 1e6) / total) * 1000) / 10;
    const operations = data.block2_cashDesk.dashboard5_operationTypes;
    const payments = operations.types.find((type) => type.name === "Платежи");
    const previousCashTotal = operations.types.reduce(
      (sum, type) => sum + type.count,
      0,
    );
    if (payments) {
      payments.count = Math.round(cash.cur * 1e6);
      if (previousCashTotal > 0) {
        const cashTotal = operations.types.reduce(
          (sum, type) => sum + type.count,
          0,
        );
        operations.monthlyPlanPercent =
          Math.round(
            ((operations.monthlyPlanPercent * cashTotal) / previousCashTotal) *
              10,
          ) / 10;
      }
    }
  }
}

export function makeScenario(scenario: Scenario): DashboardData {
  const d = structuredClone(baseline);
  if (scenario === "stress") {
    d.block2_cashDesk.dashboard7_operationsAndStaff.staffShortageVacancies = 38;
    d.block2_cashDesk.dashboard7_operationsAndStaff.downtimeTodayPercent = 8.4;
    const e = d.block3_atmTso.dashboard10_workingEquipmentAndDowntime;
    e.downtime[1].percent = 14.8;
    e.downtime[0].percent = 7.2;
    e.atmLine = e.atmLine.map((n, i) => Math.round(n * (1 - i * 0.045)));
  }
  if (scenario === "yearend") {
    d.meta.reportDate = "Декабрь 2026";
    for (const group of [
      d.block1_payments.dashboard4_ytdMain,
      d.block2_cashDesk.dashboard6_ytdMain,
      d.block3_atmTso.dashboard8_operationsCount,
      d.block3_atmTso.dashboard9_operationsVolume,
    ])
      group.forEach((x, i) => {
        const percent = 102 + i;
        // These demo percentages define the same illustrative plan before/after.
        x.value = Math.round((x.value * percent) / x.percent);
        x.percent = percent;
      });
    for (const m of [
      d.block1_payments.dashboard2_monthlyCount,
      d.block1_payments.dashboard3_monthlyVolume,
    ]) {
      const previous = m.cards.map((card) => card.value);
      m.cards.forEach((x) => {
        x.value = Math.round(x.value * 1.12);
        x.delta = "+12%";
        x.spark = x.spark.map((p) => p * 1.12);
      });
      m.cards[0].value = m.cards[1].value + m.cards[2].value;
      m.planBars.forEach((x, i) => {
        x.percent =
          Math.round(((x.percent * m.cards[i].value) / previous[i]) * 10) / 10;
      });
    }
    syncMonthlyChannels(d);
    d.block2_cashDesk.dashboard7_operationsAndStaff.staffShortageVacancies = 4;
    d.block3_atmTso.dashboard10_workingEquipmentAndDowntime.downtime.forEach(
      (x, index) => {
        x.percent = [0.9, 1.2, 1.6][index];
      },
    );
  }
  return parseData(d);
}
export function simulateTick(data: DashboardData): DashboardData {
  const d = structuredClone(data);
  for (const m of [
    d.block1_payments.dashboard2_monthlyCount,
    d.block1_payments.dashboard3_monthlyVolume,
  ]) {
    const inc1 = 100 + Math.floor(Math.random() * 150),
      inc2 = 60 + Math.floor(Math.random() * 100);
    m.cards[1].value += inc1;
    m.cards[2].value += inc2;
    m.cards[0].value += inc1 + inc2;
  }
  syncMonthlyChannels(d);
  return d;
}
