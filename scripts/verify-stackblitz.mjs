import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createServer } from "node:http";
import { chromium } from "@playwright/test";
import { createProjectSnapshot, renderLauncher } from "./stackblitz-export.mjs";

const root = process.cwd();
const project = createProjectSnapshot(root);
assert.ok(
  !Object.keys(project.files).some(
    (name) =>
      name.startsWith(".git/") ||
      name.startsWith(".env") ||
      name.startsWith("docs/"),
  ),
);
const extracted = fs.mkdtempSync(path.join(os.tmpdir(), "orbita-stackblitz-"));
try {
  for (const [name, contents] of Object.entries(project.files)) {
    const destination = path.join(extracted, name);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, contents);
  }
  execFileSync(process.execPath, ["scripts/restore-preview-assets.mjs"], {
    cwd: extracted,
  });
  for (const name of [
    "public/images/room.png",
    "public/icon-192.png",
    "public/icon-512.png",
  ])
    assert.deepEqual(
      fs.readFileSync(path.join(extracted, name)),
      fs.readFileSync(path.join(root, name)),
      `Binary restore mismatch: ${name}`,
    );
  fs.symlinkSync(
    path.join(root, "node_modules"),
    path.join(extracted, "node_modules"),
  );
  execFileSync("npm", ["run", "build"], {
    cwd: extracted,
    stdio: "pipe",
    timeout: 120000,
  });
  assert.ok(fs.existsSync(path.join(extracted, "dist/index.html")));
} finally {
  fs.rmSync(extracted, { recursive: true, force: true });
}

// An adversarial source string must remain data throughout HTML and form encoding.
project.files["transport-check.txt"] =
  "</script><script>window.__injected = true</script>\nКириллица & + = %";
const html = renderLauncher(project);
const server = createServer((request, response) => {
  response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  response.end(html);
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
  args: ["--no-sandbox"],
});
try {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  let sent;
  await page.route("https://stackblitz.com/run?*", async (route) => {
    assert.equal(route.request().method(), "POST");
    sent = new URLSearchParams(route.request().postData());
    await route.fulfill({
      status: 200,
      contentType: "text/html",
      body: "Import request captured locally",
    });
  });
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  assert.equal(await page.evaluate(() => window.__injected), undefined);
  await page
    .getByRole("button", { name: "Открыть проект в StackBlitz" })
    .click();
  await page.waitForURL("https://stackblitz.com/run?*");
  assert.equal(sent.get("project[template]"), "node");
  for (const [name, value] of Object.entries(project.files)) {
    const encoded = name.replaceAll("[", "%5B").replaceAll("]", "%5D");
    // Browsers normalize textarea/input newlines to CRLF during form submission.
    assert.equal(
      sent.get(`project[files][${encoded}]`)?.replaceAll("\r\n", "\n"),
      value.replaceAll("\r\n", "\n"),
      `Transport mismatch: ${name}`,
    );
  }
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify({
      files: Object.keys(project.files).length - 1,
      binaryRestore: true,
      exportedBuild: true,
      postTransport: true,
      escapedSource: true,
      remoteStackBlitzTested: false,
    }),
  );
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
