import {
  parseData,
  validateEndpoint,
  type ApiConfig,
  type DashboardData,
  type Source,
} from "./schema";

export class DataError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
/** Read only, bounded request; never stores or logs credentials or raw server bodies. */
export async function requestData(
  config: ApiConfig,
  signal?: AbortSignal,
): Promise<{ data: DashboardData; latency: number }> {
  const error = validateEndpoint(config.url);
  if (error) throw new DataError("url", error);
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, 4000);
  const cancel = () => controller.abort();
  signal?.addEventListener("abort", cancel, { once: true });
  if (signal?.aborted) controller.abort();
  const start = performance.now();
  try {
    const response = await fetch(config.url, {
      method: "GET",
      signal: controller.signal,
      cache: "no-store",
      credentials: "omit",
      redirect: "error",
      headers: {
        Accept: "application/json",
        ...(config.token ? { Authorization: `Bearer ${config.token}` } : {}),
      },
    });
    if (!response.ok)
      throw new DataError(
        "http",
        `API вернул HTTP ${response.status}. Проверьте доступ и состояние сервера.`,
      );
    if (Number(response.headers.get("content-length")) > 1_000_000)
      throw new DataError("size", "Ответ API превышает 1 МБ.");
    const body = await response.text();
    if (body.length > 1_000_000)
      throw new DataError("size", "Ответ API превышает 1 МБ.");
    let parsed: unknown;
    try {
      parsed = JSON.parse(body);
    } catch {
      throw new DataError("schema", "API вернул невалидный JSON.");
    }
    try {
      return {
        data: parseData(parsed),
        latency: Math.round(performance.now() - start),
      };
    } catch (e) {
      throw new DataError(
        "schema",
        e instanceof Error ? e.message : "Некорректная схема данных.",
      );
    }
  } catch (e) {
    if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");
    if (timedOut)
      throw new DataError(
        "timeout",
        "API не ответил за 4 секунды. Повторите запрос или проверьте сервер.",
      );
    if (e instanceof DataError) throw e;
    throw new DataError(
      "network",
      "Не удалось прочитать API. Проверьте сеть, HTTPS и разрешение CORS на сервере.",
    );
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", cancel);
  }
}
export async function loadData(
  config: ApiConfig,
  mock: DashboardData,
  lastLive: DashboardData | null,
  signal?: AbortSignal,
): Promise<{
  data: DashboardData | null;
  source: Source;
  error: string | null;
  latency: number | null;
}> {
  if (config.mode === "mock")
    return { data: mock, source: "mock", error: null, latency: null };
  try {
    const result = await requestData(config, signal);
    return { ...result, source: "live", error: null };
  } catch (e) {
    if (signal?.aborted) throw e;
    const error =
      e instanceof Error ? e.message : "Не удалось загрузить данные.";
    return config.mode === "hybrid"
      ? { data: lastLive ?? mock, source: "fallback", error, latency: null }
      : { data: lastLive, source: "error", error, latency: null };
  }
}
