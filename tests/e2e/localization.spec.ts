import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import data from "../../public/mock/dashboard-data.json" with { type: "json" };

const headerLanguage = (page: Page) => page.locator(".language-switch select");
const card = (page: Page, id: number) =>
  page.locator(`[data-dashboard-id="${id}"]`);
const noOverflow = async (page: Page) => {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
};

test("fresh sessions default to Ukrainian across demo labels, dates and exact facts", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang", "uk");
  await expect(headerLanguage(page)).toHaveValue("uk");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Огляд");
  await expect(page.locator(".source-item")).toContainText("Демодані");
  await expect(page.locator(".report-period")).toHaveText("Жовтень 2026");
  await expect(page.locator("[data-dashboard-id]")).toHaveCount(9);
  await expect(page.locator("[data-dashboard-id] h3")).toHaveText([
    "Операції в касах",
    "Каси з початку року",
    "Каси й команда",
    "Платежі за каналами",
    "Кількість платежів",
    "Платежі з початку року",
    "Операції пристроїв",
    "Обсяг операцій пристроїв",
    "Стан обладнання",
  ]);
  // These letters expose untranslated built-in Russian demo text, including SVG labels.
  expect(await page.locator("main").innerText()).not.toMatch(/[ыэёъЫЭЁЪ]/);
  await card(page, 1).locator(".focus-button").click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading")).toHaveText("Платежі за каналами");
  await expect(dialog.locator("details")).toHaveAttribute("open", "");
  await expect(dialog.getByRole("columnheader")).toHaveText([
    "Показник",
    "Факт",
    "План / Поріг",
    "Виконання / Статус",
  ]);
  await expect(dialog.locator("tbody tr").first()).toContainText(
    "Інтернет · січень",
  );
  await expect(
    dialog.getByRole("button", { name: "Закрити", exact: true }),
  ).toBeVisible();
});

test("English updates navigation, units, compact and exact values without a reload", async ({
  page,
}) => {
  await page.goto("/");
  await headerLanguage(page).selectOption("en");
  await expect(page).toHaveTitle("Overview · Orbita");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.locator(".report-period")).toHaveText("October 2026");
  await expect(page.locator(".source-item")).toContainText("Demo data");
  await expect(
    card(page, 2).locator(".metric-info strong").first(),
  ).toContainText("55.1M");
  await expect(card(page, 1)).toContainText("Digital share");
  await expect(card(page, 1)).toContainText("Reporting month");
  await expect(card(page, 5)).toContainText("Card top-ups");
  await page
    .getByRole("button", { name: "Show exact numbers", exact: true })
    .click();
  await expect(
    card(page, 2).locator(".metric-info strong").first(),
  ).toContainText("55,089,470");
  expect(await page.locator("main").innerText()).not.toMatch(
    /[А-Яа-яЁёІіЇїЄєҐґ]/,
  );
  await card(page, 2).locator(".focus-button").click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.locator("tbody tr").filter({ hasText: "Total count" }),
  ).toContainText("55,089,470 pcs");
  await expect(dialog.locator("summary")).toHaveText("Exact values");
  await page.keyboard.press("Escape");
  await page
    .getByRole("navigation", { name: "Analytics view" })
    .getByRole("button", { name: "Cash desks", exact: true })
    .click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Cash operations",
  );
  await expect(page).toHaveTitle("Cash desks · Orbita");
});

