import { test, expect } from "@playwright/test";

test("the glass overview has a real themed space environment and stops drawing while idle", async ({
  page,
}) => {
  // The slow Earth drift is decorative motion; with reduced motion the backdrop must be still.
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => {
    Object.assign(window, { __spaceDraws: 0 });
    for (const Constructor of [WebGLRenderingContext, WebGL2RenderingContext]) {
      for (const name of ["drawArrays", "drawElements"] as const) {
        const original = Constructor.prototype[name];
        Object.defineProperty(Constructor.prototype, name, {
          value: function (this: WebGLRenderingContext, ...args: number[]) {
            if (
              this.canvas instanceof HTMLCanvasElement &&
              this.canvas.closest(".space-backdrop")
            )
              (window as unknown as { __spaceDraws: number }).__spaceDraws++;
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
      () => (window as unknown as { __spaceDraws: number }).__spaceDraws,
    );
  await expect(
    page.locator('.space-backdrop canvas[data-space-ready="true"]'),
  ).toBeVisible();
  await expect.poll(drawCount).toBeGreaterThan(0);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(700);
  const before = await drawCount();
  await page.waitForTimeout(600);
  expect(await drawCount()).toBe(before);
  await page.locator(".topbar-right button").first().click();
  await expect(page.locator(".space-backdrop")).toHaveAttribute(
    "data-space-theme",
    "dark",
  );
  await expect.poll(drawCount).toBeGreaterThan(before);
  await expect(page.locator("[data-dashboard-id]")).toHaveCount(9);
  // Glass is the stand material; dashboards inside it are tonal sections.
  const surface = await page.locator(".payments-wing").evaluate((el) => {
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

test("dashboard and exact values stay usable when the decorative WebGL background is unsupported", async ({
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

test("the animated backdrop redraws at a low, throttled rate", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.assign(window, { __spaceFrames: 0 });
    const original = WebGL2RenderingContext.prototype.clear;
    Object.defineProperty(WebGL2RenderingContext.prototype, "clear", {
      value: function (this: WebGL2RenderingContext, mask: number) {
        if (
          this.canvas instanceof HTMLCanvasElement &&
          this.canvas.closest(".space-backdrop")
        )
          (window as unknown as { __spaceFrames: number }).__spaceFrames++;
        return Reflect.apply(original, this, [mask]);
      },
      configurable: true,
      writable: true,
    });
  });
  await page.goto("/");
  await expect(
    page.locator('.space-backdrop canvas[data-space-ready="true"]'),
  ).toBeVisible();
  // Let the one-time sunrise reveal finish before sampling the drift rate.
  await page.waitForTimeout(3500);
  const frames = () =>
    page.evaluate(
      () => (window as unknown as { __spaceFrames: number }).__spaceFrames,
    );
  const motion = await page
    .locator(".space-backdrop canvas")
    .getAttribute("data-space-motion");
  const before = await frames();
  await page.waitForTimeout(2000);
  const perSecond = ((await frames()) - before) / 2;
  // Without a GPU the backdrop stays still so the dashboard keeps the CPU.
  if (motion === "still") expect(perSecond).toBe(0);
  else {
    expect(perSecond).toBeGreaterThan(3);
    expect(perSecond).toBeLessThan(20);
  }
});
