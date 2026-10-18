import { Suspense, lazy, useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowUpRight,
  ArrowLeft,
  ArrowRight,
  Building2,
  CalendarDays,
  CircleHelp,
  Database,
  Glasses,
  LayoutDashboard,
  Monitor,
  Orbit,
  RefreshCw,
  Settings2,
  Sun,
  Moon,
  Wallet,
  WifiOff,
} from "lucide-react";
import { useDashboardStore, startSync } from "./store/dashboard";
import { dashboardModel } from "./api/model";
import { attentionItems } from "./api/attention";
import {
  formatSource,
  formatTime,
  formatPercent,
  sourceNotice,
} from "./api/format";
import {
  DashboardCard,
  DashboardContent,
  DataTable,
} from "./components/DashboardCard";
import { Button, Modal, Toast } from "./components/ui";
import { Admin } from "./components/Admin";
import { AppUpdate } from "./components/AppUpdate";
import { t, useLocale, setLocale, formatReportDate, type Locale } from "./i18n";
import "./styles/app.css";
import "./styles/charts.css";
import "./styles/controls.css";
import privatbankLogo from "./assets/privatbank.svg";
const SpatialView = lazy(() => import("./spatial/SpatialView"));
const SpaceBackdrop = lazy(() => import("./spatial/SpaceBackdrop"));
type View = "overview" | "payments" | "cash" | "equipment";
const viewConfig = [
  { id: "overview" as const, label: "Обзор", icon: LayoutDashboard },
  { id: "payments" as const, label: "Платежи", icon: Wallet },
  { id: "cash" as const, label: "Кассы", icon: Building2 },
  { id: "equipment" as const, label: "Оборудование", icon: Monitor },
];
const validViews = viewConfig.map((x) => x.id);
const initialView = () => {
  const v = new URLSearchParams(location.search).get("view");
  return validViews.includes(v as View) ? (v as View) : "overview";
};

