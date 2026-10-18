import { chromium, expect } from "@playwright/test";
import fs from "node:fs";
import { createServer } from "node:http";
import path from "node:path";

const html = fs.readFileSync("standalone-dist/orbita-preview.html");
const evidenceDirectory = path.resolve(
  process.env.PREVIEW_EVIDENCE_DIR || "docs/evidence",
);
const server = createServer((request, response) => {
  response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  response.end(html);
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const entry = `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
  args: ["--no-sandbox", "--enable-unsafe-swiftshader"],
});
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  await context.addInitScript(() =>
    localStorage.setItem("orbita-locale", "ru"),
  );
  const page = await context.newPage();
  const errors = [],
    requests = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (request) => {
    if (/^https?:/.test(request.url()) && request.url() !== entry)
      requests.push(request.url());
  });
  await page.goto(entry);
  await page.evaluate(() => document.fonts.ready);
  await page.locator('.space-backdrop canvas[data-space-ready="true"]').waitFor();
  await page.getByRole("button", { name: "Объём", exact: true }).click();
  await page.locator('[data-dashboard-id="3"]').waitFor();
  if ((await page.locator("[data-dashboard-id]").count()) !== 9)
    throw new Error("Standalone dashboards incomplete");
  await page.locator('[data-dashboard-id="1"] .focus-button').click();
  await expect(page.getByRole("dialog").locator("details")).toHaveAttribute(
    "open",
    "",
  );
  await expect(
    page.getByRole("dialog").locator("tbody tr").first(),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await page
    .getByRole("navigation", { name: "Вид аналитики" })
    .getByRole("button", { name: "Кассы", exact: true })
    .click();
  if ((await page.locator("[data-dashboard-id]").count()) !== 3)
    throw new Error("Standalone navigation failed");
  await page.getByRole("button", { name: /Открыть в пространстве/ }).click();
  await page.locator(".xr-canvas canvas").waitFor();
  if ((await page.locator("#xr-focus option").count()) !== 11)
    throw new Error("All ten focus dashboards must remain available");
  await page.getByLabel("Приблизить дашборд").selectOption("3");
  await page.getByRole("button", { name: "Следующий дашборд" }).click();
  if (
    !(await page
      .locator(".xr-focus-status")
      .innerText()
      .then((s) => s === "Платежи с начала года"))
  )
    throw new Error("Standalone XR navigation failed");
  await page.waitForTimeout(400);
  fs.mkdirSync(evidenceDirectory, { recursive: true });
  await page.screenshot({
    path: path.join(evidenceDirectory, "standalone-preview.png"),
  });
  const result = {
    singleHtml: true,
    fileProtocolTested: false,
    dashboards: 10,
    focus: true,
    navigation: true,
    webgl: true,
    externalRequests: requests.length,
    errors,
  };
  fs.writeFileSync(
    path.join(evidenceDirectory, "standalone-smoke.json"),
    JSON.stringify(result, null, 2) + "\n",
  );
  console.log(result);
  if (errors.length || requests.length)
    throw new Error(
      "Standalone preview requires external resources or has script errors",
    );
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
