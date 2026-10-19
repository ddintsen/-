// Bootstrap: the locale must be stored before the product's i18n module is imported, and every
// Pryvat Sans weight must be loaded before any canvas texture is drawn.
import "@fontsource-variable/inter";
import "@fontsource-variable/manrope";
import "./fonts.css";

const params = new URLSearchParams(location.search);
const locale = params.get("locale") === "en" ? "en" : "uk";
try {
  localStorage.setItem("orbita-locale", locale);
} catch {
  /* storage optional */
}
document.documentElement.lang = locale;

const faces = [
  ...[400, 500, 600, 700].map((w) => `${w} 28px "Pryvat Sans"`),
  ...[400, 500, 600, 700].map((w) => `${w} 28px "Pryvat Sans Display"`),
];
await Promise.all(faces.map((f) => document.fonts.load(f, "АБВабв0123 Orbita")));
await document.fonts.ready;
const { start } = await import("./film");
await start(locale);
