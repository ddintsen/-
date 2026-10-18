import {
  Component,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { XR, XROrigin, createXRStore, useXR } from "@react-three/xr";
import { PerspectiveCamera, Quaternion, Vector3, type Group } from "three";
import {
  Glasses,
  RotateCcw,
  ArrowLeft,
  ArrowRight,
  MoveHorizontal,
  Sun,
  Moon,
  Maximize2,
  Minimize2,
  LayoutGrid,
  Database,
  Eye,
  EyeOff,
} from "lucide-react";
import { useDashboardStore } from "../store/dashboard";
import { colors, dashboardModel, type DashboardModel } from "../api/model";
import { formatSource } from "../api/format";
import { drawOverviewPanel, drawFocusPanel } from "./drawPanel";
import { SpatialSurface, SpatialControl, SpatialWing } from "./SpatialSurface";
import { SpaceEnvironment } from "./SpaceEnvironment";
import { spatialStands, FOCUS_ROWS, focusSurfaceHeight } from "./layout";
import { Button, NativeSelect } from "../components/ui";
import { formatReportDate, t, useLocale } from "../i18n";

// No remote hand/controller model download. Local profile JSON resolves controller buttons.
const xrStore = createXRStore({
  emulate: false,
  offerSession: false,
  enterGrantedSession: false,
  handTracking: true,
  hand: { model: false },
  controller: { model: false },
  baseAssetPath: new URL(
    `${import.meta.env.BASE_URL}xr-profiles/`,
    window.location.href,
  ).href,
  anchors: false,
  meshDetection: false,
  planeDetection: false,
  hitTest: false,
  domOverlay: false,
});
class GraphicsBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div className="graphics-error">
        {t(
          "Не удалось запустить WebGL. Включите аппаратное ускорение браузера; обычные дашборды остаются доступны.",
        )}
      </div>
    ) : (
      this.props.children
    );
  }
}
function Panel({
  model,
  position,
  scale = 1,
  focused,
  opacity = 1,
  onSelect,
  factsOffset = 0,
  width = 1.28,
  height = 0.8,
  wide = false,
}: {
  factsOffset?: number;
  width?: number;
  height?: number;
  wide?: boolean;
  model: DashboardModel;
  position: [number, number, number];
  scale?: number;
  focused: boolean;
  opacity?: number;
  onSelect?: () => void;
}) {
  const compact = useDashboardStore((s) => s.compact);
  const locale = useLocale();
  const texture = useMemo(
    () =>
      focused
        ? drawFocusPanel(model, compact, factsOffset)
        : drawOverviewPanel(model, wide),
    [model, compact, focused, locale, factsOffset, wide],
  );
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <group position={position} scale={scale}>
      <SpatialSurface
        texture={texture}
        width={focused ? 2.04 : width}
        height={focused ? focusSurfaceHeight(model.facts.length) : height}
        opacity={opacity}
        focused={focused}
        onSelect={onSelect}
      />
    </group>
  );
}
function Scene({
  yaw,
  setFocused,
  focused,
  environmentOnly,
  dataContext,
  recenter,
  onRecenter,
  factsOffset,
  setFactsOffset,
}: {
  yaw: number;
  focused: number | null;
  environmentOnly: boolean;
  dataContext: string;
  setFocused: (v: number | null) => void;
  recenter: number;
  onRecenter: () => void;
  factsOffset: number;
  setFactsOffset: (v: number) => void;
}) {
  const data = useDashboardStore((s) => s.data);
  const locale = useLocale();
  const theme = useDashboardStore((s) => s.theme);
  const { camera, gl, size, invalidate, setFrameloop } = useThree();
  const mode = useXR((s) => s.mode);
  const session = useXR((s) => s.session);
  const anchor = useRef<Group>(null);
  const focusGroup = useRef<Group>(null);
  const focusPose = useRef<{ p: Vector3; q: Quaternion } | null>(null);
  const models = useMemo(
    () =>
      data
        ? Array.from({ length: 10 }, (_, i) => dashboardModel(data, i + 1))
        : [],
    [data, locale],
  );
  useEffect(() => {
    gl.setClearColor(colors.background, mode === "immersive-ar" ? 0 : 1);
    invalidate();
  }, [gl, mode, invalidate]);
  useEffect(() => {
    setFrameloop(session ? "always" : "demand");
    invalidate();
  }, [session, setFrameloop, invalidate]);
  useEffect(() => {
    if (!session) {
      camera.position.set(0, 1.6, 0.7);
      camera.rotation.set(0, (yaw * Math.PI) / 180, 0);
      if (camera instanceof PerspectiveCamera) {
        camera.fov =
          focused !== null
            ? Math.max(
                68,
                (2 *
                  Math.atan(1.1 / ((1.5 * size.width) / size.height)) *
                  180) /
                  Math.PI,
              )
            : Math.max(
                68,
                (2 *
                  Math.atan(2.05 / ((1.2 * size.width) / size.height)) *
                  180) /
                  Math.PI,
              );
        camera.updateProjectionMatrix();
      }
      invalidate();
    }
  }, [camera, yaw, session, size.width, size.height, invalidate, focused]);
  // Recenter the workspace in the viewer's horizontal heading; never move the headset camera.
  useEffect(() => {
    if (!anchor.current) return;
    const viewer = session ? gl.xr.getCamera() : camera;
    const p = viewer.getWorldPosition(new Vector3());
    const d = viewer.getWorldDirection(new Vector3());
    anchor.current.position.set(p.x, p.y - 1.6, p.z);
    anchor.current.rotation.set(0, Math.atan2(-d.x, -d.z), 0);
    invalidate();
  }, [recenter, session, camera, gl, invalidate, environmentOnly]);
  const hasFocus = focused !== null;
  useEffect(() => {
    if (hasFocus) {
      const viewer = session ? gl.xr.getCamera() : camera;
      const p = viewer.getWorldPosition(new Vector3());
      const dir = viewer.getWorldDirection(new Vector3());
      // A stable, world-anchored focus; switching data does not make it chase the head.
      dir.y = 0;
      dir.normalize();
      p.addScaledVector(dir, 1.5);
      const q = new Quaternion().setFromAxisAngle(
        new Vector3(0, 1, 0),
        Math.atan2(-dir.x, -dir.z),
      );
      focusPose.current = { p, q };
    } else focusPose.current = null;
    invalidate();
  }, [hasFocus, session, camera, gl, invalidate]);
  useFrame(() => {
    if (focusGroup.current && focusPose.current) {
      focusGroup.current.position.copy(focusPose.current.p);
      focusGroup.current.quaternion.copy(focusPose.current.q);
    }
  });
  const environment =
    mode !== "immersive-ar" ? (
      <SpaceEnvironment dark={theme === "dark"} />
    ) : null;
  if (environmentOnly && !session) return <>{environment}</>;
  const focusHeight =
    focused && data
      ? focusSurfaceHeight(models[focused - 1].facts.length)
      : 0.9;
  const maxOffset =
    focused && data
      ? Math.max(0, models[focused - 1].facts.length - FOCUS_ROWS)
      : 0;
  return (
    <>
      <XROrigin />
      {environment}
      <group ref={anchor}>
        {!hasFocus && data
          ? spatialStands.map((stand) => (
              <group
                key={stand.key}
                position={[stand.x, 1.6, stand.z]}
                rotation={[0, stand.angle, 0]}
              >
                <SpatialWing
                  title={t(stand.title)}
                  width={1.28}
                  height={1.12}
                  position={[0, 0, -0.025]}
                />
                {stand.panels.map((panel) => (
                  <Panel
                    key={panel.id}
                    model={models[panel.id - 1]}
                    position={[panel.x, panel.y, 0]}
                    width={panel.width}
                    height={panel.height}
                    wide={panel.wide}
                    focused={false}
                    onSelect={() => setFocused(panel.id)}
                  />
                ))}
              </group>
            ))
          : null}
        {!hasFocus && data ? (
          <SpatialControl
            label={dataContext}
            position={[0, 0.91, -1.85]}
            width={1.6}
            height={0.1}
          />
        ) : null}
        {!data ? (
          <SpatialControl
            label={t("Данные недоступны")}
            position={[0, 1.6, -1.85]}
            width={1.4}
            height={0.2}
          />
        ) : null}
        {/* Only XR gets these persistent spatial actions. No desktop bottom dock. */}
        {session && !hasFocus ? (
          <group position={[0, 1.04, -1.35]} rotation={[-0.31, 0, 0]}>
            <SpatialControl
              label={t("Центрировать пространство")}
              position={[-0.5, 0, 0]}
              width={0.94}
              height={0.16}
              onSelect={onRecenter}
            />
            <SpatialControl
              label={t("Завершить XR-сеанс")}
              position={[0.5, 0, 0]}
              width={0.94}
              height={0.16}
              onSelect={() => void session.end()}
            />
          </group>
        ) : null}
      </group>
      {focused && data ? (
        <group ref={focusGroup}>
          <Panel
            model={models[focused - 1]}
            position={[0, 0, 0]}
            focused
            factsOffset={factsOffset}
          />
          <SpatialControl
            label={t("← Назад")}
            position={[-0.79, -focusHeight / 2 - 0.12, 0]}
            width={0.44}
            height={0.16}
            focused
            disabled={focused === 1}
            onSelect={() => setFocused(focused - 1)}
          />
          <SpatialControl
            label={t("Панорама")}
            position={[-0.26, -focusHeight / 2 - 0.12, 0]}
            width={0.54}
            height={0.16}
            focused
            onSelect={() => setFocused(null)}
          />
          <SpatialControl
            label={t("Далее →")}
            position={[0.27, -focusHeight / 2 - 0.12, 0]}
            width={0.44}
            height={0.16}
            focused
            disabled={focused === 10}
            onSelect={() => setFocused(focused + 1)}
          />
          <SpatialControl
            label={t("Центрировать пространство")}
            position={[0.79, -focusHeight / 2 - 0.12, 0]}
            width={0.5}
            height={0.16}
            focused
            onSelect={onRecenter}
          />
          {maxOffset > 0 ? (
            <>
              <SpatialControl
                label="↑"
                position={[-0.86, focusHeight / 2 + 0.1, 0]}
                width={0.2}
                height={0.16}
                focused
                disabled={factsOffset === 0}
                onSelect={() => setFactsOffset(Math.max(0, factsOffset - 3))}
              />
              <SpatialControl
                label="↓"
                position={[0.86, focusHeight / 2 + 0.1, 0]}
                width={0.2}
                height={0.16}
                focused
                disabled={factsOffset >= maxOffset}
                onSelect={() =>
                  setFactsOffset(Math.min(maxOffset, factsOffset + 3))
                }
              />
            </>
          ) : null}
          <SpatialControl
            label={dataContext}
            position={[0, -focusHeight / 2 - 0.31, 0]}
            width={1.8}
            height={0.1}
            focused
          />
        </group>
      ) : null}
    </>
  );
}
export default function SpatialView() {
  useLocale();
  const [recenter, setRecenter] = useState(0);
  const [factsOffset, setFactsOffset] = useState(0);
  const recenterSpace = () => {
    setYaw(0);
    setFocused(null);
    setRecenter((value) => value + 1);
  };
  const [yaw, setYaw] = useState(0),
    [focused, setFocused] = useState<number | null>(null),
    [support, setSupport] = useState({ ar: false, vr: false, checked: false });
  useEffect(() => setFactsOffset(0), [focused]);
  function lookAt(nextYaw: number) {
    setFocused(null);
    setYaw(nextYaw);
  }
  const [expanded, setExpanded] = useState(false);
  const [environmentOnly, setEnvironmentOnly] = useState(false);
  const theme = useDashboardStore((s) => s.theme);
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [sessionActive, setSessionActive] = useState(false);
  useEffect(() => {
    // A focus pose belongs to its current viewing space; start each XR/preview transition in panorama.
    setFocused(null);
    setYaw(0);
    setEnvironmentOnly(false);
  }, [sessionActive]);
  useEffect(() => {
    let active = true;
    async function check() {
      try {
        const [ar, vr] = await Promise.all([
          navigator.xr?.isSessionSupported("immersive-ar") ?? false,
          navigator.xr?.isSessionSupported("immersive-vr") ?? false,
        ]);
        if (active) setSupport({ ar, vr, checked: true });
      } catch {
        if (active) setSupport({ ar: false, vr: false, checked: true });
      }
    }
    void check();
    const unsub = xrStore.subscribe((s) => setSessionActive(!!s.session));
    return () => {
      active = false;
      unsub();
      void xrStore.getState().session?.end();
    };
  }, []);
  async function enter(mode: "ar" | "vr") {
    setBusy(true);
    setError("");
    try {
      const session = await (mode === "ar"
        ? xrStore.enterAR()
        : xrStore.enterVR());
      if (!session)
        setError(
          "Браузер не начал XR-сеанс. Проверьте разрешения и поддержку устройства.",
        );
    } catch {
      setError(
        "Не удалось начать XR-сеанс. Откройте приложение по доверенному HTTPS в Meta Quest Browser и разрешите доступ.",
      );
    } finally {
      setBusy(false);
    }
  }
  const data = useDashboardStore((s) => s.data);
  const source = useDashboardStore((s) => s.source);
  const hasLiveSnapshot = useDashboardStore((s) => !!s.lastLive);
  const dataContext = `${formatSource(source, hasLiveSnapshot)} · ${data ? formatReportDate(data.meta.reportDate) : t("Нет данных")}`;
  const loading = useDashboardStore((s) => s.busy);
  const refresh = useDashboardStore((s) => s.refresh);
  useEffect(() => {
    if (!data) setFocused(null);
  }, [data]);
  return (
    <div className="spatial-view">
      <div className="xr-toolbar">
        <div>
          <Button
            variant="outline"
            disabled={!data || !support.ar || busy || sessionActive}
            onClick={() => void enter("ar")}
          >
            <Glasses size={18} />
            {t("Войти в AR")}
          </Button>
          <Button
            variant="primary"
            disabled={!data || !support.vr || busy || sessionActive}
            onClick={() => void enter("vr")}
            busy={busy}
          >
            {t("Войти в VR")}
          </Button>
        </div>
      </div>
      <div className="xr-preview-toolbar">
        <div
          className="xr-environments"
          role="group"
          aria-label={t("Окружение предпросмотра")}
        >
          <Button
            className={theme === "office" ? "selected" : ""}
            aria-pressed={theme === "office"}
            onClick={() => useDashboardStore.setState({ theme: "office" })}
          >
            <Sun size={15} />
            {t("Светлое окружение")}
          </Button>
          <Button
            className={theme === "dark" ? "selected" : ""}
            aria-pressed={theme === "dark"}
            onClick={() => useDashboardStore.setState({ theme: "dark" })}
          >
            <Moon size={15} />
            {t("Тёмное окружение")}
          </Button>
        </div>
        <div className="xr-preview-actions">
          <Button
            className="xr-environment-toggle"
            aria-pressed={environmentOnly}
            disabled={sessionActive}
            onClick={() => {
              setEnvironmentOnly(!environmentOnly);
              setFocused(null);
              setYaw(0);
            }}
          >
            {environmentOnly ? <Eye size={16} /> : <EyeOff size={16} />}
            {t(
              environmentOnly ? "Вернуть аналитику" : "Осмотреть пространство",
            )}
          </Button>
          <Button
            className="xr-expand"
            aria-label={t(
              expanded ? "Свернуть 3D-просмотр" : "Развернуть 3D-просмотр",
            )}
            aria-pressed={expanded}
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            <span>{t(expanded ? "Свернуть" : "Развернуть")}</span>
          </Button>
        </div>
      </div>
      <div className="xr-panorama-tools">
        <Button onClick={recenterSpace}>
          {t("Центрировать пространство")}
        </Button>
      </div>
      <div
        className={`xr-canvas ${expanded ? "expanded" : ""}`}
        data-environment={theme}
        data-panorama-wings={data && !focused && !environmentOnly ? 3 : 0}
        data-focus-view={focused ? "combined" : "panorama"}
        role="group"
        aria-label={t(
          environmentOnly
            ? "Космическое окружение"
            : "Интерактивный 3D-просмотр десяти дашбордов",
        )}
      >
        <GraphicsBoundary>
          <Canvas
            frameloop="demand"
            camera={{ position: [0, 1.6, 0.7], fov: 68 }}
            dpr={[1, 1.5]}
            gl={{ alpha: true, antialias: true }}
            fallback={
              <div className="graphics-error">
                {t("WebGL недоступен. Используйте обычный обзор.")}
              </div>
            }
          >
            <XR store={xrStore}>
              <Scene
                yaw={yaw}
                focused={focused}
                setFocused={setFocused}
                environmentOnly={environmentOnly}
                dataContext={dataContext}
                recenter={recenter}
                onRecenter={recenterSpace}
                factsOffset={factsOffset}
                setFactsOffset={setFactsOffset}
              />
            </XR>
          </Canvas>
        </GraphicsBoundary>
        {!data && !environmentOnly ? (
          <div className="xr-no-data">
            <Database size={30} />
            <h3>
              {t(
                loading
                  ? "Загружаем аналитику"
                  : "Нет данных для пространственного просмотра",
              )}
            </h3>
            <Button
              variant="primary"
              busy={loading}
              disabled={loading}
              onClick={() => void refresh()}
            >
              {t("Повторить загрузку")}
            </Button>
          </div>
        ) : null}
      </div>
      {!environmentOnly ? (
        <>
          <div className="xr-focus-picker">
            <label htmlFor="xr-focus">{t("Приблизить дашборд")}</label>
            <NativeSelect
              id="xr-focus"
              disabled={!data}
              value={focused ?? 0}
              onChange={(e) => setFocused(Number(e.target.value) || null)}
            >
              <option value="0">{t("Панорамный обзор")}</option>
              {data
                ? Array.from({ length: 10 }, (_, i) => {
                    const m = dashboardModel(data, i + 1);
                    return (
                      <option key={m.id} value={m.id}>
                        {m.title}
                      </option>
                    );
                  })
                : null}
            </NativeSelect>
          </div>
          {focused &&
          data &&
          dashboardModel(data, focused).facts.length > FOCUS_ROWS ? (
            <label className="xr-facts-scroll">
              {t("Прокрутка точных значений")}
              <input
                type="range"
                aria-label={t("Прокрутка точных значений")}
                min={0}
                max={dashboardModel(data, focused).facts.length - FOCUS_ROWS}
                value={factsOffset}
                onChange={(e) => setFactsOffset(Number(e.target.value))}
              />
            </label>
          ) : null}
          <div className="xr-focus-navigation">
            <p role="status" className="xr-focus-status sr-only">
              {!data
                ? t("Данные недоступны")
                : focused
                  ? dashboardModel(data, focused).title
                  : t("Панорамный обзор")}
            </p>
            <div className="xr-focus-actions">
              <Button
                variant="outline"
                aria-label={t("Предыдущий дашборд")}
                disabled={!focused || focused === 1}
                onClick={() => focused && setFocused(focused - 1)}
              >
                <ArrowLeft size={16} />
              </Button>
              <Button
                variant="outline"
                disabled={!focused}
                onClick={() => setFocused(null)}
              >
                <LayoutGrid size={16} />
                {t("К панораме")}
              </Button>
              <Button
                variant="outline"
                aria-label={t("Следующий дашборд")}
                disabled={!focused || focused === 10}
                onClick={() => focused && setFocused(focused + 1)}
              >
                <ArrowRight size={16} />
              </Button>
            </div>
          </div>
        </>
      ) : null}
      <div className="xr-controls">
        <MoveHorizontal size={18} />
        <span>{t("Поворот")}</span>
        <Button
          className="icon-button"
          aria-label={t("Посмотреть на кассы")}
          onClick={() => lookAt(32)}
        >
          <ArrowLeft size={17} />
        </Button>
        <input
          aria-label={t("Поворот взгляда в градусах")}
          type="range"
          min={environmentOnly ? -180 : -45}
          max={environmentOnly ? 180 : 45}
          value={yaw}
          onChange={(e) => lookAt(Number(e.target.value))}
        />
        <Button
          className="icon-button"
          aria-label={t("Посмотреть на оборудование")}
          onClick={() => lookAt(-32)}
        >
          <ArrowRight size={17} />
        </Button>
        <Button
          onClick={() => {
            setYaw(0);
            setFocused(null);
          }}
        >
          <RotateCcw size={16} />
          {t("Центр")}
        </Button>
      </div>
      {error ? (
        <p role="alert" className="inline-warning">
          {t(error)}
        </p>
      ) : null}
      {support.checked && !support.ar && !support.vr ? (
        <p className="xr-support">
          {t("Для AR и VR откройте сайт в Meta Quest Browser.")}
        </p>
      ) : null}
      <p className="sr-only">{dataContext}</p>
    </div>
  );
}
