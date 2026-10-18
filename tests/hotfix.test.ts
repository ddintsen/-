import { describe, expect, it } from "vitest";
import { attentionItems } from "../src/api/attention";
import { comparisonRows, dashboardModel } from "../src/api/model";
import { baseline } from "../src/api/scenarios";
import { parseData } from "../src/api/schema";
import { meterMaximum, DOWNTIME_LIMIT } from "../src/api/format";
import { spatialStands, FOCUS_ROWS } from "../src/spatial/layout";

describe("Operational hotfix", () => {
  it("shows only Recycle downtime and recurring monthly payments, not normal October YTD", () => {
    const models = Array.from({ length: 10 }, (_, i) =>
      dashboardModel(baseline, i + 1),
    );
    const alerts = attentionItems(models);
    expect(alerts.map((a) => [a.id, a.percent])).toEqual([
      [10, 7.2],
      [2, 84],
    ]);
    for (const model of models.filter((m) => [4, 6].includes(m.id)))
      model.gauges.forEach((g) => (g.percent = 10));
    expect(attentionItems(models).map((a) => a.id)).toEqual([10, 2]);
  });
  it("draws downtime against a 0..10 scale and the requested 5% reference", () => {
    expect(DOWNTIME_LIMIT).toBe(5);
    expect(1.7 / meterMaximum(1.7, "downtime")).toBeCloseTo(0.17);
    expect(7.2 / meterMaximum(7.2, "downtime")).toBeCloseTo(0.72);
    expect(meterMaximum(14.8, "downtime")).toBeGreaterThanOrEqual(14.8);
  });
  it("keeps ten independent panels on three simultaneous equal-height stands", () => {
    expect(spatialStands).toHaveLength(3);
    expect(
      spatialStands
        .flatMap((s) => s.panels.map((p) => p.id))
        .sort((a, b) => a - b),
    ).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(
      spatialStands.map((s) => Math.round(Math.hypot(s.x, s.z) * 100)),
    ).toEqual([185, 185, 185]);
    expect(
      spatialStands.map((s) => Math.round((s.angle * 180) / Math.PI)),
    ).toEqual([24, 0, -24]);
    const equipment = spatialStands[2].panels;
    expect(equipment.find((p) => p.id === 10)!.width).toBeGreaterThan(
      equipment.find((p) => p.id === 8)!.width * 2,
    );
  });
  it("fits every baseline equipment fact on one combined focus panel", () => {
    const equipment = dashboardModel(baseline, 10);
    expect(equipment.facts.length).toBeGreaterThan(3);
    expect(equipment.facts.length).toBeLessThanOrEqual(FOCUS_ROWS);
    expect(equipment.series).toHaveLength(3);
  });
  it("does not invent absolute plans from rounded percentages", () => {
    for (const id of [2, 3, 4, 6, 8, 9]) {
      const model = dashboardModel(baseline, id);
      const rows = comparisonRows(model);
      expect(rows.length).toBeGreaterThan(0);
      expect(rows.every((row) => row.reference === "Не передано")).toBe(true);
    }
    expect(comparisonRows(dashboardModel(baseline, 10))).toHaveLength(21);
    expect(comparisonRows(dashboardModel(baseline, 10))[0].reference).toBe(
      "SLA 5%",
    );
    const withPlans = structuredClone(baseline);
    withPlans.block1_payments.dashboard2_monthlyCount.planBars[0].planValue = 60_738_115;
    withPlans.block1_payments.dashboard4_ytdMain[0].planValue = 700_000_000;
    const parsed = parseData(withPlans);
    expect(comparisonRows(dashboardModel(parsed, 2))[0].reference).toContain(
      "738",
    );
    expect(comparisonRows(dashboardModel(parsed, 4))[0].reference).toContain(
      "700",
    );
  });
});
