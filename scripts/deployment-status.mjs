import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

/** Collect a bounded deployment receipt. Credentials only go to the GitHub API, never to the site or report. */
export async function collectDeploymentStatus(
  {
    repository,
    token,
    sourceCommit,
    runId,
    phase,
    buildResult,
    deployResult,
    artifactIds = {},
  },
  fetchImpl = fetch,
) {
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository))
    throw new Error("Invalid repository");
  const [owner, name] = repository.split("/");
  const url = `https://${owner.toLowerCase()}.github.io/${encodeURIComponent(name)}/`;
  const report = {
    checkedAt: new Date().toISOString(),
    repository,
    sourceCommit,
    runId,
    phase,
    buildResult,
    deployResult,
    artifacts: Object.entries(artifactIds)
      .filter(
        ([name, id]) =>
          ["orbita-stackblitz", "orbita-preview"].includes(name) &&
          /^\d+$/.test(id) &&
          /^\d+$/.test(runId),
      )
      .map(([name, id]) => ({
        name,
        url: `https://github.com/${repository}/actions/runs/${runId}/artifacts/${id}`,
      })),
    repositoryAccess: null,
    pages: null,
    site: { url, status: null, app: false, assets: [] },
    outcome: "unconfirmed",
  };
  try {
    const response = await fetchImpl(
      `https://api.github.com/repos/${owner}/${name}`,
      {
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${token}`,
        },
        signal: AbortSignal.timeout(8000),
        redirect: "error",
      },
    );
    const data = await response.json();
    report.repositoryAccess = {
      status: response.status,
      visibility: response.ok ? (data.visibility ?? null) : null,
      private: response.ok ? (data.private ?? null) : null,
      defaultBranch: response.ok ? (data.default_branch ?? null) : null,
    };
  } catch {
    report.repositoryAccess = { status: null, visibility: null, private: null };
  }
  try {
    const response = await fetchImpl(
      `https://api.github.com/repos/${owner}/${name}/pages`,
      {
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${token}`,
        },
        signal: AbortSignal.timeout(8000),
        redirect: "error",
      },
    );
    const data = await response.json();
    report.pages = {
      status: response.status,
      configured: response.ok,
      buildType: data.build_type ?? null,
      htmlUrl: data.html_url ?? null,
      message: response.ok
        ? null
        : String(data.message ?? "GitHub API error").slice(0, 300),
    };
  } catch {
    report.pages = {
      status: null,
      configured: false,
      message: "GitHub Pages API request failed",
    };
  }
  try {
    const response = await fetchImpl(url, {
      signal: AbortSignal.timeout(8000),
      redirect: "manual",
      cache: "no-store",
    });
    report.site.status = response.status;
    const html = await response.text();
    report.site.app = response.ok && /id=["']root["']/.test(html);
    if (report.site.app) {
      const resources = [
        ...html.matchAll(
          /<(?:script|link)\b[^>]*(?:src|href)=["']([^"']+\.(?:js|css))["']/g,
        ),
      ].map((m) => new URL(m[1], url));
      for (const resource of resources.slice(0, 4)) {
        if (resource.origin !== new URL(url).origin) continue;
        const asset = await fetchImpl(resource.href, {
          method: "HEAD",
          signal: AbortSignal.timeout(8000),
          redirect: "manual",
        });
        report.site.assets.push({
          path: resource.pathname,
          status: asset.status,
        });
      }
      if (
        report.site.assets.length &&
        report.site.assets.every((a) => a.status === 200)
      )
        report.outcome = "site-responsive";
    }
    if (!report.site.app && report.pages?.status === 404)
      report.outcome = "pages-not-configured";
  } catch {
    report.site.error = "Public site request failed";
  }
  return report;
}

async function main() {
  if (!process.env.GITHUB_TOKEN)
    throw new Error("GitHub workflow token missing");
  const report = await collectDeploymentStatus({
    repository: process.env.GITHUB_REPOSITORY,
    token: process.env.GITHUB_TOKEN,
    sourceCommit: process.env.GITHUB_SHA,
    runId: process.env.GITHUB_RUN_ID,
    phase: process.env.DEPLOYMENT_PHASE,
    buildResult: process.env.BUILD_RESULT || null,
    deployResult: process.env.DEPLOY_RESULT || null,
    artifactIds: {
      "orbita-stackblitz": process.env.STACKBLITZ_ARTIFACT_ID,
      "orbita-preview": process.env.PREVIEW_ARTIFACT_ID,
    },
  });
  const output = process.env.DEPLOYMENT_STATUS_OUTPUT;
  if (!output) throw new Error("Deployment receipt output path missing");
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
  console.log(
    JSON.stringify({
      outcome: report.outcome,
      pagesStatus: report.pages.status,
      siteStatus: report.site.status,
      phase: report.phase,
    }),
  );
}
if (
  process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url
)
  await main();
