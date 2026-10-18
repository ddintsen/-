import { afterEach, describe, expect, it } from "vitest";
import {
  formatDelta,
  formatReportDate,
  getLocale,
  localizeJsonDates,
  setLocale,
  t,
} from "../src/i18n";
import {
  formatNumber,
  formatPercent,
  formatSource,
  formatTime,
} from "../src/api/format";
import { dashboardModel } from "../src/api/model";
import { baseline } from "../src/api/scenarios";
import { parseData } from "../src/api/schema";

afterEach(() => setLocale("uk"));

describe("Language and report formatting", () => {
  it("projects editor dates in three languages without altering drafts or custom periods", () => {
    const original = JSON.stringify(baseline, null, 2);
    for (const [language, report, since] of [
      ["uk", "Жовтень 2026", "з 01.01.2026"],
      ["en", "October 2026", "since 01.01.2026"],
      ["ru", "Октябрь 2026", "с 01.01.2026"],
    ] as const) {
      setLocale(language);
      expect(JSON.parse(localizeJsonDates(original)).meta).toMatchObject({
        reportDate: report,
        ytdStartLabel: since,
      });
      expect(localizeJsonDates('{"meta":')).toBe('{"meta":');
      expect(
        localizeJsonDates('{"reportDate":"Custom fiscal period"}'),
      ).toContain("Custom fiscal period");
    }
    expect(JSON.stringify(baseline, null, 2)).toBe(original);
  });
  it("starts in Ukrainian and translates known labels without changing custom API text", () => {
    setLocale("uk");
    expect(getLocale()).toBe("uk");
    expect(t("Обзор")).toBe("Огляд");
    expect(t("Отбросить изменения")).toBe("Відкинути зміни");
    const custom = "Кассы North / Contract Q4 — customer-defined";
    expect(t(custom)).toBe(custom);
    setLocale("en");
    expect(t("Обзор")).toBe("Overview");
    expect(t(custom)).toBe(custom);
    for (const inheritedKey of ["constructor", "__proto__", "toString"])
      expect(t(inheritedKey)).toBe(inheritedKey);
  });

  it.each([
    ["uk", "55\u00a0089\u00a0470", "55,1 млн", "4,6%", "+2,3%"],
    ["en", "55,089,470", "55.1M", "4.6%", "+2.3%"],
    ["ru", "55\u00a0089\u00a0470", "55,1 млн", "4,6%", "+2,3%"],
  ] as const)(
    "formats exact values, compact values and percentages in %s",
    (locale, exact, compact, percent, delta) => {
      setLocale(locale);
      expect(formatNumber(55089470)).toBe(exact);
      expect(formatNumber(55089470, true)).toBe(compact);
      expect(formatPercent(4.6)).toBe(percent);
      expect(formatDelta("+2.3%")).toBe(delta);
      expect(formatDelta("customer-defined delta")).toBe(
        "customer-defined delta",
      );
    },
  );

  it.each([
    ["uk", "Жовтень 2026", "Демодані", "Останній знімок API"],
    ["en", "October 2026", "Demo data", "Latest API snapshot"],
    ["ru", "Октябрь 2026", "Демоданные", "Последний снимок API"],
  ] as const)(
    "formats report metadata and truthful data source state in %s",
    (locale, period, demo, stale) => {
      setLocale(locale);
      expect(formatReportDate("Октябрь 2026")).toBe(period);
      expect(formatSource("mock")).toBe(demo);
      expect(formatSource("fallback", true)).toBe(stale);
      expect(formatReportDate("Q4 executive review — customer period")).toBe(
        "Q4 executive review — customer period",
      );
      expect(formatReportDate("2026-02-31")).toBe("2026-02-31");
      // 21:05 UTC crosses into the next day in Kyiv; the clock remains Kyiv in every language.
      expect(formatTime(Date.UTC(2026, 9, 17, 21, 5, 7))).toBe("00:05:07");
    },
  );

  it("rebuilds model labels and exact facts in the selected language without mutating data", () => {
    const source = structuredClone(baseline);
    source.block1_payments.dashboard1_channels.channels[0].name =
      "Enterprise Q4 channel";
    const original = JSON.stringify(source);
    setLocale("uk");
    const ukrainian = dashboardModel(source, 1);
    expect(ukrainian.title).toBe("Платежі за каналами");
    expect(ukrainian.facts[0][0]).toBe("Enterprise Q4 channel · січень");
    setLocale("en");
    const english = dashboardModel(source, 1);
    expect(english.title).toBe("Payments by channel");
    expect(english.facts[0][0]).toBe("Enterprise Q4 channel · January");
    expect(english.bars[0].label).toBe("Enterprise Q4 channel");
    expect(JSON.stringify(source)).toBe(original);
  });

  it("localizes schema errors with the failing API path intact", () => {
    const invalid = structuredClone(baseline);
    Reflect.set(
      invalid.block1_payments.dashboard2_monthlyCount.cards[0],
      "value",
      "wrong type",
    );
    let message = "";
    try {
      parseData(invalid);
    } catch (error) {
      message = (error as Error).message;
    }
    setLocale("uk");
    expect(t(message)).toBe(
      "Перевірте block1_payments.dashboard2_monthlyCount.cards.0.value: Очікується число; отримано: рядок.",
    );
    setLocale("en");
    expect(t(message)).toBe(
      "Check block1_payments.dashboard2_monthlyCount.cards.0.value: Expected number; received: string.",
    );
  });

  it("normalizes the legacy Recycle alias for display while preserving saved API data", () => {
    const legacy = structuredClone(baseline);
    legacy.block3_atmTso.dashboard10_workingEquipmentAndDowntime.downtime[2].name =
      "Rec";
    const original = structuredClone(legacy);
    for (const locale of ["uk", "en", "ru"] as const) {
      setLocale(locale);
      const model = dashboardModel(legacy, 10);
      expect(model.gauges[2].label).toBe("Recycle");
      expect(model.gauges[2].label).toBe(model.series[2].label);
      expect(model.gauges[2].percent).toBe(
        legacy.block3_atmTso.dashboard10_workingEquipmentAndDowntime.downtime[2]
          .percent,
      );
    }
    expect(legacy).toEqual(original);
    expect(
      legacy.block3_atmTso.dashboard10_workingEquipmentAndDowntime.downtime[2]
        .name,
    ).toBe("Rec");
  });
});
