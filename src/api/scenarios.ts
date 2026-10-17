declare const __INITIAL_DASHBOARD_DATA__: unknown;
import { parseData, type DashboardData } from "./schema";
export const baseline = parseData(__INITIAL_DASHBOARD_DATA__);
export type Scenario = "baseline" | "stress" | "yearend";
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
        x.percent = 102 + i;
        x.value = Math.round(x.value * 12);
      });
    for (const m of [
      d.block1_payments.dashboard2_monthlyCount,
      d.block1_payments.dashboard3_monthlyVolume,
    ]) {
      m.planBars.forEach((x, i) => {
        x.percent = 102 + i;
      });
      m.cards.forEach((x) => {
        x.value = Math.round(x.value * 1.12);
        x.delta = "+12%";
        x.spark = x.spark.map((p) => p * 1.12);
      });
    }
    d.block2_cashDesk.dashboard5_operationTypes.monthlyPlanPercent = 102;
    d.block2_cashDesk.dashboard7_operationsAndStaff.staffShortageVacancies = 4;
    d.block3_atmTso.dashboard10_workingEquipmentAndDowntime.downtime.forEach(
      (x) => {
        x.percent = 1.4;
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
  return d;
}
