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
// Visual SLA reference explicitly requested in the 18 October hotfix.
export const DOWNTIME_LIMIT = 5;
export const meterMaximum = (percent: number, mode: "plan" | "downtime") =>
  mode === "plan"
    ? Math.max(120, Math.ceil(percent / 20) * 20)
    : Math.max(10, Math.ceil(percent / 5) * 5);
export function gaugeTone(
  value: number,
  mode: "plan" | "downtime",
): "success" | "cyan" | "warning" | "danger" {
  if (mode === "plan")
    return value >= 95 ? "success" : value >= 85 ? "cyan" : "warning";
  return value <= 2
    ? "success"
    : value <= DOWNTIME_LIMIT
      ? "warning"
      : "danger";
}
export const downtimeLabel = (value: number) =>
  t(
    value <= 2
      ? "Низкий простой"
      : value <= DOWNTIME_LIMIT
        ? "Рабочий уровень"
        : "Высокий простой",
  );

/** Visible source text only for states that need attention; demo, live and simulation stay quiet. */
export function sourceNotice(
  source: Source,
  hasLiveSnapshot = false,
): string | null {
  return source === "fallback" || source === "error"
    ? formatSource(source, hasLiveSnapshot)
    : null;
}
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
