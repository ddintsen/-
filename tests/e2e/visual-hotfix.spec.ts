import { test, expect } from "@playwright/test";
import data from "../../public/mock/dashboard-data.json" with { type: "json" };

test("overview stays 3 by 3 in all monthly modes, languages and themes", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1600, height: 1100 });
  await page.goto("/");
  for (const locale of ["uk", "en"]) {
    await page.locator(".language-switch select").selectOption(locale);
    for (const theme of ["office", "dark"]) {
      if ((await page.locator("html").getAttribute("data-theme")) !== theme)
        await page.locator(".topbar-right button").first().click();
      const heights: number[] = [];
      for (const index of [0, 1, 2]) {
        await page.locator(".monthly-switch button").nth(index).click();
        await expect(page.locator("[data-dashboard-id]")).toHaveCount(9);
        await expect(page.locator(".monthly-switch button")).toHaveCount(3);
        for (const wing of ["cash", "payments", "equipment"])
          await expect(
            page.locator(`.${wing}-wing .dashboard-card`),
          ).toHaveCount(3);
        const rows = await page.locator(".wing").evaluateAll((wings) =>
          wings.map((w) =>
            [...w.querySelectorAll(".dashboard-card")].map((c) => ({
              top: c.getBoundingClientRect().top,
              bottom: c.getBoundingClientRect().bottom,
            })),
          ),
        );
        for (let row = 0; row < 3; row++)
          for (const edge of ["top", "bottom"] as const)
            expect(
              Math.max(...rows.map((w) => w[row][edge])) -
                Math.min(...rows.map((w) => w[row][edge])),
            ).toBeLessThan(2);
        await expect(
          page.locator(
            ".monthly-layout .plan-bars svg rect, .monthly-comparison .plan-bars svg rect",
          ),
        ).toHaveCount(index === 2 ? 0 : 3);
        heights.push(
          (await page
            .locator(".payments-wing .dashboard-card")
            .nth(1)
            .boundingBox())!.height,
        );
      }
      expect(Math.max(...heights) - Math.min(...heights)).toBeLessThan(2);
    }
  }
});

test("risk uses actual 17/46/72 percent lengths and only two operational alerts", async ({
  page,
}) => {
  await page.goto("/");
  const meters = page.locator(".card-10 .downtime-gauge");
  for (const [index, expected] of [17, 46, 72].entries()) {
    const ratio = await meters.nth(index).evaluate((el) => {
      const track = el.querySelector(".progress-track")!,
        fill = el.querySelector(".progress-fill")!;
      return (
        (fill.getBoundingClientRect().width /
          track.getBoundingClientRect().width) *
        100
      );
    });
    expect(ratio).toBeCloseTo(expected, 0);
    expect(
      await meters
        .nth(index)
        .locator(".progress-track")
        .evaluate((el) => getComputedStyle(el).backgroundImage),
    ).toBe("none");
    await expect(meters.nth(index)).toContainText("SLA 5%");
  }
  await expect(page.locator(".attention-items button")).toHaveCount(2);
  await expect(page.locator(".attention-items button")).toHaveText([
    /Recycle: 7,2%/,
    /Регулярні: 84%/,
  ]);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("spatial overview paints channel labels and focus paints all equipment facts without pages", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const original = CanvasRenderingContext2D.prototype.fillText;
    const log: {
      text: string;
      width: number;
      height: number;
      x: number;
      y: number;
    }[] = [];
    Object.assign(window, { __painted: log });
    CanvasRenderingContext2D.prototype.fillText = function (
      text,
      x,
      y,
      maxWidth,
    ) {
      log.push({
        text: String(text),
        width: this.canvas.width,
        height: this.canvas.height,
        x,
        y,
      });
      if (maxWidth === undefined) original.call(this, text, x, y);
      else original.call(this, text, x, y, maxWidth);
    };
  });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Відкрити в просторі", exact: true })
    .click();
  await expect(page.locator(".xr-canvas canvas")).toBeVisible();
  await expect(page.locator(".xr-canvas")).toHaveAttribute(
    "data-panorama-wings",
    "3",
  );
  const painted = () =>
    page.evaluate(
      () =>
        (window as unknown as { __painted: { text: string; width: number }[] })
          .__painted,
    );
  await expect
    .poll(async () => (await painted()).map((x) => x.text))
    .toContain("Інтернет");
  const text = (await painted()).map((x) => x.text);
  for (const label of [
    "Касові операції",
    "Платежі",
    "Обладнання",
    "Інтернет",
    "Моб.",
    "банк",
    "ТСО",
    "Каси",
    "АТМ",
    "Авто",
    "платежі",
  ])
    expect(text).toContain(label);
  for (const channel of data.block1_payments.dashboard1_channels.channels)
    for (const value of [channel.jan, channel.cur])
      expect(text).toContain(
        new Intl.NumberFormat("uk-UA", { maximumFractionDigits: 2 }).format(
          value,
        ),
      );
  await page.locator("#xr-focus").selectOption("10");
  await expect(page.locator(".xr-canvas")).toHaveAttribute(
    "data-focus-view",
    "combined",
  );
  await expect
    .poll(async () =>
      (await painted()).filter((x) => x.width === 2048).map((x) => x.text),
    )
    .toContain("Recycle · день 25");
  const exact = (await painted())
    .filter((x) => x.width === 2048)
    .map((x) => x.text);
  for (const heading of ["Показник", "Факт", "План / Поріг", "Виконання"])
    expect(exact).toContain(heading);
  expect(exact).toContain("SLA 5%");
  expect(exact).toContain("Високий простій");
  for (const series of ["ТСО", "АТМ", "Recycle"])
    for (const day of data.block3_atmTso.dashboard10_workingEquipmentAndDowntime
      .days)
      expect(exact).toContain(`${series} · день ${day}`);
  await expect(page.locator(".xr-facts-scroll")).toHaveCount(0);
  await expect(page.getByText(/Сторінка \d+ \/ \d+/)).toHaveCount(0);
});
