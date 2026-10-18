import type { Page } from "@playwright/test";

/** Arrival motion runs once per load; measure geometry after it has finished. */
export async function settleAnimations(page: Page) {
  await page.waitForFunction(() =>
    document
      .getAnimations()
      .every((animation) => animation.playState !== "running"),
  );
}
