import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import data from "../../public/mock/dashboard-data.json" with { type: "json" };

// Keep the spatial regression language explicit; the app now defaults to Ukrainian.
test.beforeEach(async ({ context }) => {
  await context.addInitScript(() => {
    if (!localStorage.getItem("orbita-locale"))
      localStorage.setItem("orbita-locale", "ru");
  });
});

async function openSpatial(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: /Открыть в пространстве/ }).click();
  await expect(page.locator(".xr-canvas canvas")).toBeVisible({
    timeout: 15000,
  });
}

// Project known world-space targets to the browser camera; this exercises actual Three.js raycasts.
async function clickWorld(page: Page, x: number, y: number, distance: number) {
  const canvas = page.locator(".xr-canvas canvas");
  await canvas.scrollIntoViewIfNeeded();
  const box = (await canvas.boundingBox())!;
  const focus = await page.locator("#xr-focus").inputValue();
  // The panorama preview steps back 1.5 m from the arc with a narrower lens (see SpatialView).
  const panorama = focus === "0";
  if (panorama) distance += 1.5;
  const fov = panorama
    ? Math.max(
        34,
        (2 * Math.atan(0.9 / (box.width / box.height)) * 180) / Math.PI,
      )
    : Math.max(
        68,
        (2 * Math.atan(1.1 / ((1.5 * box.width) / box.height)) * 180) / Math.PI,
      );
  const px =
    box.height / (2 * distance * Math.tan(((fov / 2) * Math.PI) / 180));
  await page.mouse.move(
    box.x + box.width / 2 + x * px,
    box.y + box.height / 2 - y * px,
  );
  await expect(canvas).toHaveCSS("cursor", "pointer");
  await page.mouse.click(
    box.x + box.width / 2 + x * px,
    box.y + box.height / 2 - y * px,
  );
}

test("WebGL panel and in-scene controls navigate focus, with keyboard parity and limits", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await openSpatial(page);
  const picker = page.getByLabel("Приблизить дашборд");
  await expect(
    page.getByRole("button", { name: "Предыдущий дашборд" }),
  ).toBeDisabled();
  await clickWorld(page, -0.31, 0.16, 1.85);
  await expect(picker).toHaveValue("1");
  await expect(page.locator(".xr-focus-status")).toHaveText(
    "Платежи по каналам",
  );
  await expect(
    page.getByRole("button", { name: "Предыдущий дашборд" }),
  ).toBeDisabled();
  await clickWorld(page, 0.27, -0.5682421875, 1.5);
  await expect(picker).toHaveValue("2");
  await page.getByRole("button", { name: "Предыдущий дашборд" }).click();
  await expect(picker).toHaveValue("1");
  await clickWorld(page, 0.79, -0.5682421875, 1.5);
  await expect(picker).toHaveValue("0");
  await expect(page.getByLabel("Поворот взгляда в градусах")).toHaveValue("0");
  await picker.selectOption("1");
  await picker.focus();
  await page.keyboard.press("End");
  await page.keyboard.press("Enter");
  await expect(picker).toHaveValue("10");
  await expect(
    page.getByRole("button", { name: "Следующий дашборд" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "К панораме", exact: true }).click();
  await expect(picker).toHaveValue("0");
  await expect(page.locator(".xr-focus-status")).toHaveText("Панорамный обзор");
  expect(errors).toEqual([]);
});

