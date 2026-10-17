import { Suspense, lazy, useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowUpRight,
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
import { formatSource, formatTime } from "./api/format";
import {
  DashboardCard,
  DashboardContent,
  DataTable,
} from "./components/DashboardCard";
import { Button, Modal, Toast } from "./components/ui";
import { Admin } from "./components/Admin";
import { AppUpdate } from "./components/AppUpdate";
import "./styles/app.css";
const SpatialView = lazy(() => import("./spatial/SpatialView"));
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
    [s.data],
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
    document.title = `${viewConfig.find((x) => x.id === view)?.label} департамента · Орбита`;
  }, [view]);
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
  const activeEquipment =
    s.data?.block3_atmTso.dashboard10_workingEquipmentAndDowntime;
  const attention =
    (activeEquipment?.downtime.filter((x) => x.percent > 6.5).length ?? 0) +
    (s.data &&
    s.data.block2_cashDesk.dashboard7_operationsAndStaff.downtimeTodayPercent >
      6.5
      ? 1
      : 0);
  const renderCard = (id: number) => (
    <DashboardCard key={id} model={models[id - 1]} onFocus={setFocus} />
  );
  const blockHeading = (title: string) => {
    if (view !== "overview") return null;
    return (
      <header className="wing-heading">
        <h2>{title}</h2>
      </header>
    );
  };
  return (
    <>
      <div className="room-backdrop" aria-hidden="true" />
      <a href="#analytics" className="skip-link">
        Перейти к аналитике
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
            aria-label="Орбита — обзор"
          >
            <Orbit size={29} />
          </a>
          <nav aria-label="Основные разделы">
            {viewConfig.map((x) => (
              <Button
                key={x.id}
                className={`dock-button ${view === x.id ? "active" : ""}`}
                aria-label={x.label}
                title={x.label}
                aria-pressed={view === x.id}
                onClick={() => navigate(x.id)}
              >
                <x.icon size={22} />
              </Button>
            ))}
          </nav>
          <div className="dock-bottom">
            <Button
              className="dock-button"
              aria-label="Как пользоваться"
              title="Как пользоваться"
              onClick={() => setHelp(true)}
            >
              <CircleHelp size={21} />
            </Button>
            <Button
              className="dock-button"
              aria-label="Источники данных"
              title="Источники данных"
              onClick={() => openAdmin(true)}
            >
              <Settings2 size={21} />
            </Button>
          </div>
        </aside>
        <div className="workspace">
          <header className="topbar">
            <div className="wordmark">Орбита</div>
            <div className="topbar-right">
              <div className="source-item source-pill" role="status">
                <span
                  className={`live-dot ${s.source === "live" ? "live" : ""}`}
                />
                <strong>{sourceLabel}</strong>
              </div>
              <Button
                className="icon-button"
                aria-label={
                  s.theme === "office"
                    ? "Включить тёмное окружение"
                    : "Включить окружение кабинета"
                }
                title="Сменить окружение"
                onClick={() =>
                  useDashboardStore.setState({
                    theme: s.theme === "office" ? "dark" : "office",
                  })
                }
              >
                {s.theme === "office" ? <Moon size={19} /> : <Sun size={19} />}
              </Button>
            </div>
          </header>
          <main id="analytics">
            <div className="page-heading">
              <div>
                <h1>
                  {view === "overview"
                    ? "Обзор"
                    : view === "payments"
                      ? "Платежи"
                      : view === "cash"
                        ? "Кассовые операции"
                        : "Оборудование"}
                </h1>
              </div>
              <div className="page-actions">
                <div className="report-period" aria-label="Отчётный период">
                  <CalendarDays size={18} />
                  <div>
                    <strong>
                      {s.data?.meta.reportDate ?? "Данные не загружены"}
                    </strong>
                  </div>
                </div>
                <Button
                  variant="outline"
                  className="xr-entry"
                  onClick={() => setSpatial(true)}
                >
                  <Glasses size={21} />
                  Открыть в пространстве
                  <ArrowUpRight size={16} />
                </Button>
              </div>
            </div>
            <div className="workspace-toolbar">
              <nav className="view-tabs" aria-label="Вид аналитики">
                {viewConfig.map((x) => (
                  <Button
                    key={x.id}
                    className={view === x.id ? "selected" : ""}
                    aria-pressed={view === x.id}
                    onClick={() => navigate(x.id)}
                  >
                    <x.icon size={16} />
                    {x.label}
                  </Button>
                ))}
              </nav>
              <div className="view-tools">
                <Button
                  aria-label={
                    s.compact ? "Показать полные числа" : "Сократить числа"
                  }
                  aria-pressed={!s.compact}
                  onClick={() =>
                    useDashboardStore.setState({ compact: !s.compact })
                  }
                >
                  {s.compact ? "Кратко" : "Точно"}
                </Button>
                <span className="tool-divider" />
                <Button
                  aria-label="Обновить данные"
                  title="Обновить данные"
                  busy={s.busy}
                  disabled={s.busy || s.simulation}
                  onClick={() => void s.refresh()}
                >
                  {!s.busy ? <RefreshCw size={16} /> : null}
                  <span className="desktop-label">Обновить</span>
                </Button>
              </div>
            </div>
            {s.error ? (
              <div className="data-warning" role="status">
                <WifiOff size={19} />
                <div>
                  <strong>
                    {s.source === "fallback"
                      ? `${sourceLabel}. Обновление недоступно.`
                      : "Данные API недоступны."}
                  </strong>
                  <p>{s.error}</p>
                </div>
                <Button onClick={() => void s.refresh()} disabled={s.busy}>
                  Повторить
                </Button>
              </div>
            ) : null}
            {!s.data ? (
              <div className="empty-state">
                <Database size={38} />
                <h2>
                  {s.busy ? "Загружаем аналитику" : "Нет доступных данных API"}
                </h2>
                <Button variant="primary" onClick={() => openAdmin(true)}>
                  Настроить источник
                </Button>
              </div>
            ) : (
              <div className={`cockpit view-${view}`}>
                {view === "overview" || view === "cash" ? (
                  <section
                    className="wing cash-wing"
                    aria-label="Кассовые операции"
                  >
                    {blockHeading("Кассовые операции")}
                    <div className="wing-cards">
                      {[5, 6, 7].map(renderCard)}
                    </div>
                  </section>
                ) : null}
                {view === "overview" || view === "payments" ? (
                  <section className="wing payments-wing" aria-label="Платежи">
                    {blockHeading("Платежи")}
                    <div className="wing-cards">
                      {renderCard(1)}
                      <div
                        className="monthly-switch"
                        role="group"
                        aria-label="Показатель платежей"
                      >
                        <span>За месяц</span>
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
                              {x.label}
                            </Button>
                          ))}
                        </div>
                      </div>
                      {monthly === "count" || monthly === "both"
                        ? renderCard(2)
                        : null}
                      {monthly === "volume" || monthly === "both"
                        ? renderCard(3)
                        : null}
                      {renderCard(4)}
                    </div>
                  </section>
                ) : null}
                {view === "overview" || view === "equipment" ? (
                  <section
                    className="wing equipment-wing"
                    aria-label="Оборудование"
                  >
                    {blockHeading("Оборудование")}
                    <div className="wing-cards">
                      {[8, 9, 10].map(renderCard)}
                    </div>
                  </section>
                ) : null}
              </div>
            )}
            {s.lastLive || attention ? (
              <footer className="workspace-footer">
                {s.lastLive && s.updatedAt ? (
                  <div>Обновлено {formatTime(s.updatedAt)} · Киев</div>
                ) : null}
                {attention ? (
                  <span className="tone-danger">
                    <Activity size={13} />
                    {attention} зоны внимания
                  </span>
                ) : null}
              </footer>
            ) : null}
          </main>
          <div className="environment-dock">
            <span>
              <span className="environment-dot" />
              {s.theme === "office" ? "Кабинет" : "Тёмное окружение"}
            </span>
            <span className="tool-divider" />
            <Button
              onClick={() => setSpatial(true)}
              aria-label="Открыть 3D-пространство"
              title="Открыть 3D-пространство"
            >
              <Glasses size={18} />
            </Button>
            <span className="tool-divider" />
            <Button
              onClick={() => openAdmin(true)}
              aria-label="Настроить пространство"
            >
              <Settings2 size={17} />
            </Button>
          </div>
        </div>
      </div>
      {focus && s.data ? (
        <Modal
          title={models[focus - 1].title}
          description={`${s.data.meta.reportDate} · ${sourceLabel}`}
          onClose={() => setFocus(null)}
          wide
          className="focus-modal"
        >
          <div className="focus-content">
            <DashboardContent model={models[focus - 1]} />
            <DataTable model={models[focus - 1]} />
          </div>
        </Modal>
      ) : null}
      {admin ? <Admin onClose={() => openAdmin(false)} /> : null}
      {spatial ? (
        <Modal
          title="Пространство"
          onClose={() => setSpatial(false)}
          wide
          className="spatial-modal"
        >
          <Suspense fallback={<div className="xr-loading">Загружаем 3D…</div>}>
            <SpatialView />
          </Suspense>
        </Modal>
      ) : null}
      {help ? (
        <Modal title="Как пользоваться" onClose={() => setHelp(false)}>
          <div className="help-body">
            <p>
              Значок разворота открывает график и точные значения. Escape
              закрывает окно.
            </p>
            <p>
              В Meta Quest Browser выберите AR или VR. Для выбора панели нажмите
              курок или соедините большой и указательный пальцы.
            </p>
          </div>
        </Modal>
      ) : null}
      <Toast />
      <AppUpdate />
    </>
  );
}
