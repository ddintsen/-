import test from "node:test";
import assert from "node:assert/strict";
import { collectDeploymentStatus } from "./deployment-status.mjs";
const context = {
  repository: "ddintsen/-",
  token: "TEST_MEMORY_ONLY",
  sourceCommit: "abc",
  runId: "1",
  phase: "preflight",
};
test("reports a live app only when HTML and its assets load, without leaking API credentials", async () => {
  const calls = [];
  const report = await collectDeploymentStatus(
    context,
    async (url, options) => {
      calls.push({ url, options });
      if (url.startsWith("https://api.github.com/"))
        return Response.json({
          build_type: "workflow",
          html_url: "https://ddintsen.github.io/-/",
        });
      if (options.method === "HEAD") return new Response(null, { status: 200 });
      return new Response(
        '<div id="root"></div><script type="module" src="/-/assets/app.js"></script>',
      );
    },
  );
  assert.equal(report.outcome, "site-responsive");
  assert.equal(report.site.assets.length, 1);
  assert.equal(
    calls[0].options.headers.Authorization,
    "Bearer TEST_MEMORY_ONLY",
  );
  assert.ok(
    calls
      .filter((call) => !call.url.startsWith("https://api.github.com/"))
      .every((call) => !call.options.headers?.Authorization),
  );
  assert.ok(!JSON.stringify(report).includes(context.token));
});
test("records only selected repository visibility metadata for import diagnostics", async () => {
  const report = await collectDeploymentStatus(context, async (url) => {
    if (url === "https://api.github.com/repos/ddintsen/-")
      return Response.json({
        visibility: "private",
        private: true,
        default_branch: "main",
        irrelevantField: "not part of receipt",
      });
    return new Response("Not Found", { status: 404 });
  });
  assert.deepEqual(report.repositoryAccess, {
    status: 200,
    visibility: "private",
    private: true,
    defaultBranch: "main",
  });
  assert.ok(!JSON.stringify(report).includes("irrelevantField"));
  assert.ok(!JSON.stringify(report).includes(context.token));
});
test("an absent Pages configuration and 404 site never count as a publication", async () => {
  const report = await collectDeploymentStatus(context, async (url) =>
    url.includes("api.github.com")
      ? Response.json({ message: "Not Found" }, { status: 404 })
      : new Response("Not Found", { status: 404 }),
  );
  assert.equal(report.outcome, "pages-not-configured");
  assert.equal(report.pages.status, 404);
  assert.equal(report.site.app, false);
});
test("HTML with a missing asset is not reported as a working app", async () => {
  const report = await collectDeploymentStatus(
    context,
    async (url, options) => {
      if (url.includes("api.github.com"))
        return Response.json({ build_type: "workflow" });
      if (options.method === "HEAD") return new Response(null, { status: 404 });
      return new Response(
        '<div id="root"></div><script src="/-/assets/missing.js"></script>',
      );
    },
  );
  assert.equal(report.outcome, "unconfirmed");
});
test("bounded request failures are recorded and no arbitrary repository path is accepted", async () => {
  const report = await collectDeploymentStatus(context, async () => {
    throw new Error("network");
  });
  assert.equal(report.outcome, "unconfirmed");
  assert.equal(report.pages.status, null);
  await assert.rejects(
    () => collectDeploymentStatus({ ...context, repository: "../bad/extra" }),
    /Invalid repository/,
  );
});