test("header and settings share a persisted language and sync another tab", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await headerLanguage(page).selectOption("en");
  await page.reload();
  await expect(headerLanguage(page)).toHaveValue("en");
  const peer = await context.newPage();
  await peer.goto("/");
  await expect(peer.getByRole("heading", { level: 1 })).toHaveText("Overview");
  await page.getByRole("button", { name: "Data sources", exact: true }).click();
  await expect(page.locator("#settings-language")).toHaveValue("en");
  await expect(
    page.getByRole("tab", { name: "Demo Mode", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await page.locator("#settings-language").selectOption("uk");
  await expect(
    page.getByRole("dialog").getByRole("heading", { level: 2 }),
  ).toHaveText("Джерела даних");
  await expect(headerLanguage(page)).toHaveValue("uk");
  await expect(peer.getByRole("heading", { level: 1 })).toHaveText("Огляд");
  await page.getByRole("button", { name: "Закрити", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem("orbita-locale"))).toBe(
    "uk",
  );
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Огляд");
  await peer.close();
});

test("UA and EN navigation and settings fit 360px and 390px phones", async ({
  page,
}) => {
  await page.goto("/");
  for (const locale of ["uk", "en"]) {
    await headerLanguage(page).selectOption(locale);
    for (const width of [360, 390]) {
      await page.setViewportSize({ width, height: 844 });
      const navigation = page.getByRole("navigation", {
        name: locale === "uk" ? "Вид аналітики" : "Analytics view",
      });
      await expect(navigation).toHaveCount(1);
      const names =
        locale === "uk"
          ? ["Огляд", "Платежі", "Каси", "Обладнання"]
          : ["Overview", "Payments", "Cash desks", "Equipment"];
      for (const name of names) {
        const tab = navigation.getByRole("button", { name, exact: true });
        await tab.click();
        await expect(tab).toHaveAttribute("aria-pressed", "true");
        await noOverflow(page);
      }
      await page
        .getByRole("button", {
          name: locale === "uk" ? "Джерела даних" : "Data sources",
          exact: true,
        })
        .click();
      await noOverflow(page);
      await page
        .getByRole("tab", {
          name: locale === "uk" ? "Підключення API" : "API connection",
          exact: true,
        })
        .click();
      await noOverflow(page);
      await page
        .getByRole("button", {
          name: locale === "uk" ? "Закрити" : "Close",
          exact: true,
        })
        .click();
      await page
        .getByRole("button", {
          name: locale === "uk" ? "Відкинути зміни" : "Discard changes",
          exact: true,
        })
        .click();
    }
  }
});

test("monthly controls belong to their card and exact focus tables start expanded", async ({
  page,
}) => {
  await page.goto("/");
  const switcher = page.getByRole("group", { name: "Показник платежів" });
  await expect(
    card(page, 2).getByRole("group", { name: "Показник платежів" }),
  ).toBeVisible();
  await expect(card(page, 3)).toHaveCount(0);
  await switcher.getByRole("button", { name: "Обсяг", exact: true }).click();
  await expect(card(page, 2)).toHaveCount(0);
  await expect(
    card(page, 3).getByRole("group", { name: "Показник платежів" }),
  ).toBeVisible();
  await expect(page.locator("[data-dashboard-id]")).toHaveCount(9);
  await expect(switcher.getByRole("button")).toHaveCount(3);
  await expect(card(page, 3).locator(".plan-bars svg rect")).toHaveCount(3);
  await card(page, 3).locator(".focus-button").click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.locator("details")).toHaveAttribute("open", "");
  const expected = new Intl.NumberFormat("uk-UA").format(
    data.block1_payments.dashboard3_monthlyVolume.cards[0].value,
  );
  await expect(
    dialog
      .locator("tbody tr")
      .filter({ hasText: "Загальний обсяг" })
      .filter({ hasText: "₴" }),
  ).toContainText(expected);
  await dialog.getByRole("button", { name: "Наступний дашборд" }).click();
  await expect(dialog.getByRole("heading")).toHaveText(
    "Платежі з початку року",
  );
  await expect(dialog.locator("tbody tr").first()).toBeVisible();
});

test("plan and downtime meters expose exact values and truthful overachievement", async ({
  page,
}) => {
  await page.goto("/");
  await headerLanguage(page).selectOption("en");
  const downtime = card(page, 10).getByRole("meter");
  const source =
    data.block3_atmTso.dashboard10_workingEquipmentAndDowntime.downtime;
  for (let index = 0; index < source.length; index++) {
    await expect(downtime.nth(index)).toHaveAttribute(
      "aria-valuenow",
      String(source[index].percent),
    );
    await expect(downtime.nth(index)).toHaveAttribute("aria-valuemax", "10");
    await expect(downtime.nth(index)).toHaveAttribute(
      "aria-valuetext",
      new RegExp(`^${source[index].percent}%;`),
    );
  }
  await expect(downtime.nth(0)).toHaveAttribute(
    "aria-valuetext",
    /Low downtime/,
  );
  await expect(downtime.nth(1)).toHaveAttribute(
    "aria-valuetext",
    /Operating level/,
  );
  await expect(downtime.nth(2)).toHaveAttribute(
    "aria-valuetext",
    /High downtime/,
  );
  await page.getByRole("button", { name: "Data sources", exact: true }).click();
  await page.getByRole("button", { name: "Year end", exact: true }).click();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  const overPlan = card(page, 4).getByRole("meter").first();
  await expect(overPlan).toHaveAttribute("aria-valuenow", "102");
  await expect(overPlan).toHaveAttribute(
    "aria-valuetext",
    /^102%; Plan 100%; Actual:/,
  );
  await expect(card(page, 4).locator(".progress-percent").first()).toHaveText(
    "102%",
  );
  const trackWidth = await overPlan.evaluate(
    (element) => element.getBoundingClientRect().width,
  );
  const fillWidth = await overPlan
    .locator(".progress-fill")
    .evaluate((element) => element.getBoundingClientRect().width);
  expect(fillWidth / trackWidth).toBeCloseTo(102 / 120, 2);
  await card(page, 4).locator(".focus-button").click();
  await expect(
    page.getByRole("dialog").locator("tbody tr").first(),
  ).toContainText("102%");
});

test("API draft survives demo selection and guards unsaved changes in English", async ({
  page,
}) => {
  await page.goto("/?admin=1");
  await page.locator("#settings-language").selectOption("en");
  await expect(
    page.getByRole("tab", { name: "Demo Mode", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await page.getByRole("tab", { name: "API connection", exact: true }).click();
  await expect(page.getByLabel("Source", { exact: true })).toHaveValue(
    "hybrid",
  );
  await page
    .getByLabel("API address", { exact: true })
    .fill("/api/preserved-draft");
  await page
    .getByLabel("Bearer token", { exact: true })
    .fill("DRAFT_MEMORY_ONLY");
  await page.getByRole("tab", { name: "Demo Mode", exact: true }).click();
  await page.getByRole("button", { name: "Year end", exact: true }).click();
  await page.getByRole("tab", { name: "API connection", exact: true }).click();
  await expect(page.getByLabel("API address", { exact: true })).toHaveValue(
    "/api/preserved-draft",
  );
  await expect(page.getByLabel("Bearer token", { exact: true })).toHaveValue(
    "DRAFT_MEMORY_ONLY",
  );
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Unsaved changes", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Keep editing", exact: true }).click();
  await expect(page.getByLabel("API address", { exact: true })).toHaveValue(
    "/api/preserved-draft",
  );
  expect(
    await page.evaluate(() =>
      JSON.stringify({ ...localStorage, ...sessionStorage }),
    ),
  ).not.toContain("DRAFT_MEMORY_ONLY");
});

test("custom API labels and descriptive periods remain intact after switching language", async ({
  page,
}) => {
  const custom = structuredClone(data);
  custom.meta.reportDate = "Q4 executive review — custom period";
  custom.block1_payments.dashboard1_channels.channels[0].name =
    "Кассы Север / Enterprise channel";
  await page.route("**/api/custom-locale", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(custom),
    }),
  );
  await page.goto("/?admin=1");
  await page.locator("#settings-language").selectOption("en");
  await page.getByRole("tab", { name: "API connection", exact: true }).click();
  await page
    .getByLabel("API address", { exact: true })
    .fill("/api/custom-locale");
  await page.getByLabel("Refresh interval", { exact: true }).selectOption("0");
  await page
    .getByRole("button", { name: "Save connection", exact: true })
    .click();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await expect(page.locator(".source-item")).toContainText("API connected");
  await expect(page.locator(".report-period")).toHaveText(
    custom.meta.reportDate,
  );
  await card(page, 1).locator(".focus-button").click();
  await expect(
    page.getByRole("dialog").locator("tbody tr").first(),
  ).toContainText("Кассы Север / Enterprise channel · January");
  await page.keyboard.press("Escape");
  await headerLanguage(page).selectOption("uk");
  await card(page, 1).locator(".focus-button").click();
  await expect(
    page.getByRole("dialog").locator("tbody tr").first(),
  ).toContainText("Кассы Север / Enterprise channel · січень");
});