export default function App() {
  const s = useDashboardStore();
  const locale = useLocale();
  const [view, setView] = useState<View>(initialView),
    [admin, setAdmin] = useState(
      new URLSearchParams(location.search).get("admin") === "1",
    );
  const [focus, setFocus] = useState<number | null>(null),
    [spatial, setSpatial] = useState(false),
    [help, setHelp] = useState(false),
    [monthly, setMonthly] = useState<"count" | "volume" | "both">("count");
  const models = useMemo(
    () =>
      s.data
        ? Array.from({ length: 10 }, (_, i) => dashboardModel(s.data!, i + 1))
        : [],
    [s.data, locale],
  );
  useEffect(() => {
    const stop = startSync();
    void useDashboardStore.getState().refresh();
    return stop;
  }, []);
  useEffect(() => {
    if (s.config.mode === "mock" || !s.config.pollingSec) return;
    let timer: ReturnType<typeof setTimeout>;
    let cancelled = false;
    const run = async () => {
      if (cancelled) return;
      if (!useDashboardStore.getState().busy)
        await useDashboardStore.getState().refresh();
      if (!cancelled) timer = setTimeout(run, s.config.pollingSec * 1000);
    };
    timer = setTimeout(run, s.config.pollingSec * 1000);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [s.config]);
  useEffect(() => {
    if (!s.simulation) return;
    const t = setInterval(() => useDashboardStore.getState().tick(), 2500);
    return () => clearInterval(t);
  }, [s.simulation]);
  useEffect(() => {
    document.documentElement.dataset.theme = s.theme;
  }, [s.theme]);
  useEffect(() => {
    document.documentElement.lang = locale;
    document.title = `${t(viewConfig.find((x) => x.id === view)!.label)} · ${t("Орбита")}`;
  }, [view, locale]);
  useEffect(() => {
    const fn = () => {
      setView(initialView());
      setAdmin(new URLSearchParams(location.search).get("admin") === "1");
    };
    window.addEventListener("popstate", fn);
    return () => window.removeEventListener("popstate", fn);
  }, []);
  function navigate(next: View) {
    const u = new URL(location.href);
    if (next === "overview") u.searchParams.delete("view");
    else u.searchParams.set("view", next);
    history.pushState({}, "", u);
    setView(next);
  }
  function openAdmin(open: boolean) {
    const u = new URL(location.href);
    if (open) u.searchParams.set("admin", "1");
    else u.searchParams.delete("admin");
    history.replaceState({}, "", u);
    setAdmin(open);
  }
  const sourceLabel = formatSource(s.source, !!s.lastLive);
  const sourceAlert = sourceNotice(s.source, !!s.lastLive);
  const attention = attentionItems(models);
  const monthlyControls = (
    <div
      className="monthly-switch"
      role="group"
      aria-label={t("Показатель платежей")}
    >
      <div>
        {[
          { id: "count" as const, label: "Количество" },
          { id: "volume" as const, label: "Объём" },
          { id: "both" as const, label: "Вместе" },
        ].map((x) => (
          <Button
            key={x.id}
            className={monthly === x.id ? "selected" : ""}
            aria-pressed={monthly === x.id}
            onClick={() => setMonthly(x.id)}
          >
            {t(x.label)}
          </Button>
        ))}
      </div>
    </div>
  );
  const renderCard = (id: number) => (
    <DashboardCard
      key={id}
      model={models[id - 1]}
      onFocus={setFocus}
      controls={id === 2 || id === 3 ? monthlyControls : undefined}
      comparison={id === 2 && monthly === "both" ? models[2] : undefined}
    />
  );
  const blockHeading = (title: string) => {
    if (view !== "overview") return null;
    return (
      <header className="wing-heading">
        <h2>{t(title)}</h2>
      </header>
    );
  };
  return (
    <>
      <div
        className="space-backdrop"
        aria-hidden="true"
        data-space-theme={s.theme}
      >
        {!spatial ? (
          <Suspense fallback={null}>
            <SpaceBackdrop dark={s.theme === "dark"} />
          </Suspense>
        ) : null}
      </div>
      <a href="#analytics" className="skip-link">
        {t("Перейти к аналитике")}
      </a>
      <div className="app-shell">
        <aside className="side-dock">
          <a
            className="brand-mark"
            href={
              location.protocol === "file:"
                ? location.pathname
                : import.meta.env.BASE_URL
            }
            aria-label={t("Орбита — обзор")}
          >
            <Orbit size={29} />
          </a>
          <nav aria-label={t("Вид аналитики")}>
            {viewConfig.map((x) => (
              <Button
                key={x.id}
                className={`dock-button ${view === x.id ? "active" : ""}`}
                aria-label={t(x.label)}
                data-tooltip={t(x.label)}
                aria-pressed={view === x.id}
                onClick={() => navigate(x.id)}
              >
                <x.icon size={22} />
                <span className="dock-tooltip" aria-hidden="true">
                  {t(x.label)}
                </span>
              </Button>
            ))}
          </nav>
          <div className="dock-bottom">
            <Button
              className="dock-button"
              aria-label={t("Как пользоваться")}
              data-tooltip={t("Как пользоваться")}
              onClick={() => setHelp(true)}
            >
              <CircleHelp size={21} />
              <span className="dock-tooltip" aria-hidden="true">
                {t("Как пользоваться")}
              </span>
            </Button>
            <Button
              className="dock-button"
              aria-label={t("Источники данных")}
              data-tooltip={t("Источники данных")}
              onClick={() => openAdmin(true)}
            >
              <Settings2 size={21} />
              <span className="dock-tooltip" aria-hidden="true">
                {t("Источники данных")}
              </span>
            </Button>
          </div>
        </aside>
        <div className="workspace">
          <header className="topbar">
            <a
              className="wordmark"
              href={
                location.protocol === "file:"
                  ? location.pathname
                  : import.meta.env.BASE_URL
              }
              aria-label={t("Орбита — обзор")}
            >
              <img
                className="privatbank-logo"
                src={privatbankLogo}
                alt="ПриватБанк"
                width="142"
                height="24"
              />
              <span className="brand-divider" aria-hidden="true" />
              <span>{t("Орбита")}</span>
            </a>
            <div className="topbar-right">
              <span className="source-item sr-only" role="status">
                {sourceLabel}
              </span>
              <label className="language-switch">
                <span className="sr-only">{t("Язык")}</span>
                <select
                  aria-label={t("Язык")}
                  value={locale}
                  onChange={(event) => setLocale(event.target.value as Locale)}
                >
                  <option value="uk">UA</option>
                  <option value="en">EN</option>
                  <option value="ru">RU</option>
                </select>
              </label>
              <Button
                className="icon-button"
                aria-label={
                  s.theme === "office"
                    ? t("Включить тёмное окружение")
                    : t("Включить светлое окружение")
                }
                title={t("Сменить окружение")}
                onClick={() =>
                  useDashboardStore.setState({
                    theme: s.theme === "office" ? "dark" : "office",
                  })
                }
              >
                {s.theme === "office" ? <Moon size={19} /> : <Sun size={19} />}
              </Button>
              <Button
                className="icon-button utility-button"
                aria-label={t("Как пользоваться")}
                data-tooltip={t("Как пользоваться")}
                onClick={() => setHelp(true)}
              >
                <CircleHelp size={19} />
              </Button>
              <Button
                className="icon-button utility-button"
                aria-label={t("Источники данных")}
                data-tooltip={t("Источники данных")}
                onClick={() => openAdmin(true)}
              >
                <Settings2 size={19} />
              </Button>
            </div>
          </header>
          <main id="analytics">
            <div className="page-heading">
              <div className="heading-copy">
                <h1>
                  {view === "overview"
                    ? t("Обзор")
                    : view === "payments"
                      ? t("Платежи")
                      : view === "cash"
                        ? t("Кассовые операции")
                        : t("Оборудование")}
                </h1>
                <div
                  className="report-period"
                  aria-label={t("Отчётный период")}
                >
                  <CalendarDays size={14} />
                  <div>
                    <strong>
                      {s.data
                        ? formatReportDate(s.data.meta.reportDate)
                        : t("Данные не загружены")}
                    </strong>
                  </div>
                </div>
              </div>
              <div className="page-actions">
                <div className="view-tools">
                  <Button
                    aria-label={
                      s.compact
                        ? t("Показать полные числа")
                        : t("Сократить числа")
                    }
                    aria-pressed={!s.compact}
                    onClick={() =>
                      useDashboardStore.setState({ compact: !s.compact })
                    }
                  >
                    {s.compact ? t("Кратко") : t("Точно")}
                  </Button>
                  <span className="tool-divider" />
                  <Button
                    aria-label={t("Обновить данные")}
                    title={t("Обновить данные")}
                    busy={s.busy}
                    disabled={s.busy || s.simulation}
                    onClick={() => void s.refresh()}
                  >
                    {!s.busy ? <RefreshCw size={16} /> : null}
                    <span className="desktop-label">{t("Обновить")}</span>
                  </Button>
                </div>
                <Button
                  variant="outline"
                  className="xr-entry"
                  onClick={() => setSpatial(true)}
                >
                  <Glasses size={20} />
                  {t("Открыть в пространстве")}
                </Button>
              </div>
            </div>
            <div className="workspace-toolbar">
              <nav className="view-tabs" aria-label={t("Вид аналитики")}>
                {viewConfig.map((x) => (
                  <Button
                    key={x.id}
                    className={view === x.id ? "selected" : ""}
                    aria-pressed={view === x.id}
                    aria-label={t(x.label)}
                    onClick={() => navigate(x.id)}
                  >
                    <x.icon size={16} />
                    {t(
                      x.id === "equipment"
                        ? "Устройства"
                        : x.id === "cash"
                          ? locale === "en"
                            ? "Cash"
                            : "Кассы"
                          : x.label,
                    )}
                  </Button>
                ))}
              </nav>
            </div>
            {s.error ? (
              <div className="data-warning" role="status">
                <WifiOff size={19} />
                <div>
                  <strong>
                    {s.source === "fallback"
                      ? `${sourceLabel}. ${t("Обновление недоступно.")}`
                      : t("Данные API недоступны.")}
                  </strong>
                  <p>{t(s.error)}</p>
                </div>
                <Button onClick={() => void s.refresh()} disabled={s.busy}>
                  {t("Повторить")}
                </Button>
              </div>
            ) : null}
            {!s.data ? (
              <div className="empty-state">
                <Database size={38} />
                <h2>
                  {s.busy
                    ? t("Загружаем аналитику")
                    : t("Нет доступных данных API")}
                </h2>
                <Button variant="primary" onClick={() => openAdmin(true)}>
                  {t("Настроить источник")}
                </Button>
              </div>
            ) : (
              <div className={`cockpit view-${view}`}>
                {view === "overview" || view === "cash" ? (
                  <section
                    className="wing cash-wing"
                    aria-label={t("Кассовые операции")}
                  >
                    {blockHeading("Кассовые операции")}
                    <div className="wing-cards">
                      {[5, 6, 7].map(renderCard)}
                    </div>
                  </section>
                ) : null}
                {view === "overview" || view === "payments" ? (
                  <section
                    className="wing payments-wing"
                    aria-label={t("Платежи")}
                  >
                    {blockHeading("Платежи")}
                    <div className="wing-cards">
                      {renderCard(1)}
                      {renderCard(monthly === "volume" ? 3 : 2)}
                      {renderCard(4)}
                    </div>
                  </section>
                ) : null}
                {view === "overview" || view === "equipment" ? (
                  <section
                    className="wing equipment-wing"
                    aria-label={t("Оборудование")}
                  >
                    {blockHeading("Оборудование")}
                    <div className="wing-cards">
                      {[8, 9, 10].map(renderCard)}
                    </div>
                  </section>
                ) : null}
              </div>
            )}
            {s.lastLive || attention.length ? (
              <footer className="workspace-footer">
                {s.lastLive && s.updatedAt ? (
                  <div>
                    {t("Обновлено {time} · Киев", {
                      time: formatTime(s.updatedAt),
                    })}
                  </div>
                ) : null}
                {attention.length ? (
                  <div
                    className="attention-items"
                    aria-label={t("Зоны внимания")}
                  >
                    <Activity size={16} />
                    <span>{t("Зоны внимания")}</span>
                    {attention.map((item, index) => (
                      <Button
                        key={index}
                        onClick={() => setFocus(item.id)}
                        aria-label={`${item.label}: ${formatPercent(item.percent)} · ${item.title}`}
                      >
                        {item.label}: {formatPercent(item.percent)}
                        <ArrowUpRight size={14} />
                      </Button>
                    ))}
                  </div>
                ) : null}
              </footer>
            ) : null}
          </main>
        </div>
      </div>
      {focus && s.data ? (
        <Modal
          title={models[focus - 1].title}
          description={`${formatReportDate(s.data.meta.reportDate)}${sourceAlert ? ` · ${sourceAlert}` : ""}`}
          onClose={() => setFocus(null)}
          wide
          className="focus-modal"
        >
          <nav className="focus-navigation" aria-label={t("Дашборды в фокусе")}>
            <Button
              aria-label={t("Предыдущий дашборд")}
              disabled={focus === 1}
              onClick={() => setFocus(focus - 1)}
            >
              <ArrowLeft size={17} />
              <span>{focus > 1 ? models[focus - 2].title : t("Назад")}</span>
            </Button>
            <Button
              aria-label={t("Следующий дашборд")}
              disabled={focus === 10}
              onClick={() => setFocus(focus + 1)}
            >
              <span>{focus < 10 ? models[focus].title : t("Далее")}</span>
              <ArrowRight size={17} />
            </Button>
          </nav>
          <nav className="focus-jump" aria-label={t("Выбрать дашборд")}>
            <span>{focus} / 10</span>
            {models.map((m) => (
              <Button
                key={m.id}
                aria-label={m.title}
                aria-pressed={focus === m.id}
                className={focus === m.id ? "selected" : ""}
                onClick={() => setFocus(m.id)}
              >
                {m.id}. {m.title}
              </Button>
            ))}
          </nav>
          <div className="focus-content" key={focus}>
            <DashboardContent model={models[focus - 1]} />
            <DataTable model={models[focus - 1]} />
          </div>
        </Modal>
      ) : null}
      {admin ? <Admin onClose={() => openAdmin(false)} /> : null}
      {spatial ? (
        <Modal
          title={t("Пространство")}
          onClose={() => setSpatial(false)}
          wide
          className="spatial-modal"
        >
          <Suspense
            fallback={<div className="xr-loading">{t("Загружаем 3D…")}</div>}
          >
            <SpatialView />
          </Suspense>
        </Modal>
      ) : null}
      {help ? (
        <Modal title={t("Как пользоваться")} onClose={() => setHelp(false)}>
          <div className="help-body">
            <p>
              {t(
                "Значок разворота открывает график и точные значения. Escape закрывает окно.",
              )}
            </p>
            <p>
              {t(
                "В Meta Quest Browser выберите AR или VR. Для выбора панели нажмите курок или соедините большой и указательный пальцы.",
              )}
            </p>
          </div>
        </Modal>
      ) : null}
      <Toast />
      <AppUpdate />
    </>
  );
}
