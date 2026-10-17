import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

// Start `npm run preview -- --port 4173` before this read-only browser smoke check.
const baseURL = (process.env.PREVIEW_URL || "http://127.0.0.1:4173/").replace(
  /\/?$/,
  "/",
);
const evidenceDirectory = path.resolve(
  process.env.PRODUCTION_EVIDENCE_DIR || "docs/evidence",
);
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox", "--enable-unsafe-swiftshader"],
});
try {
  const context = await browser.newContext({
    baseURL,
    viewport: { width: 1440, height: 1000 },
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(baseURL);
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  const manifest = await (
    await page.request.get(new URL("manifest.webmanifest", baseURL).href)
  ).json();
  if (manifest.icons.length !== 2) throw new Error("Manifest icons missing");
  const profiles = await (
    await page.request.get(
      new URL("xr-profiles/profilesList.json", baseURL).href,
    )
  ).json();
  if (!profiles["meta-quest-touch-plus"])
    throw new Error("Quest controller profile missing");
  fs.mkdirSync(evidenceDirectory, { recursive: true });
  await page.screenshot({
    path: path.join(evidenceDirectory, "production-overview.png"),
    fullPage: true,
  });
  await context.setOffline(true);
  await page.reload();
  await page.waitForSelector('[data-dashboard-id="1"]');
  const offlineRoom = await page.evaluate(async (url) => {
    const image = new Image();
    image.src = url;
    await image.decode();
    return image.naturalWidth > 1000;
  }, new URL("images/room.png", baseURL).href);
  if (!offlineRoom) throw new Error("Offline room asset unavailable");
  const offlineCards = await page.locator("[data-dashboard-id]").count();
  if (offlineCards !== 9)
    throw new Error("Default offline dashboard set incomplete");
  await page.getByRole("button", { name: "Вместе", exact: true }).click();
  if ((await page.locator("[data-dashboard-id]").count()) !== 10)
    throw new Error("Offline dashboard 3 unavailable");
  await page.getByRole("button", { name: /Открыть в пространстве/ }).click();
  await page.locator(".xr-canvas canvas").waitFor();
  await page.waitForTimeout(500);
  await page.getByLabel("Приблизить дашборд").selectOption("1");
  await page.waitForTimeout(300);
  await page.screenshot({
    path: path.join(evidenceDirectory, "spatial-focus.png"),
  });
  const result = {
    baseURL,
    productionHttp: true,
    serviceWorkerControlled: true,
    manifest: true,
    questControllerProfiles: true,
    offlineDemo: true,
    offlineRoom,
    offlineWebGL: true,
    offlineDashboardCount: 10,
    errors,
  };
  fs.writeFileSync(
    path.join(evidenceDirectory, "production-smoke.json"),
    JSON.stringify(result, null, 2) + "\n",
  );
  console.log(result);
  if (errors.length) throw new Error("Browser errors detected");
} finally {
  await browser.close();
}
