import { chromium } from "@playwright/test";
import fs from "node:fs";
import { createServer } from "node:http";

const html = fs.readFileSync("standalone-dist/orbita-preview.html");
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
  await page.getByRole("button", { name: "Вместе", exact: true }).click();
  if ((await page.locator("[data-dashboard-id]").count()) !== 10)
    throw new Error("Standalone dashboards incomplete");
  await page.locator('[data-dashboard-id="1"] .focus-button').click();
  await page.getByRole("dialog").locator("summary").click();
  await page.keyboard.press("Escape");
  await page
    .getByRole("navigation", { name: "Вид аналитики" })
    .getByRole("button", { name: "Кассы", exact: true })
    .click();
  if ((await page.locator("[data-dashboard-id]").count()) !== 3)
    throw new Error("Standalone navigation failed");
  await page.getByRole("button", { name: /Открыть в пространстве/ }).click();
  await page.locator(".xr-canvas canvas").waitFor();
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
  await page.screenshot({ path: "docs/evidence/standalone-preview.png" });
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
    "docs/evidence/standalone-smoke.json",
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