test("spatial environments, expanded viewport and mobile focus controls stay accessible", async ({
  page,
}) => {
  await openSpatial(page);
  const environments = page.getByRole("group", {
    name: "Окружение предпросмотра",
  });
  await environments
    .getByRole("button", { name: "Тёмное окружение", exact: true })
    .click();
  await expect(page.locator(".xr-canvas")).toHaveAttribute(
    "data-environment",
    "dark",
  );
  await environments
    .getByRole("button", { name: "Светлое окружение", exact: true })
    .click();
  const initialHeight = (await page.locator(".xr-canvas").boundingBox())!
    .height;
  await page.getByRole("button", { name: "Развернуть 3D-просмотр" }).click();
  expect(
    (await page.locator(".xr-canvas").boundingBox())!.height,
  ).toBeGreaterThan(initialHeight);
  await page.getByRole("button", { name: "Свернуть 3D-просмотр" }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.getByLabel("Приблизить дашборд").selectOption("7");
  await page.getByRole("button", { name: "Следующий дашборд" }).click();
  await expect(page.locator(".xr-focus-status")).toHaveText(
    "Операции устройств",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Посмотреть на кассы" }).click();
  await expect(page.getByLabel("Приблизить дашборд")).toHaveValue("0");
  await page.getByRole("button", { name: "Центр", exact: true }).click();
  await page.getByLabel("Приблизить дашборд").selectOption("8");
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

test("space exploration rotates freely and restores the analytics panorama", async ({
  page,
}) => {
  await openSpatial(page);
  await page.getByLabel("Приблизить дашборд").selectOption("7");
  await page.getByRole("button", { name: "Осмотреть пространство" }).click();
  await expect(page.getByLabel("Приблизить дашборд")).toHaveCount(0);
  const turn = page.getByLabel("Поворот взгляда в градусах");
  await expect(turn).toHaveAttribute("max", "180");
  await turn.fill("135");
  await page.getByRole("button", { name: "Вернуть аналитику" }).click();
  await expect(turn).toHaveValue("0");
  await expect(turn).toHaveAttribute("max", "45");
  await expect(page.getByLabel("Приблизить дашборд")).toHaveValue("0");
  await expect(page.locator(".xr-focus-status")).toHaveText("Панорамный обзор");
});

test("spatial mode explains strict API failure and recovers without a reload", async ({
  page,
}) => {
  let fail = true;
  await page.route("**/api/spatial-test", (route) =>
    route.fulfill({
      status: fail ? 500 : 200,
      contentType: "application/json",
      body: fail ? "error" : JSON.stringify(data),
    }),
  );
  await page.goto("/?admin=1");
  await page.getByRole("tab", { name: "Подключение API", exact: true }).click();
  await page.getByLabel("Источник", { exact: true }).selectOption("live");
  await page.getByLabel("Обновление", { exact: true }).selectOption("0");
  await page.getByLabel("Адрес API").fill("/api/spatial-test");
  await page.getByRole("button", { name: "Сохранить подключение" }).click();
  await page.getByRole("button", { name: "Закрыть", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Нет доступных данных API" }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Открыть в пространстве/ }).click();
  await expect(
    page.getByRole("heading", {
      name: "Нет данных для пространственного просмотра",
    }),
  ).toBeVisible();
  await expect(page.getByLabel("Приблизить дашборд")).toBeDisabled();
  fail = false;
  const recoveredResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/spatial-test") && response.status() === 200,
  );
  await page
    .getByRole("button", { name: "Повторить загрузку", exact: true })
    .click();
  await recoveredResponse;
  // Software WebGL can take longer to compile ten surfaces after the API has recovered.
  await expect(page.locator(".xr-no-data")).toHaveCount(0, { timeout: 10000 });
  await expect(page.getByLabel("Приблизить дашборд")).toBeEnabled();
  await page.getByLabel("Приблизить дашборд").selectOption("10");
  await expect(page.locator(".xr-focus-status")).toHaveText(
    "Состояние оборудования",
  );
});

test("three simultaneous stands raycast into combined chart/facts and recenter", async ({
  page,
}) => {
  await openSpatial(page);
  const canvas = page.locator(".xr-canvas");
  await expect(canvas).toHaveAttribute("data-panorama-wings", "3");
  await expect(page.locator(".xr-category-tabs")).toHaveCount(0);
  // Left cash stand, first full-width card, on the requested arc.
  await clickWorld(
    page,
    -1.85 * Math.sin((42 * Math.PI) / 180),
    0.16,
    1.85 * Math.cos((42 * Math.PI) / 180),
  );
  await expect(page.locator("#xr-focus")).toHaveValue("5");
  await expect(canvas).toHaveAttribute("data-focus-view", "combined");
  await expect(page.getByText(/Страница \d+ \/ \d+/)).toHaveCount(0);
  await page.locator("#xr-focus").selectOption("10");
  await expect(canvas).toHaveAttribute("data-focus-view", "combined");
  await expect(page.getByLabel("Прокрутка точных значений")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Центрировать пространство", exact: true })
    .click();
  await expect(page.locator("#xr-focus")).toHaveValue("0");
  await expect(page.getByLabel("Поворот взгляда в градусах")).toHaveValue("0");
  await expect(canvas).toHaveAttribute("data-focus-view", "panorama");
  await expect(canvas).toHaveAttribute("data-panorama-wings", "3");
});
