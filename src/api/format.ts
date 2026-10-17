import type { Source } from "./schema";

export function formatNumber(n: number, compact = false): string {
  if (compact && Math.abs(n) >= 1e9)
    return `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 }).format(n / 1e9)} млрд`;
  if (compact && Math.abs(n) >= 1e6)
    return `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 }).format(n / 1e6)} млн`;
  if (compact && Math.abs(n) >= 1e3)
    return `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 }).format(n / 1e3)} тыс.`;
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(n);
}
export const formatPercent = (n: number) =>
  `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 }).format(n)}%`;
export const formatTime = (time: number) =>
  new Intl.DateTimeFormat("ru-RU", {
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
  value <= 2
    ? "Низкий простой"
    : value <= 6.5
      ? "Рабочий уровень"
      : "Высокий простой";

export function formatSource(source: Source, hasLiveSnapshot = false): string {
  return {
    mock: "Демоданные",
    simulation: "Симуляция",
    live: "API подключён",
    fallback: hasLiveSnapshot ? "Последний снимок API" : "Резерв · демоданные",
    error: "Ошибка API",
  }[source];
}
