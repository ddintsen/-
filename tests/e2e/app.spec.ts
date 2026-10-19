import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import data from "../../public/mock/dashboard-data.json" with { type: "json" };
import { keyboardSelect } from "./helpers";

// Preserve the established Russian regressions; fresh UA/EN sessions live in localization.spec.ts.
test.beforeEach(async ({ context }) => {
  await context.addInitScript(() => {
    if (!localStorage.getItem("orbita-locale"))
      localStorage.setItem("orbita-locale", "ru");
  });
});

test("all ten dashboards open, show exact data, close with focus restored", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.locator("[data-dashboard-id]")).toHaveCount(9);
  for (let id = 1; id <= 10; id++) {
    if (id === 3)
      await page.getByRole("button", { name: "Объём", exact: true }).click();
    const trigger = page.locator(`[data-dashboard-id="${id}"] .focus-button`);
    await trigger.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.locator("details")).toHaveAttribute("open", "");
    await expect(dialog.locator("tbody tr").first()).toBeVisible();
    await dialog.locator("summary").click();
    await expect(dialog.locator("tbody tr").first()).not.toBeVisible();
    await dialog.locator("summary").click();
    await expect(dialog.locator("tbody tr").first()).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
    await expect(trigger).toBeFocused();
  }
  expect(errors).toEqual([]);
});
test("focused dashboards navigate without closing and restore the original trigger", async ({
  page,
}) => {
  await page.goto("/");
  const trigger = page.locator('[data-dashboard-id="1"] .focus-button');
  await trigger.click();
  const dialog = page.getByRole("dialog");
  const previous = dialog.getByRole("button", { name: "Предыдущий дашборд" });
  const next = dialog.getByRole("button", { name: "Следующий дашборд" });
  await expect(previous).toBeDisabled();
  await dialog.locator("summary").click();
  await next.click();
  await expect(dialog.getByRole("heading")).toHaveText("Количество платежей");
  await expect(dialog.locator("details")).toHaveAttribute("open", "");
  await previous.click();
  await expect(dialog.getByRole("heading")).toHaveText("Платежи по каналам");
  for (let id = 2; id <= 10; id++) await next.click();
  await expect(dialog.getByRole("heading")).toHaveText(
    "Состояние оборудования",
  );
  await expect(next).toBeDisabled();
  await expect(previous).toBeEnabled();
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
});
test("navigation restores URL, browser back, theme and format controls work", async ({
  page,
}) => {
  await page.goto("/");
  const tabs = page.getByRole("navigation", { name: "Вид аналитики" });
  await tabs.getByRole("button", { name: "Кассы", exact: true }).click();
  await expect(page).toHaveURL(/view=cash/);
  await expect(page.locator("[data-dashboard-id]")).toHaveCount(3);
  await tabs.getByRole("button", { name: "Оборудование", exact: true }).click();
  await page.goBack();
  await expect(page.locator('[data-dashboard-id="5"]')).toBeVisible();
  await page.getByRole("button", { name: "Показать полные числа" }).click();
  await expect(page.locator('[data-dashboard-id="5"]')).toContainText(
    new Intl.NumberFormat("ru-RU").format(
      data.block2_cashDesk.dashboard5_operationTypes.types[0].count,
    ),
  );
  await page.getByRole("button", { name: "Включить тёмное окружение" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});
test("each section reflows on narrow phones with one visible navigation", async ({
  page,
}) => {
  await page.goto("/");
  for (const width of [360, 390]) {
    await page.setViewportSize({ width, height: 844 });
    const navigation = page.getByRole("navigation", { name: "Вид аналитики" });
    await expect(navigation).toHaveCount(1);
    for (const name of ["Обзор", "Платежи", "Кассы", "Оборудование"]) {
      const tab = navigation.getByRole("button", { name, exact: true });
      await tab.click();
      await expect(tab).toHaveAttribute("aria-pressed", "true");
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
    await expect(
      page.getByRole("button", { name: "Источники данных" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Как пользоваться" }),
    ).toBeVisible();
  }
});
test("scenario and quick editor sync demo data to another tab", async ({
  page,
  context,
}) => {
  await page.goto("/?admin=1");
  const peer = await context.newPage();
  await peer.goto("/");
  await page.getByRole("tab", { name: "Демонстрация", exact: true }).click();
  await page.getByRole("button", { name: /Сбой оборудования/ }).click();
  await expect(
    peer.locator('[data-dashboard-id="7"] .vacancy strong'),
  ).toContainText("38");
  await expect(
    peer.locator('[data-dashboard-id="10"] [data-tone="danger"]'),
  ).toHaveCount(3);
  await page.getByLabel("Доля в ДБО, %").fill("91");
  await page.getByLabel("Вакансии кассиров").fill("12");
  await page.getByLabel("Простой АТМ, %").fill("1.5");
  await page
    .getByRole("button", { name: "Применить показатели", exact: true })
    .click();
  await expect(peer.locator('[data-dashboard-id="1"]')).toContainText("91%");
  await expect(
    peer.locator('[data-dashboard-id="7"] .vacancy strong'),
  ).toContainText("12");
  await peer.close();
});
test("invalid JSON preserves data, valid JSON applies, unsaved edits are guarded", async ({
  page,
}) => {
  await page.goto("/?admin=1");
  await page.getByRole("tab", { name: "Демонстрация", exact: true }).click();
  const json = page.getByLabel("Редактор JSON");
  await json.fill("{");
  await page
    .getByRole("button", { name: "Применить демоданные", exact: true })
    .click();
  await expect(
    page.getByText("Некорректный JSON.", { exact: false }),
  ).toBeVisible();
  await expect(json).toBeFocused();
  await page.getByRole("button", { name: "Закрыть", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Есть несохранённые изменения" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Продолжить редактирование" }).click();
  const changed = structuredClone(data);
  changed.meta.reportDate = "Тестовый период";
  await json.fill(JSON.stringify(changed));
  await page
    .getByRole("button", { name: "Применить демоданные", exact: true })
    .click();
  await page.getByRole("button", { name: "Закрыть", exact: true }).click();
  await expect(page.locator(".report-period")).toContainText("Тестовый период");
});
test("API success, fallback, strict failure and token memory-only storage", async ({
  page,
}) => {
  let fail = false;
  await page.route("**/api/test", (route) =>
    route.fulfill({
      status: fail ? 500 : 200,
      contentType: "application/json",
      body: fail ? "error" : JSON.stringify(data),
    }),
  );
  await page.goto("/?admin=1");
  await page.getByRole("tab", { name: "Подключение API", exact: true }).click();
  await page.getByLabel("Источник", { exact: true }).selectOption("hybrid");
  await page.getByLabel("Обновление", { exact: true }).selectOption("0");
  await page.getByLabel("Адрес API").fill("/api/test");
  await page.getByLabel("Bearer token").fill("E2E_MEMORY_ONLY");
  await page
    .getByRole("button", { name: "Проверить соединение", exact: true })
    .click();
  await expect(page.getByText(/Ответ получен · \d+ мс/)).toBeVisible();
  await page.getByRole("button", { name: "Сохранить подключение" }).click();
  await page.getByRole("button", { name: "Закрыть", exact: true }).click();
  await expect(page.locator(".source-item")).toContainText("API подключён");
  const storage = await page.evaluate(() =>
    JSON.stringify({ ...localStorage, ...sessionStorage }),
  );
  expect(storage).not.toContain("E2E_MEMORY_ONLY");
  fail = true;
  await page
    .getByRole("button", { name: "Обновить данные", exact: true })
    .click();
  await expect(page.locator(".data-warning")).toContainText(
    "Последний снимок API",
  );
  await expect(page.locator('[data-dashboard-id="1"]')).toBeVisible();
  await page
    .getByRole("button", { name: "Источники данных", exact: true })
    .click();
  await page.getByLabel("Источник", { exact: true }).selectOption("live");
  await page.getByRole("button", { name: "Сохранить подключение" }).click();
  await page.getByRole("button", { name: "Закрыть", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Нет доступных данных API" }),
  ).toBeVisible();
  await page.reload();
  await page
    .getByRole("button", { name: "Настроить источник", exact: true })
    .click();
  await expect(page.getByLabel("Bearer token")).toHaveValue("");
});
test("a stale API response cannot overwrite a newer demo scenario", async ({
  page,
}) => {
  await page.route("**/api/slow", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    await route
      .fulfill({ contentType: "application/json", body: JSON.stringify(data) })
      .catch(() => {});
  });
  await page.goto("/?admin=1");
  await page.getByRole("tab", { name: "Подключение API", exact: true }).click();
  await page.getByLabel("Источник", { exact: true }).selectOption("hybrid");
  await page.getByLabel("Адрес API").fill("/api/slow");
  await page.getByRole("button", { name: "Сохранить подключение" }).click();
  await page.getByRole("tab", { name: "Демонстрация", exact: true }).click();
  await page.getByRole("button", { name: /Закрытие года/ }).click();
  await page.getByRole("button", { name: "Закрыть", exact: true }).click();
  await page.waitForTimeout(1300);
  await expect(page.locator(".report-period")).toContainText("Декабрь 2026");
  await expect(page.locator(".source-item")).toContainText("Демоданные");
});
test("empty data series render meaningful states", async ({ page }) => {
  const empty = structuredClone(data);
  empty.block1_payments.dashboard1_channels.channels = [];
  empty.block2_cashDesk.dashboard7_operationsAndStaff.workingCashDesksByDay =
    [];
  await page.goto("/?admin=1");
  await page.getByRole("tab", { name: "Демонстрация", exact: true }).click();
  await page.getByLabel("Редактор JSON").fill(JSON.stringify(empty));
  await page
    .getByRole("button", { name: "Применить демоданные", exact: true })
    .click();
  await page.getByRole("button", { name: "Закрыть", exact: true }).click();
  await expect(page.getByText("Нет данных за этот период")).toHaveCount(2);
});
test("keyboard, reduced motion and mobile have no horizontal overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(page.getByText("Перейти к аналитике")).toBeFocused();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.locator('[data-dashboard-id="1"] .focus-button').click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Источники данных" }).click();
  await page.getByRole("tab", { name: "Подключение API", exact: true }).click();
  await page.getByLabel("Адрес API").fill("http://insecure.example.com/data");
  await page
    .getByRole("button", { name: "Проверить соединение", exact: true })
    .click();
  await expect(page.getByLabel("Адрес API")).toBeFocused();
  await expect(
    page.getByText("Нужен HTTPS-адрес.", { exact: false }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("accessibility audit on overview, focused values and settings", async ({
  page,
}) => {
  await page.goto("/");
  for (const state of ["overview", "focus", "settings"]) {
    if (state === "focus")
      await page.locator('[data-dashboard-id="1"] .focus-button').click();
    if (state === "settings") {
      await page.keyboard.press("Escape");
      await page
        .getByRole("button", { name: "Источники данных", exact: true })
        .click();
    }
    const scan = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(
      scan.violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => n.target),
      })),
    ).toEqual([]);
  }
});
test("real WebGL preview renders and unsupported immersive mode is explained", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.getByRole("button", { name: /Открыть в пространстве/ }).click();
  // The lazy scene must finish its first software-WebGL compilation before its support message mounts.
  await expect(page.locator(".xr-canvas canvas")).toBeVisible({
    timeout: 15000,
  });
  await expect(page.locator(".xr-canvas")).toHaveAttribute(
    "data-scene-ready",
    "true",
    { timeout: 20000 },
  );
  await expect(
    page.getByText("Для AR и VR откройте сайт в Meta Quest Browser."),
  ).toBeVisible();
  await expect(page.locator(".xr-canvas canvas")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Войти в VR", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("slider", { name: "Поворот взгляда в градусах" })
    .fill("32");
  await page.getByRole("button", { name: "Центр", exact: true }).click();
  await expect(page.getByRole("slider")).toHaveValue("0");
  await page.screenshot({ path: testInfo.outputPath("spatial.png") });
  expect(errors).toEqual([]);
});

test("simulation can be stopped and JSON changes from another tab do not overwrite draft", async ({
  page,
  context,
}) => {
  await page.goto("/?admin=1");
  await page.getByRole("tab", { name: "Демонстрация", exact: true }).click();
  await page.getByRole("button", { name: "Запустить", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Остановить", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.waitForTimeout(2700);
  await page.getByRole("button", { name: "Остановить", exact: true }).click();
  await page.getByRole("button", { name: "Загрузить актуальные" }).click();
  const editor = page.getByLabel("Редактор JSON");
  const original = await editor.inputValue();
  await editor.fill(original + " ");
  const peer = await context.newPage();
  await peer.goto("/?admin=1");
  await peer.getByRole("tab", { name: "Демонстрация", exact: true }).click();
  await peer.getByRole("button", { name: /Закрытие года/ }).click();
  await expect(
    page.getByText(/Данные изменились в другой вкладке/),
  ).toBeVisible();
  await expect(editor).toHaveValue(original + " ");
  await expect(
    page.getByRole("button", { name: "Применить демоданные" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Загрузить актуальные" }).click();
  await expect(editor).toHaveValue(/Декабрь 2026/);
  await peer.close();
});

test("keyboard native settings select, quick validation and JSON download", async ({
  page,
}) => {
  await page.goto("/?admin=1");
  await page.getByRole("tab", { name: "Подключение API", exact: true }).click();
  const mode = page.getByLabel("Источник", { exact: true });
  await expect(mode).toHaveValue("hybrid");
  await mode.focus();
  await keyboardSelect(page, ["ArrowDown"]);
  await expect(mode).toHaveValue("live");
  await page.getByRole("tab", { name: "Демонстрация", exact: true }).click();
  await page.getByLabel("Доля в ДБО, %").fill("120");
  await page
    .getByRole("button", { name: "Применить показатели", exact: true })
    .click();
  await expect(page.getByText(/Доли и простой: от 0 до 100/)).toBeVisible();
  await page.getByLabel("Доля в ДБО, %").fill("86");
  await page
    .getByRole("button", { name: "Применить показатели", exact: true })
    .click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Скачать", exact: true }).click();
  expect((await download).suggestedFilename()).toBe("dashboard-data.json");
});

test("long API labels, full numbers, dark theme and mobile settings stay usable", async ({
  page,
}) => {
  const long = structuredClone(data);
  long.block2_cashDesk.dashboard6_ytdMain[1].label =
    "Объём кассовых операций департамента за отчётный накопительный период";
  long.block1_payments.dashboard1_channels.channels[0].name =
    "Корпоративный интернет-банк";
  await page.goto("/?admin=1");
  await page.getByRole("tab", { name: "Демонстрация", exact: true }).click();
  await page.getByLabel("Редактор JSON").fill(JSON.stringify(long));
  await page.getByRole("button", { name: "Применить демоданные" }).click();
  await page.getByRole("button", { name: "Закрыть", exact: true }).click();
  await page.getByRole("button", { name: "Показать полные числа" }).click();
  await page.getByRole("button", { name: "Включить тёмное окружение" }).click();
  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: 950 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.getByRole("button", { name: "Источники данных" }).click();
  await page.getByRole("tab", { name: "Демонстрация", exact: true }).click();
  const scan = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(scan.violations.map((v) => v.id)).toEqual([]);
});
