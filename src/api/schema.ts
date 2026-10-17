import { z } from "zod";

const label = z.string().min(1).max(120);
const value = z.number().finite().nonnegative().max(Number.MAX_SAFE_INTEGER);
const percent = value.max(1000);
const downtime = value.max(100);
const points = z.array(value).max(366);
const gauge = z.object({ label, percent, value, scaleMode: z.literal("ytd") });
const monthly = z.object({
  planBars: z.array(z.object({ label, percent })).length(3),
  cards: z
    .array(
      z.object({
        title: label,
        value,
        delta: z.string().max(24),
        spark: points,
      }),
    )
    .length(3),
});

/** Full contract for all ten dashboards. Unknown extra API fields are stripped. */
export const dashboardSchema = z.object({
  meta: z.object({
    reportDate: label,
    ytdStartLabel: label,
    currency: z.string().min(1).max(8),
  }),
  block1_payments: z.object({
    dashboard1_channels: z.object({
      channels: z
        .array(z.object({ name: label, jan: value, cur: value }))
        .max(20),
      dboSharePercent: downtime,
    }),
    dashboard2_monthlyCount: monthly,
    dashboard3_monthlyVolume: monthly,
    dashboard4_ytdMain: z.array(gauge).length(3),
  }),
  block2_cashDesk: z.object({
    dashboard5_operationTypes: z.object({
      monthlyPlanPercent: percent,
      types: z
        .array(
          z.object({
            name: label,
            count: value,
            color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
          }),
        )
        .max(12),
    }),
    dashboard6_ytdMain: z.array(gauge).length(3),
    dashboard7_operationsAndStaff: z.object({
      workingCashDesksByDay: points,
      staffShortageVacancies: value.int(),
      downtimeTodayPercent: downtime,
    }),
  }),
  block3_atmTso: z.object({
    dashboard8_operationsCount: z.array(gauge).length(2),
    dashboard9_operationsVolume: z.array(gauge).length(2),
    dashboard10_workingEquipmentAndDowntime: z
      .object({
        days: z.array(z.string().min(1).max(20)).max(366),
        tsoLine: points,
        atmLine: points,
        recLine: points,
        downtime: z
          .array(z.object({ name: label, percent: downtime }))
          .length(3),
      })
      .superRefine((v, ctx) => {
        for (const key of ["tsoLine", "atmLine", "recLine"] as const)
          if (v[key].length !== v.days.length)
            ctx.addIssue({
              code: "custom",
              path: [key],
              message: "Число значений должно совпадать с числом дней",
            });
      }),
  }),
});
export type DashboardData = z.infer<typeof dashboardSchema>;
export type ApiConfig = {
  mode: "mock" | "hybrid" | "live";
  url: string;
  token: string;
  pollingSec: number;
};
export type Source = "mock" | "simulation" | "live" | "fallback" | "error";

// Keep validation errors as controlled source copy. The UI translates on render
// so a language change also updates errors already held in a form or store.
function validationMessage(issue: z.core.$ZodIssue, input: unknown): string {
  switch (issue.code) {
    case "invalid_type": {
      const types: Record<string, string> = {
        string: "строка",
        number: "число",
        int: "целое число",
        array: "массив",
        object: "объект",
        boolean: "логическое значение",
        undefined: "отсутствующее значение",
        bigint: "большое целое число",
        symbol: "символ",
      };
      const actual = issue.path.reduce<unknown>(
        (current, key) =>
          current !== null && typeof current === "object"
            ? (current as Record<PropertyKey, unknown>)[key]
            : undefined,
        input,
      );
      const received =
        actual === null
          ? "null"
          : Array.isArray(actual)
            ? "массив"
            : typeof actual === "number" && !Number.isFinite(actual)
              ? "нефинитное число"
              : types[typeof actual];
      return `Ожидается ${types[issue.expected] ?? "значение подходящего типа"}; получено: ${received}.`;
    }
    case "too_small":
      return `Минимум: ${issue.minimum}.`;
    case "too_big":
      return `Максимум: ${issue.maximum}.`;
    case "invalid_format":
      return "Неверный формат значения.";
    case "invalid_value":
      return "Недопустимое значение.";
    case "custom":
      return issue.message;
    default:
      return "Некорректное значение.";
  }
}
export function parseData(input: unknown): DashboardData {
  const result = dashboardSchema.safeParse(input);
  if (!result.success) {
    const issue = result.error.issues[0];
    throw new Error(
      `Проверьте ${issue.path.join(".") || "корень JSON"}: ${validationMessage(issue, input)}`,
    );
  }
  return result.data;
}
export function validateEndpoint(input: string): string | null {
  if (!input.trim()) return "Укажите HTTPS-адрес API или путь /api/dashboard.";
  if (input.startsWith("/") && !input.startsWith("//") && !/[\\?#]/.test(input))
    return null;
  try {
    const url = new URL(input);
    if (url.username || url.password || url.search || url.hash)
      return "Используйте URL без паролей, query-параметров и фрагмента. Токен задаётся отдельно.";
    if (url.protocol === "https:") return null;
    if (
      url.protocol === "http:" &&
      ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
    )
      return null;
  } catch {
    /* Invalid URL reported below. */
  }
  return "Нужен HTTPS-адрес. HTTP допустим только для localhost.";
}
