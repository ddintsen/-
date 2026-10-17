import { useEffect, useRef, useState } from "react";
import {
  Cable,
  Database,
  Eye,
  EyeOff,
  Play,
  Pause,
  Copy,
  Download,
  RefreshCw,
  CheckCircle2,
  TriangleAlert,
} from "lucide-react";
import { type ApiConfig, parseData, validateEndpoint } from "../api/schema";
import { requestData } from "../api/client";
import { useDashboardStore } from "../store/dashboard";
import { Button, Field, Modal, NativeSelect, notify } from "./ui";

export function Admin({ onClose }: { onClose: () => void }) {
  const s = useDashboardStore();
  const [tab, setTab] = useState<"connection" | "demo">("connection");
  const [config, setConfig] = useState<ApiConfig>({ ...s.config });
  const [revealed, setRevealed] = useState(false);
  const [json, setJson] = useState(() => JSON.stringify(s.mock, null, 2));
  const [savedJson, setSavedJson] = useState(json);
  const [revision, setRevision] = useState(s.revision);
  const [urlError, setUrlError] = useState(""),
    [jsonError, setJsonError] = useState("");
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(
    null,
  );
  const [checking, setChecking] = useState(false),
    [guard, setGuard] = useState(false);
  const checkController = useRef<AbortController | null>(null);
  const [quick, setQuick] = useState({
    dbo: String(s.mock.block1_payments.dashboard1_channels.dboSharePercent),
    vacancies: String(
      s.mock.block2_cashDesk.dashboard7_operationsAndStaff
        .staffShortageVacancies,
    ),
    downtime: String(
      s.mock.block3_atmTso.dashboard10_workingEquipmentAndDowntime.downtime[1]
        .percent,
    ),
  });
  const [savedQuick, setSavedQuick] = useState(JSON.stringify(quick));
  const [quickError, setQuickError] = useState("");
  const configDirty = JSON.stringify(config) !== JSON.stringify(s.config),
    jsonDirty = json !== savedJson;
  const quickDirty = JSON.stringify(quick) !== savedQuick;
  const dirty = configDirty || jsonDirty || quickDirty;
  const conflict = (jsonDirty || quickDirty) && revision !== s.revision;
  useEffect(() => () => checkController.current?.abort(), []);
  useEffect(() => {
    if (!dirty) return;
    const fn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", fn);
    return () => window.removeEventListener("beforeunload", fn);
  }, [dirty]);
  function close() {
    if (dirty) setGuard(true);
    else onClose();
  }
  function resetEditor() {
    const state = useDashboardStore.getState();
    const text = JSON.stringify(state.mock, null, 2);
    setJson(text);
    setSavedJson(text);
    setRevision(state.revision);
    setQuick({
      dbo: String(
        state.mock.block1_payments.dashboard1_channels.dboSharePercent,
      ),
      vacancies: String(
        state.mock.block2_cashDesk.dashboard7_operationsAndStaff
          .staffShortageVacancies,
      ),
      downtime: String(
        state.mock.block3_atmTso.dashboard10_workingEquipmentAndDowntime
          .downtime[1].percent,
      ),
    });
    setSavedQuick(
      JSON.stringify({
        dbo: String(
          state.mock.block1_payments.dashboard1_channels.dboSharePercent,
        ),
        vacancies: String(
          state.mock.block2_cashDesk.dashboard7_operationsAndStaff
            .staffShortageVacancies,
        ),
        downtime: String(
          state.mock.block3_atmTso.dashboard10_workingEquipmentAndDowntime
            .downtime[1].percent,
        ),
      }),
    );
    setJsonError("");
  }
  function set<K extends keyof ApiConfig>(key: K, value: ApiConfig[K]) {
    setConfig((c) => ({ ...c, [key]: value }));
    setResult(null);
    setUrlError("");
    checkController.current?.abort();
    setChecking(false);
  }
  function valid() {
    const error = validateEndpoint(config.url);
    setUrlError(error ?? "");
    if (error) document.getElementById("endpoint")?.focus();
    return !error;
  }
  async function check() {
    if (!valid()) return;
    setChecking(true);
    setResult(null);
    const controller = new AbortController();
    checkController.current?.abort();
    checkController.current = controller;
    try {
      const r = await requestData(config, controller.signal);
      if (!controller.signal.aborted)
        setResult({
          ok: true,
          message: `Ответ получен · ${r.latency} мс`,
        });
    } catch (e) {
      if (!controller.signal.aborted)
        setResult({
          ok: false,
          message: e instanceof Error ? e.message : "Не удалось проверить API.",
        });
    } finally {
      if (!controller.signal.aborted) setChecking(false);
    }
  }
  function save() {
    if (config.mode !== "mock" && !valid()) return;
    if (config.url && !valid()) return;
    s.setConfig({ ...config });
    notify("Сохранено в этом браузере");
  }
  function applyJson() {
    try {
      if (conflict) {
        setJsonError(
          "Данные изменились. Загрузите актуальную версию перед применением.",
        );
        return;
      }
      const parsed = parseData(JSON.parse(json));
      s.applyDemo(parsed);
      setConfig({ ...useDashboardStore.getState().config });
      resetEditor();
      notify("Демоданные обновлены");
    } catch (e) {
      setJsonError(
        e instanceof SyntaxError
          ? "Некорректный JSON. Проверьте запятые, кавычки и скобки."
          : e instanceof Error
            ? e.message
            : "Проверьте данные.",
      );
      document.getElementById("json-editor")?.focus();
    }
  }
  function applyQuick() {
    if (conflict) {
      setQuickError("Данные изменились. Загрузите актуальную версию.");
      return;
    }
    const dbo = Number(quick.dbo),
      vacancies = Number(quick.vacancies),
      downtime = Number(quick.downtime);
    if (
      Object.values(quick).some((x) => !x.trim()) ||
      ![dbo, vacancies, downtime].every(Number.isFinite) ||
      dbo < 0 ||
      dbo > 100 ||
      downtime < 0 ||
      downtime > 100 ||
      vacancies < 0 ||
      !Number.isSafeInteger(vacancies)
    ) {
      setQuickError(
        "Доли и простой: от 0 до 100. Вакансии: целое неотрицательное число.",
      );
      document.getElementById("quick-dbo")?.focus();
      return;
    }
    const d = structuredClone(useDashboardStore.getState().mock);
    d.block1_payments.dashboard1_channels.dboSharePercent = dbo;
    d.block2_cashDesk.dashboard7_operationsAndStaff.staffShortageVacancies =
      vacancies;
    d.block3_atmTso.dashboard10_workingEquipmentAndDowntime.downtime[1].percent =
      downtime;
    s.applyDemo(d);
    setConfig({ ...useDashboardStore.getState().config });
    resetEditor();
    setQuickError("");
    notify("Ключевые показатели обновлены");
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(json);
      notify("JSON скопирован");
    } catch {
      setJsonError(
        "Копирование недоступно. Выделите текст в редакторе или скачайте JSON.",
      );
    }
  }
  function download() {
    try {
      const data = parseData(JSON.parse(json));
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = "dashboard-data.json";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setJsonError("Перед скачиванием исправьте JSON.");
    }
  }
  return (
    <>
      <Modal
        title="Источники данных"
        onClose={close}
        wide
        className="settings-modal"
      >
        <div
          className="settings-tabs"
          role="group"
          aria-label="Раздел настроек"
        >
          <Button
            className={tab === "connection" ? "selected" : ""}
            aria-pressed={tab === "connection"}
            onClick={() => setTab("connection")}
          >
            <Cable size={17} />
            Подключение API
          </Button>
          <Button
            className={tab === "demo" ? "selected" : ""}
            aria-pressed={tab === "demo"}
            onClick={() => setTab("demo")}
          >
            <Database size={17} />
            Демонстрация
          </Button>
        </div>
        {tab === "connection" ? (
          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              save();
            }}
            className="settings-body"
          >
            <div className="form-columns">
              <Field id="api-mode" label="Источник">
                <NativeSelect
                  id="api-mode"
                  value={config.mode}
                  onChange={(e) =>
                    set("mode", e.target.value as ApiConfig["mode"])
                  }
                >
                  <option value="mock">Демоданные</option>
                  <option value="hybrid">API с резервным снимком</option>
                  <option value="live">Только API</option>
                </NativeSelect>
              </Field>
              <Field id="polling" label="Обновление">
                <NativeSelect
                  id="polling"
                  value={config.pollingSec}
                  onChange={(e) => set("pollingSec", Number(e.target.value))}
                >
                  {[0, 5, 15, 30, 60].map((n) => (
                    <option key={n} value={n}>
                      {n ? `Каждые ${n} с` : "Вручную"}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
            </div>
            <Field
              id="endpoint"
              label="Адрес API"
              error={urlError}
              hint="HTTPS или путь /api/…"
            >
              <input
                id="endpoint"
                type="url"
                placeholder="https://api.example.com/dashboard"
                value={config.url}
                autoComplete="off"
                spellCheck={false}
                onChange={(e) => set("url", e.target.value)}
                aria-invalid={!!urlError}
                aria-describedby="endpoint-help"
              />
            </Field>
            <Field
              id="api-token"
              label="Bearer token"
              hint="Не сохраняется. Введите после перезагрузки."
            >
              <div className="secret-field">
                <input
                  id="api-token"
                  type={revealed ? "text" : "password"}
                  value={config.token}
                  autoComplete="off"
                  spellCheck={false}
                  onChange={(e) => set("token", e.target.value)}
                  aria-describedby="api-token-help"
                />
                <Button
                  className="icon-button"
                  aria-label={revealed ? "Скрыть токен" : "Показать токен"}
                  aria-pressed={revealed}
                  onClick={() => setRevealed(!revealed)}
                >
                  {revealed ? <EyeOff size={18} /> : <Eye size={18} />}
                </Button>
              </div>
            </Field>
            <div className="connection-result" role="status">
              {checking ? (
                <span>Проверяем API…</span>
              ) : result ? (
                <p className={result.ok ? "tone-success" : "error-text"}>
                  {result.ok ? (
                    <CheckCircle2 size={17} />
                  ) : (
                    <TriangleAlert size={17} />
                  )}{" "}
                  {result.message}
                </p>
              ) : null}
            </div>
            <div className="form-actions">
              <Button
                variant="outline"
                busy={checking}
                disabled={checking}
                onClick={() => void check()}
              >
                Проверить соединение
              </Button>
              <Button variant="primary" type="submit">
                Сохранить подключение
              </Button>
            </div>
          </form>
        ) : (
          <div className="settings-body demo-settings">
            <div className="section-heading">
              <div>
                <h3>Сценарии</h3>
              </div>
            </div>
            <div className="scenario-grid">
              {[
                {
                  id: "baseline" as const,
                  title: "Базовый срез",
                  icon: Database,
                },
                {
                  id: "stress" as const,
                  title: "Сбой оборудования",
                  icon: TriangleAlert,
                },
                {
                  id: "yearend" as const,
                  title: "Закрытие года",
                  icon: CheckCircle2,
                },
              ].map((x) => (
                <Button
                  key={x.id}
                  className="scenario"
                  variant="outline"
                  disabled={jsonDirty || quickDirty}
                  onClick={() => {
                    s.scenario(x.id);
                    setConfig({ ...useDashboardStore.getState().config });
                    resetEditor();
                    notify(`Применён сценарий «${x.title}»`);
                  }}
                >
                  <x.icon size={21} />
                  <strong>{x.title}</strong>
                </Button>
              ))}
            </div>
            {jsonDirty || quickDirty ? (
              <p className="field-help">
                Примените или отмените изменения, чтобы сменить сценарий.
              </p>
            ) : null}
            <div className="simulation-row">
              <div>
                <h3>Симуляция данных</h3>
              </div>
              <Button
                variant="outline"
                disabled={s.config.mode !== "mock" || jsonDirty || quickDirty}
                aria-pressed={s.simulation}
                onClick={s.toggleSimulation}
              >
                {s.simulation ? <Pause size={17} /> : <Play size={17} />}{" "}
                {s.simulation ? "Остановить" : "Запустить"}
              </Button>
            </div>
            {s.config.mode !== "mock" ? (
              <p className="field-help">
                Выберите сценарий, чтобы перейти с API на демоданные.
              </p>
            ) : null}
            <h3>Показатели</h3>
            <form
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                applyQuick();
              }}
            >
              <div className="quick-fields">
                {[
                  { key: "dbo" as const, label: "Доля в ДБО, %" },
                  { key: "vacancies" as const, label: "Вакансии кассиров" },
                  { key: "downtime" as const, label: "Простой АТМ, %" },
                ].map((x) => (
                  <Field key={x.key} id={`quick-${x.key}`} label={x.label}>
                    <input
                      id={`quick-${x.key}`}
                      type="number"
                      min="0"
                      step={x.key === "vacancies" ? "1" : "0.1"}
                      value={quick[x.key]}
                      onChange={(e) => {
                        setQuick((q) => ({ ...q, [x.key]: e.target.value }));
                        setQuickError("");
                      }}
                      aria-invalid={!!quickError}
                      aria-describedby="quick-error"
                    />
                  </Field>
                ))}
              </div>
              <p id="quick-error" className="error-text">
                {quickError}
              </p>
              <Button
                type="submit"
                variant="outline"
                disabled={jsonDirty || conflict}
              >
                Применить показатели
              </Button>
            </form>
            <div className="section-heading editor-heading">
              <Button onClick={resetEditor}>
                <RefreshCw size={15} />
                Загрузить актуальные
              </Button>
            </div>
            {conflict ? (
              <p className="inline-warning" role="status">
                Данные изменились в другой вкладке или симуляции. Загрузите
                актуальные; ваш черновик остаётся в редакторе.
              </p>
            ) : null}
            <Field id="json-editor" label="Редактор JSON" error={jsonError}>
              <textarea
                className="resize-none"
                id="json-editor"
                value={json}
                onChange={(e) => {
                  setJson(e.target.value);
                  setJsonError("");
                }}
                spellCheck={false}
                style={{ resize: "none" }}
                aria-invalid={!!jsonError}
                aria-describedby="json-editor-help"
              />
            </Field>
            <div className="form-actions">
              <div>
                <Button onClick={() => void copy()}>
                  <Copy size={16} />
                  Копировать
                </Button>
                <Button onClick={download}>
                  <Download size={16} />
                  Скачать
                </Button>
              </div>
              <Button variant="primary" disabled={conflict} onClick={applyJson}>
                Применить демоданные
              </Button>
            </div>
          </div>
        )}
      </Modal>
      {guard ? (
        <Modal
          title="Есть несохранённые изменения"
          onClose={() => setGuard(false)}
        >
          <div className="guard-actions">
            <Button variant="primary" onClick={() => setGuard(false)}>
              Продолжить редактирование
            </Button>
            <Button variant="outline" onClick={onClose}>
              Отбросить изменения
            </Button>
          </div>
        </Modal>
      ) : null}
    </>
  );
}
