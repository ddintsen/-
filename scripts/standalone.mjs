import fs from "node:fs";
import path from "node:path";

// Package the actual production app, including lazy XR code, as one local browser file.
const directory = path.resolve("standalone-dist");
const mime = { ".svg": "image/svg+xml", ".png": "image/png" };
function dataURL(file) {
  return `data:${mime[path.extname(file)]};base64,${fs.readFileSync(file).toString("base64")}`;
}
let html = fs.readFileSync(path.join(directory, "index.html"), "utf8");
html = html.replace(
  /<script\b[^>]*\bsrc="([^"]+)"[^>]*><\/script>/g,
  (_, source) => {
    const script = fs
      .readFileSync(path.resolve(directory, source), "utf8")
      .replace(/<\/script/gi, "<\\/script");
    return `<script type="module">${script}</script>`;
  },
);
html = html.replace(
  /<link\b[^>]*rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/g,
  (_, source) => {
    let css = fs.readFileSync(path.resolve(directory, source), "utf8");
    css = css.replace(
      /(?:\.?\.?\/)*images\/room\.png/g,
      dataURL("public/images/room.png"),
    );
    return `<style>${css}</style>`;
  },
);
html = html.replace(
  /href="(?:\.\/)?icon\.svg"/g,
  `href="${dataURL("public/icon.svg")}"`,
);
if (/<(?:script|link)\b[^>]*(?:src|href)="\.?\/?assets\//.test(html))
  throw new Error("Standalone file still references a build asset");
const file = path.join(directory, "orbita-preview.html");
fs.writeFileSync(file, html);
console.log(JSON.stringify({ file, bytes: fs.statSync(file).size }));
