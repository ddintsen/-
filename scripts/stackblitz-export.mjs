import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const exportedPaths = [
  "src/",
  "public/",
  "tests/",
  "index.html",
  "package.json",
  "package-lock.json",
  "tsconfig.json",
  "vite.config.ts",
  "playwright.config.ts",
];

// The official SDK accepts text files only. Restore the original PNG bytes
// before Vite starts rather than replacing the project's artwork.
export function createProjectSnapshot(root) {
  const revision = execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: root,
    encoding: "utf8",
  }).trim();
  const paths = execFileSync(
    "git",
    ["ls-files", "-z", "--", ...exportedPaths],
    {
      cwd: root,
      encoding: "utf8",
    },
  )
    .split("\0")
    .filter(Boolean);
  const files = {};
  const binaries = {};
  for (const filename of paths) {
    const bytes = fs.readFileSync(path.join(root, filename));
    if (filename.endsWith(".png"))
      binaries[filename] = bytes.toString("base64");
    else files[filename] = bytes.toString("utf8");
  }
  files["scripts/restore-preview-assets.mjs"] = `import fs from 'node:fs';
const assets = ${JSON.stringify(binaries)};
for (const [name, encoded] of Object.entries(assets)) {
  const destination = new URL('../' + name, import.meta.url);
  fs.mkdirSync(new URL('.', destination), { recursive: true });
  fs.writeFileSync(destination, Buffer.from(encoded, 'base64'));
}
console.log('Preview images restored');
`;
  const original = JSON.parse(files["package.json"]);
  original.scripts = {
    dev: "node scripts/restore-preview-assets.mjs && vite --host 0.0.0.0",
    build: "node scripts/restore-preview-assets.mjs && tsc -b && vite build",
    preview: "vite preview --host 0.0.0.0",
    typecheck: "tsc -b",
    test: "vitest run",
  };
  files["package.json"] = JSON.stringify(original, null, 2) + "\n";
  files[".stackblitzrc"] = JSON.stringify({
    installDependencies: true,
    startCommand: "npm run dev",
  });
  files["PREVIEW_VERSION.json"] = JSON.stringify(
    {
      repository: "ddintsen/-",
      sourceCommit: revision,
      createdAt: new Date().toISOString(),
    },
    null,
    2,
  );
  return {
    title: `Орбита · ${revision.slice(0, 7)}`,
    description:
      "Аналитика департамента · демонстрационные данные · снимок разработки",
    template: "node",
    files,
  };
}

export function renderLauncher(project) {
  // JSON remains data even when an exported source file contains </script>.
  const payload = JSON.stringify(project).replaceAll("<", "\\u003c");
  return `<!doctype html>
<html lang="ru">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="referrer" content="no-referrer">
<title>Открыть Орбиту в StackBlitz</title>
<h1>Орбита в StackBlitz</h1>
<p>Нажмите кнопку, затем дождитесь установки зависимостей и откройте Preview.</p>
<p>В StackBlitz будут переданы исходники приложения и демоданные. Доступ к GitHub не требуется для передачи файлов.</p>
<form id="launch" method="post" action="https://stackblitz.com/run?view=preview&amp;startScript=dev">
  <button type="submit" disabled>Открыть проект в StackBlitz</button>
</form>
<p id="version"></p>
<p>Это снимок версии. Для просмотра следующих изменений нужен обновлённый файл импорта.</p>
<noscript>Для передачи проекта включите JavaScript в браузере.</noscript>
<script id="project-data" type="application/json">${payload}</script>
<script>
// Form protocol from the official @stackblitz/sdk 1.11.1 createProjectForm:
// https://github.com/stackblitz/sdk (MIT), POST /run, template=node.
const project = JSON.parse(document.getElementById('project-data').textContent);
const form = document.getElementById('launch');
function add(name, value) {
  const input = document.createElement('input');
  input.type = 'hidden'; input.name = name; input.value = value;
  form.appendChild(input);
}
for (const field of ['title', 'description', 'template']) add('project[' + field + ']', project[field]);
for (const [name, content] of Object.entries(project.files)) {
  const encoded = name.replaceAll('[', '%5B').replaceAll(']', '%5D');
  add('project[files][' + encoded + ']', content);
}
document.getElementById('version').textContent = project.title;
form.querySelector('button').disabled = false;
</script>
</html>`;
}

async function main() {
  const root = process.cwd();
  const project = createProjectSnapshot(root);
  const output = path.join(root, "stackblitz-export");
  fs.mkdirSync(output, { recursive: true });
  fs.writeFileSync(path.join(output, "project.json"), JSON.stringify(project));
  fs.writeFileSync(
    path.join(output, "orbita-stackblitz.html"),
    renderLauncher(project),
  );
  console.log(
    `StackBlitz import: ${Object.keys(project.files).length} files, ${project.title}`,
  );
}

if (
  process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url
)
  await main();
