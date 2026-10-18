import type { Page } from "@playwright/test";

/** Arrival motion runs once per load; measure geometry after it has finished. */
export async function settleAnimations(page: Page) {
  await page.waitForFunction(() =>
    document
      .getAnimations()
      .every((animation) => animation.playState !== "running"),
  );
}

/**
 * Pick from a focused select by keyboard. A customizable select (appearance: base-select)
 * opens its list first and moves inside it; a native one changes value in place.
 */
export async function keyboardSelect(page: Page, keys: string[]) {
  const custom = await page.evaluate(() =>
    CSS.supports("appearance", "base-select"),
  );
  if (custom) await page.keyboard.press("Enter");
  for (const key of keys) await page.keyboard.press(key);
  await page.keyboard.press("Enter");
}
