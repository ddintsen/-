import { describe, it, expect, vi, afterEach } from "vitest";
import { baseline, makeScenario, simulateTick } from "../src/api/scenarios";
import {
  dashboardSchema,
  parseData,
  validateEndpoint,
  type ApiConfig,
} from "../src/api/schema";
import { dashboardModel } from "../src/api/model";
import { gaugeTone, formatNumber } from "../src/api/format";
import { loadData, requestData } from "../src/api/client";
const config: ApiConfig = {
  mode: "hybrid",
  url: "https://example.com/dashboard",
  token: "test-only",
  pollingSec: 0,
};
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});
describe("Complete dashboard contract", () => {
  it("accepts the supplied source unchanged and covers all 10 models", () => {
    expect(parseData(baseline)).toEqual(baseline);
    for (let id = 1; id <= 10; id++) {
      const m = dashboardModel(baseline, id);
      expect(m.title).toBeTruthy();
      expect(m.facts.length).toBeGreaterThan(0);
    }
  });
  it.each([NaN, Infinity, -1])(
    "rejects invalid numeric values: %s",
    (value) => {
      const data = structuredClone(baseline);
      data.block1_payments.dashboard2_monthlyCount.cards[0].value = value;
      expect(dashboardSchema.safeParse(data).success).toBe(false);
    },
  );
  it("rejects missing nested widgets, not only missing top-level blocks", () => {
    const data = structuredClone(baseline) as any;
    delete data.block2_cashDesk.dashboard7_operationsAndStaff;
    expect(() => parseData(data)).toThrow("dashboard7_operationsAndStaff");
  });
  it("rejects mismatched days and line points", () => {
    const data = structuredClone(baseline);
    data.block3_atmTso.dashboard10_workingEquipmentAndDowntime.days.pop();
    expect(() => parseData(data)).toThrow("tsoLine");
  });
  it("allows empty series for honest empty states", () => {
    const d = structuredClone(baseline);
    d.block1_payments.dashboard1_channels.channels = [];
    d.block2_cashDesk.dashboard7_operationsAndStaff.workingCashDesksByDay = [];
    expect(dashboardSchema.safeParse(d).success).toBe(true);
  });
  it("preserves periods, units and independently sourced monthly values", () => {
    expect(dashboardModel(baseline, 3).unit).toBe("₴");
    expect(dashboardModel(baseline, 2).metrics[0].value).toBe(55089470);
    expect(dashboardModel(baseline, 4).gauges[1].value).toBe(80722842308);
  });
});
describe("Business semantics", () => {
  it.each([
    [0, "success"],
    [2, "success"],
    [2.01, "warning"],
    [6.5, "warning"],
    [6.5001, "danger"],
    [100, "danger"],
  ] as const)("downtime %s is %s", (percent, tone) =>
    expect(gaugeTone(percent, "downtime")).toBe(tone),
  );
  it.each([0, 5.2, 8.3, 102])("plan %s is never colored as downtime", (n) =>
    expect(gaugeTone(n, "plan")).toBe("success"),
  );
  it("keeps the base fixture immutable across scenarios", () => {
    const before = JSON.stringify(baseline);
    const stress = makeScenario("stress");
    expect(
      stress.block3_atmTso.dashboard10_workingEquipmentAndDowntime.downtime[1]
        .percent,
    ).toBe(14.8);
    expect(
      makeScenario("yearend").block1_payments.dashboard4_ytdMain[0].percent,
    ).toBe(102);
    expect(JSON.stringify(baseline)).toBe(before);
  });
  it("simulation changes only mock values and keeps monthly total in sync", () => {
    const d = simulateTick(baseline);
    const cards = d.block1_payments.dashboard2_monthlyCount.cards;
    expect(cards[0].value).toBe(cards[1].value + cards[2].value);
    expect(
      baseline.block1_payments.dashboard2_monthlyCount.cards[0].value,
    ).toBe(55089470);
  });
  it("formats exact and compact Russian numbers", () => {
    expect(formatNumber(55089470).replaceAll("\u00a0", " ")).toBe("55 089 470");
    expect(formatNumber(55089470, true)).toBe("55,1 млн");
  });
});
describe("Endpoint and credentials boundary", () => {
  it.each([
    "https://user:secret@example.com/data",
    "http://example.com/data",
    "https://example.com/data?token=secret",
    "//evil.test/data",
    "/\\evil.test/data",
    "javascript:foo",
  ])("rejects unsafe URL %s", (url) =>
    expect(validateEndpoint(url)).not.toBeNull(),
  );
  it.each([
    "https://example.com/dashboard",
    "/api/dashboard",
    "http://localhost:3000/data",
  ])("allows supported endpoint %s", (url) =>
    expect(validateEndpoint(url)).toBeNull(),
  );
  it("uses GET and memory token without credential cookies", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify(baseline)));
    await requestData(config);
    expect(fetchMock).toHaveBeenCalledWith(
      config.url,
      expect.objectContaining({
        method: "GET",
        credentials: "omit",
        redirect: "error",
        headers: expect.objectContaining({ Authorization: "Bearer test-only" }),
      }),
    );
  });
});
describe("Readiness and failure paths", () => {
  it("returns validated live data", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(baseline)),
    );
    const result = await loadData(config, baseline, null);
    expect(result.source).toBe("live");
    expect(result.error).toBeNull();
  });
  it("hybrid preserves the last valid snapshot on HTTP failure", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("unavailable", { status: 500 }),
    );
    const last = makeScenario("yearend");
    const r = await loadData(config, baseline, last);
    expect(r.source).toBe("fallback");
    expect(r.data).toBe(last);
    expect(r.error).toContain("500");
  });
  it("hybrid falls back to demo when there is no last live snapshot", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("network"));
    const r = await loadData(config, baseline, null);
    expect(r.data).toBe(baseline);
    expect(r.source).toBe("fallback");
  });
  it("Strict Live never disguises failure as demo", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}"));
    const r = await loadData({ ...config, mode: "live" }, baseline, null);
    expect(r.source).toBe("error");
    expect(r.data).toBeNull();
  });
  it("rejects invalid JSON", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("<html>error</html>"),
    );
    await expect(requestData(config)).rejects.toThrow("невалидный JSON");
  });
  it("times out at 4 seconds", async () => {
    vi.useFakeTimers();
    vi.spyOn(globalThis, "fetch").mockImplementation(
      (_url, init) =>
        new Promise((_, reject) =>
          init?.signal?.addEventListener("abort", () =>
            reject(new DOMException("Aborted", "AbortError")),
          ),
        ),
    );
    const request = requestData(config);
    const assertion = expect(request).rejects.toThrow("4 секунды");
    await vi.advanceTimersByTimeAsync(4001);
    await assertion;
  });
  it("cancellation is not converted into a fallback result", async () => {
    const controller = new AbortController();
    vi.spyOn(globalThis, "fetch").mockImplementation(
      (_url, init) =>
        new Promise((_, reject) =>
          init?.signal?.addEventListener("abort", () =>
            reject(new DOMException("Aborted", "AbortError")),
          ),
        ),
    );
    const request = loadData(config, baseline, null, controller.signal);
    const assertion = expect(request).rejects.toMatchObject({
      name: "AbortError",
    });
    controller.abort();
    await assertion;
  });
});