test("UA and EN overview, focused values and API settings satisfy accessibility checks", async ({
  page,
}) => {
  await page.goto("/");
  for (const locale of ["uk", "en"]) {
    await headerLanguage(page).selectOption(locale);
    for (const state of ["overview", "focus", "settings"]) {
      if (state === "focus")
        await card(page, 4).locator(".focus-button").click();
      if (state === "settings") {
        await page.keyboard.press("Escape");
        await page
          .getByRole("button", {
            name: locale === "uk" ? "Джерела даних" : "Data sources",
            exact: true,
          })
          .click();
        await page
          .getByRole("tab", {
            name: locale === "uk" ? "Підключення API" : "API connection",
            exact: true,
          })
          .click();
      }
      const scan = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze();
      expect(
        scan.violations.map((violation) => ({
          id: violation.id,
          nodes: violation.nodes.map((node) => node.target),
        })),
        `${locale} ${state}`,
      ).toEqual([]);
    }
    await page
      .getByRole("button", {
        name: locale === "uk" ? "Закрити" : "Close",
        exact: true,
      })
      .click();
    await page
      .getByRole("button", {
        name: locale === "uk" ? "Відкинути зміни" : "Discard changes",
        exact: true,
      })
      .click();
  }
});

test("mounted spatial view updates its controls, report and focus labels with language", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Відкрити в просторі", exact: true })
    .click();
  await expect(page.locator(".xr-canvas canvas")).toBeVisible({
    timeout: 15000,
  });
  await expect(
    page.getByRole("dialog").locator(".sr-only").filter({ hasText: "2026" }),
  ).toContainText("Демодані · Жовтень 2026");
  await page.getByLabel("Наблизити дашборд", { exact: true }).selectOption("1");
  await expect(page.locator(".xr-focus-status")).toHaveText(
    "Платежі за каналами",
  );
  // A second real tab changes the persisted preference while the spatial modal stays mounted.
  const peer = await context.newPage();
  await peer.goto("/");
  await headerLanguage(peer).selectOption("en");
  await page.bringToFront();
  await expect(
    page.getByRole("dialog").getByRole("heading", { level: 2 }),
  ).toHaveText("Spatial view");
  await expect(page.getByLabel("Focus dashboard", { exact: true })).toHaveValue(
    "1",
  );
  await expect(page.locator(".xr-focus-status")).toHaveText(
    "Payments by channel",
  );
  await expect(
    page.getByRole("dialog").locator(".sr-only").filter({ hasText: "2026" }),
  ).toContainText("Demo data · October 2026");
  await expect(
    page.getByRole("button", { name: "Next dashboard", exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "Next dashboard", exact: true })
    .click();
  await expect(page.locator(".xr-focus-status")).toHaveText("Payment count");
  await peer.close();
});
