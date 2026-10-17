import type { Source } from "./schema";
import { getLocale, intlLocale, t } from "../i18n";
export { formatReportDate } from "../i18n";

export function formatNumber(n: number, compact = false): string {
  const locale = getLocale();
  if (compact) {
    const scales = [
      [1e9, locale === "en" ? "B" : "млрд"],
      [1e6, locale === "en" ? "M" : "млн"],
      [1e3, locale === "en" ? "K" : locale === "uk" ? "тис." : "тыс."],
    ] as const;
    for (const [scale, unit] of scales)
      if (Math.abs(n) >= scale)
        return `${new Intl.NumberFormat(intlLocale(), { maximumFractionDigits: 1 }).format(n / scale)}${locale === "en" ? "" : " "}${unit}`;
  }
  return new Intl.NumberFormat(intlLocale(), {
    maximumFractionDigits: 2,
  }).format(n);
}
export const formatPercent = (n: number) =>
  `${new Intl.NumberFormat(intlLocale(), { maximumFractionDigits: 1 }).format(n)}%`;
export const formatTime = (time: number) =>
  new Intl.DateTimeFormat(intlLocale(), {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "Europe/Kyiv",
  }).format(time);
export function gaugeTone(
  value: number,
  mode: "plan" | "downtime",
): "success" | "warning" | "danger" {
  return mode === "plan" || value <= 2
    ? "success"
    : value <= 6.5
      ? "warning"
      : "danger";
}
export const downtimeLabel = (value: number) =>
  t(
    value <= 2
      ? "Низкий простой"
      : value <= 6.5
        ? "Рабочий уровень"
        : "Высокий простой",
  );

export function formatSource(source: Source, hasLiveSnapshot = false): string {
  return t(
    {
      mock: "Демоданные",
      simulation: "Симуляция",
      live: "API подключён",
      fallback: hasLiveSnapshot
        ? "Последний снимок API"
        : "Резерв · демоданные",
      error: "Ошибка API",
    }[source],
  );
}
