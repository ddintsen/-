import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";

// Reproduce a real installed legacy app, not just a fresh browser loading dist.
const legacyCommit = "552750e8b3c624cb428729a8b570be3e2ff51663";
const root = process.cwd();
const base = process.env.VITE_BASE_PATH || "/-/";
assert.ok(base.startsWith("/") && base.endsWith("/"));
const currentDist = path.join(root, "dist");
const evidence = path.resolve(
  process.env.UPDATE_EVIDENCE_DIR || "docs/evidence/update",
);
let temporary;
let legacyDist = process.env.LEGACY_DIST;
let browser;
let server;
try {
  if (!legacyDist) {
    console.log(
      `Building historical update fixture ${legacyCommit.slice(0, 7)}`,
    );
    temporary = fs.mkdtempSync(path.join(os.tmpdir(), "orbita-legacy-"));
    const archive = path.join(temporary, "legacy.tar");
    execFileSync("git", [
      "archive",
      `--output=${archive}`,
      legacyCommit,
      "src",
      "public",
      "index.html",
      "vite.config.ts",
      "tsconfig.json",
      "package.json",
      "package-lock.json",
    ]);
    execFileSync("tar", ["-xf", archive, "-C", temporary]);
    fs.unlinkSync(archive);
    fs.symlinkSync(
      path.join(root, "node_modules"),
      path.join(temporary, "node_modules"),
      "dir",
    );
    execFileSync("npm", ["run", "build"], {
      cwd: temporary,
      env: { ...process.env, VITE_BASE_PATH: base },
      stdio: "pipe",
    });
    legacyDist = path.join(temporary, "dist");
  }
  assert.ok(fs.existsSync(path.join(legacyDist, "registerSW.js")));
  assert.ok(
    fs
      .readFileSync(path.join(currentDist, "sw.js"), "utf8")
      .includes("sw-recovery.js"),
  );
  const mime = {
    ".html": "text/html",
    ".js": "text/javascript",
    ".css": "text/css",
    ".json": "application/json",
    ".webmanifest": "application/manifest+json",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".woff2": "font/woff2",
  };
  let phase = "legacy";
  server = http.createServer((req, res) => {
    const url = new URL(req.url, "http://localhost");
    if (!url.pathname.startsWith(base)) {
      res.writeHead(404).end();
      return;
    }
    const name =
      decodeURIComponent(url.pathname.slice(base.length)) || "index.html";
    const directory = path.resolve(
      phase === "legacy" ? legacyDist : currentDist,
    );
    const filename = path.resolve(directory, name);
    if (
      !filename.startsWith(directory + path.sep) ||
      !fs.existsSync(filename) ||
      !fs.statSync(filename).isFile()
    ) {
      res.writeHead(404).end();
      return;
    }
    let body = fs.readFileSync(filename);
    if (phase === "next" && name === "index.html")
      body = Buffer.from(
        body.toString().replace("<html ", '<html data-update-fixture="next" '),
      );
    if (phase === "next" && name === "sw.js") {
      const original = body.toString();
      const changed = original.replace(
        /(url:"index\.html",revision:")[^"]+/,
        "$1next-update-fixture",
      );
      assert.notEqual(
        changed,
        original,
        "Next-build fixture must change the index precache revision",
      );
      body = Buffer.from(changed);
    }
    res.writeHead(200, {
      "Content-Type":
        mime[path.extname(filename)] || "application/octet-stream",
      "Cache-Control": "no-store",
    });
    res.end(body);
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const baseURL = `http://127.0.0.1:${server.address().port}${base}`;
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    args: ["--no-sandbox", "--enable-unsafe-swiftshader"],
  });
  fs.mkdirSync(evidence, { recursive: true });
  const errors = [];
  const data = JSON.parse(
    fs.readFileSync(path.join(root, "public/mock/dashboard-data.json"), "utf8"),
  );
  data.meta.reportDate = "Сохранённый период";
  data.block3_atmTso.dashboard10_workingEquipmentAndDowntime.downtime[2].name =
    "Rec";
  const saved = {
    "orbita-demo-v1": JSON.stringify(data),
    "orbita-config-v1": JSON.stringify({
      mode: "mock",
      url: "/api/preserved",
      pollingSec: 0,
    }),
  };
  const modes = [];
  for (const recovery of ["during-install", "after-activation"]) {
    console.log(`Checking legacy recovery: ${recovery}`);
    phase = "legacy";
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    });
    // The legacy fixture is Russian; pin the same locale across the real upgrade.
    await context.addInitScript(() => {
      if (!localStorage.getItem("orbita-locale"))
        localStorage.setItem("orbita-locale", "ru");
    });
    context.setDefaultTimeout(30000);
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(baseURL);
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.evaluate((values) => {
      for (const [key, value] of Object.entries(values))
        localStorage.setItem(key, value);
    }, saved);
    await page.reload();
    await page.waitForFunction(() => !!navigator.serviceWorker.controller);
    await expect(page.locator("h1")).toHaveText("Всё в поле зрения.");
    await expect(page.locator(".eyebrow")).toBeVisible();
    assert.ok(await page.locator(".dashboard-index").count());
    await expect(page.locator(".report-period")).toContainText(
      data.meta.reportDate,
    );
    const sibling = await context.newPage();
    await sibling.goto(baseURL);
    await expect(sibling.locator("h1")).toHaveText("Всё в поле зрения.");
    if (recovery === "during-install")
      await page.screenshot({ path: path.join(evidence, "legacy-cached.png") });
    phase = "current";
    if (recovery === "after-activation") {
      await page.evaluate(async () => {
        window.__legacyController = navigator.serviceWorker.controller;
        const registration = await navigator.serviceWorker.ready;
        await registration.update();
      });
      await page.waitForFunction(
        () =>
          navigator.serviceWorker.controller &&
          navigator.serviceWorker.controller !== window.__legacyController &&
          navigator.serviceWorker.controller.state === "activated",
      );
      assert.ok(
        await page.evaluate(() =>
          caches.has(
            `orbita-update-protocol-v1:${new URL("./", location.href).href}`,
          ),
        ),
      );
      // Migration may change the controller, but may not navigate any ordinary old tab.
      await expect(page.locator("h1")).toHaveText("Всё в поле зрения.");
    }
    await page.goto(`${baseURL}?orbita-update=1`);
    await expect(page.locator("h1")).toHaveText("Обзор", { timeout: 30000 });
    await expect(page.locator(".card-10 .progress-label").nth(2)).toHaveText(
      "Recycle",
    );
    await expect(page).toHaveURL(baseURL);
    await expect(
      page.locator(".eyebrow, .dashboard-index, .wing-symbol"),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Обновить приложение", exact: true }),
    ).toHaveCount(0);
    await expect(page.locator(".report-period")).toContainText(
      data.meta.reportDate,
    );
    assert.deepEqual(
      await page.evaluate(() => ({
        "orbita-demo-v1": localStorage.getItem("orbita-demo-v1"),
        "orbita-config-v1": localStorage.getItem("orbita-config-v1"),
      })),
      saved,
    );
    await expect(sibling.locator("h1")).toHaveText("Всё в поле зрения.");
    if (recovery === "during-install")
      await page.screenshot({
        path: path.join(evidence, "updated-overview.png"),
      });
    modes.push(recovery);
    if (recovery === "after-activation") {
      await sibling.reload();
      await expect(sibling.locator("h1")).toHaveText("Обзор");
      await page.bringToFront();
      await page
        .getByRole("button", { name: "Источники данных", exact: true })
        .click();
      await page
        .getByRole("tab", { name: "Подключение API", exact: true })
        .click();
      const draft = "/api/unsaved-draft";
      await page.getByLabel("Адрес API").fill(draft);
      await page.evaluate(() => {
        window.__updateSentinel = "draft-is-open";
      });
      phase = "next";
      console.log("Checking the next release with an unsaved draft");
      await page.evaluate(() => window.dispatchEvent(new Event("online")));
      await page.waitForFunction(
        async () =>
          !!(await navigator.serviceWorker.getRegistration())?.waiting,
      );
      assert.equal(
        await page.evaluate(() => window.__updateSentinel),
        "draft-is-open",
      );
      await expect(page.getByLabel("Адрес API")).toHaveValue(draft);
      await expect(page.locator("html")).not.toHaveAttribute(
        "data-update-fixture",
        "next",
      );
      // Update control stays outside the modal's focus/inert boundary.
      await page.getByRole("button", { name: "Закрыть", exact: true }).click();
      await expect(
        page.getByRole("dialog", { name: "Есть несохранённые изменения" }),
      ).toBeVisible();
      await page
        .getByRole("button", { name: "Отбросить изменения", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Обновить приложение", exact: true })
        .click();
      await expect(page.locator("html")).toHaveAttribute(
        "data-update-fixture",
        "next",
      );
      await expect(page.locator("h1")).toHaveText("Обзор");
      await expect(sibling.locator("html")).not.toHaveAttribute(
        "data-update-fixture",
        "next",
      );
      await expect(
        sibling.getByRole("button", {
          name: "Обновить приложение",
          exact: true,
        }),
      ).toBeVisible();
      assert.deepEqual(
        await page.evaluate(() => ({
          "orbita-demo-v1": localStorage.getItem("orbita-demo-v1"),
          "orbita-config-v1": localStorage.getItem("orbita-config-v1"),
        })),
        saved,
      );
      await context.setOffline(true);
      await page.reload();
      await expect(page.locator("h1")).toHaveText("Обзор");
      await expect(page.locator(".report-period")).toContainText(
        data.meta.reportDate,
      );
      assert.equal(await page.locator("[data-dashboard-id]").count(), 10);
    }
    await context.close();
  }
  assert.deepEqual(errors, []);
  const result = {
    legacyCommit,
    scope: base,
    recoveryModes: modes,
    realLegacyCachedUI: true,
    cleanOverview: true,
    savedDemoAndConfigPreserved: true,
    legacyRecycleLabel: true,
    siblingNotReloaded: true,
    subsequentUpdateWaitsForClick: true,
    unsavedDraftAndGuardPreserved: true,
    offlineAfterUpdate: true,
    errors,
  };
  fs.writeFileSync(
    path.join(evidence, "update-smoke.json"),
    JSON.stringify(result, null, 2) + "\n",
  );
  console.log(result);
} finally {
  await browser?.close();
  if (server?.listening) await new Promise((resolve) => server.close(resolve));
  if (temporary) fs.rmSync(temporary, { recursive: true, force: true });
}
