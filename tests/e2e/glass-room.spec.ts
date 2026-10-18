import { test, expect } from "@playwright/test";

test("the glass overview has a real themed room and stops drawing while idle", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.assign(window, { __roomDraws: 0 });
    for (const Constructor of [WebGLRenderingContext, WebGL2RenderingContext]) {
      for (const name of ["drawArrays", "drawElements"] as const) {
        const original = Constructor.prototype[name];
        Object.defineProperty(Constructor.prototype, name, {
          value: function (this: WebGLRenderingContext, ...args: number[]) {
            if (
              this.canvas instanceof HTMLCanvasElement &&
              this.canvas.closest(".room-backdrop")
            )
              (window as unknown as { __roomDraws: number }).__roomDraws++;
            return Reflect.apply(original, this, args);
          },
          configurable: true,
          writable: true,
        });
      }
    }
  });
  await page.goto("/");
  const drawCount = () =>
    page.evaluate(
      () => (window as unknown as { __roomDraws: number }).__roomDraws,
    );
  await expect(
    page.locator('.room-backdrop canvas[data-room-ready="true"]'),
  ).toBeVisible();
  await expect.poll(drawCount).toBeGreaterThan(0);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(700);
  const before = await drawCount();
  await page.waitForTimeout(600);
  expect(await drawCount()).toBe(before);
  await page.locator(".topbar-right button").first().click();
  await expect(page.locator(".room-backdrop")).toHaveAttribute(
    "data-room-theme",
    "dark",
  );
  await expect.poll(drawCount).toBeGreaterThan(before);
  await expect(page.locator("[data-dashboard-id]")).toHaveCount(9);
  const surface = await page.locator(".card-2").evaluate((el) => {
    const style = getComputedStyle(el);
    return { background: style.backgroundImage, blur: style.backdropFilter };
  });
  expect(surface.background).toContain("rgba");
  expect(surface.blur).toContain("blur(");
  await page.locator(".card-2 .focus-button").click();
  await expect(page.getByRole("dialog").getByRole("heading")).toHaveText(
    "Кількість платежів",
  );
});

test("dashboard and exact values stay usable when the decorative WebGL room is unsupported", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      type: string,
      ...args: unknown[]
    ) {
      if (
        type === "webgl" ||
        type === "webgl2" ||
        type === "experimental-webgl"
      )
        return null;
      return Reflect.apply(original, this, [type, ...args]);
    } as typeof original;
  });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.locator("[data-dashboard-id]")).toHaveCount(9);
  await page.locator(".card-2 .focus-button").click();
  await expect(page.getByRole("dialog").locator("tbody tr")).toHaveCount(3);
  await page.keyboard.press("Escape");
  await page.locator(".topbar-right button").first().click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(errors).toEqual([]);
});
