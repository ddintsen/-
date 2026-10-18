import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("nine overview cards, ten focus dashboards, actionable attention and real light/dark surfaces", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("[data-dashboard-id]")).toHaveCount(9);
  const surface = page.locator('[data-dashboard-id="1"]');
  const light = await surface.evaluate((el) => getComputedStyle(el).background);
  await page.getByRole("button", { name: "Увімкнути темне оточення" }).click();
  const dark = await surface.evaluate((el) => getComputedStyle(el).background);
  expect(light).not.toBe(dark);
  await page
    .getByRole("button", { name: "Увімкнути оточення кабінету" })
    .click();
  await page
    .getByLabel("Зони уваги", { exact: true })
    .getByRole("button", { name: /Recycle/ })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading")).toHaveText("Стан обладнання");
  const row = dialog.locator("tr").filter({ hasText: "Recycle" }).first();
  await expect(row).toContainText("7,2%");
  await expect(row).toContainText("SLA 5%");
  await expect(row).toContainText("Високий простій");
  await dialog
    .getByRole("navigation", { name: "Обрати дашборд" })
    .getByRole("button", { name: "Кількість платежів", exact: true })
    .click();
  await expect(dialog.locator("tbody tr").first()).toContainText("55");
  await expect(dialog.locator("tbody tr").first()).toContainText("90,7%");
  await expect(dialog.locator("tbody tr").first()).toContainText("Не передано");
  const choices = dialog.getByRole("navigation", { name: "Обрати дашборд" });
  await expect(choices.getByRole("button").first()).toHaveText(
    "1. Платежі за каналами",
  );
  await expect(dialog.getByRole("columnheader")).toHaveCount(4);
});

test("all mobile tabs fit and scenario selection follows the actual dataset", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 844 });
  await page.goto("/");
  for (const locale of ["uk", "en", "ru"]) {
    await page.locator(".topbar select").selectOption(locale);
    const bounds = await page.locator(".view-tabs").evaluate((el) => ({
      client: el.clientWidth,
      scroll: el.scrollWidth,
      labels: [...el.querySelectorAll("button")].map((b) => ({
        client: b.clientWidth,
        scroll: b.scrollWidth,
      })),
    }));
    expect(bounds.scroll).toBeLessThanOrEqual(bounds.client);
    for (const label of bounds.labels)
      expect(label.scroll).toBeLessThanOrEqual(label.client);
  }
  await page.locator(".topbar select").selectOption("en");
  await page.getByRole("button", { name: "Data sources", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Baseline", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page
    .getByRole("button", { name: "Equipment failure", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Equipment failure", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("button", { name: "Baseline", exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
  const scan = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(
    scan.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => n.target),
    })),
  ).toEqual([]);
});
