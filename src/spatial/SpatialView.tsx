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
import { drawPanel, drawOverviewPanel } from "./drawPanel";
import { SpatialSurface, SpatialWing, SpatialControl } from "./SpatialSurface";
import { ProceduralRoom } from "./ProceduralRoom";
import { Button, NativeSelect } from "../components/ui";

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
        Не удалось запустить WebGL. Включите аппаратное ускорение браузера;
        обычные дашборды остаются доступны.
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
}: {
  model: DashboardModel;
  position: [number, number, number];
  scale?: number;
  focused: boolean;
  opacity?: number;
  onSelect: () => void;
}) {
  const compact = useDashboardStore((s) => s.compact);
  const texture = useMemo(
    () => (focused ? drawPanel(model, compact) : drawOverviewPanel(model)),
    [model, compact, focused],
  );
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <group position={position} scale={scale}>
      <SpatialSurface
        texture={texture}
        width={1.28}
        height={0.8}
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
  roomOnly,
  dataContext,
}: {
  yaw: number;
  focused: number | null;
  roomOnly: boolean;
  dataContext: string;
  setFocused: (v: number | null) => void;
}) {
  const data = useDashboardStore((s) => s.data);
  const theme = useDashboardStore((s) => s.theme);
  const { camera, gl, size, invalidate, setFrameloop } = useThree();
  const mode = useXR((s) => s.mode);
  const session = useXR((s) => s.session);
  const focusGroup = useRef<Group>(null);
  const focusPose = useRef<{ p: Vector3; q: Quaternion } | null>(null);
  const models = useMemo(
    () =>
      data
        ? Array.from({ length: 10 }, (_, i) => dashboardModel(data, i + 1))
        : [],
    [data],
  );
  useEffect(() => {
    gl.setClearColor(colors.background, mode === "immersive-ar" ? 0 : 1);
  }, [gl, mode]);
  useEffect(() => {
    // Static browser scenes redraw on interaction; head tracking needs every XR frame.
    setFrameloop(session ? "always" : "demand");
    invalidate();
  }, [session, setFrameloop, invalidate]);
  useEffect(() => {
    if (!session) {
      camera.position.set(0, 1.6, 0.7);
      camera.rotation.set(0, (yaw * Math.PI) / 180, 0);
      if (camera instanceof PerspectiveCamera) {
        // Keep the whole 1.28m focus card visible in a narrow or expanded browser preview.
        // The headset projection is owned by WebXR and is never changed here.
        camera.fov = Math.max(
          68,
          (2 * Math.atan(0.72 / ((1.1 * size.width) / size.height)) * 180) /
            Math.PI,
        );
        camera.updateProjectionMatrix();
      }
      invalidate();
    }
  }, [camera, yaw, session, size.width, size.height, invalidate]);
  useEffect(() => {
    if (focused) {
      const p = camera.getWorldPosition(new Vector3());
      const dir = camera.getWorldDirection(new Vector3());
      p.addScaledVector(dir, 1.1);
      focusPose.current = { p, q: camera.getWorldQuaternion(new Quaternion()) };
    } else focusPose.current = null;
    invalidate();
  }, [focused, camera, invalidate]);
  useFrame(() => {
    if (focusGroup.current && focusPose.current) {
      focusGroup.current.position.copy(focusPose.current.p);
      focusGroup.current.quaternion.copy(focusPose.current.q);
    }
  });
  // An opaque synthetic room belongs only to VR and the browser preview.
  const room =
    mode !== "immersive-ar" ? <ProceduralRoom dark={theme === "dark"} /> : null;
  if (roomOnly && !session) return <>{room}</>;
  if (!data)
    return (
      <>
        {room}
        <XROrigin />
        {session ? (
          <>
            <SpatialControl
              label="Данные недоступны"
              position={[0, 1.7, -1.1]}
              width={0.9}
              height={0.16}
            />
            <SpatialControl
              label="Завершить XR-сеанс"
              position={[0, 1.45, -1.1]}
              onSelect={() => void session.end()}
            />
          </>
        ) : null}
      </>
    );
  return (
    <>
      <XROrigin />
      {room}
      <group position={[0, 1.6, -1.8]}>
        <SpatialWing
          title="Платежи"
          width={2}
          height={1.66}
          position={[0, 0.04, -0.025]}
          opacity={focused ? 0.35 : 1}
        />
        {[1, 2, 3, 4].map((id, i) => (
          <Panel
            key={id}
            model={models[id - 1]}
            position={[
              ((i % 2) - 0.5) * 0.94,
              0.28 - Math.floor(i / 2) * 0.6,
              0,
            ]}
            scale={0.7}
            opacity={focused ? 0.25 : 1}
            focused={false}
            onSelect={() => setFocused(id)}
          />
        ))}
      </group>
      {[
        {
          ids: [5, 6, 7],
          x: -1.55,
          angle: 0.48,
          title: "Кассовые операции",
        },
        {
          ids: [8, 9, 10],
          x: 1.55,
          angle: -0.48,
          title: "Оборудование",
        },
      ].map((wing) => (
        <group
          key={wing.x}
          position={[wing.x, 1.6, -1.45]}
          rotation={[0, wing.angle, 0]}
        >
          <SpatialWing
            title={wing.title}
            width={1.08}
            height={2.24}
            position={[0, 0.08, -0.025]}
            opacity={focused ? 0.35 : 1}
          />
          {wing.ids.map((id, i) => (
            <Panel
              key={id}
              model={models[id - 1]}
              position={[0, 0.62 - i * 0.62, 0]}
              scale={0.74}
              opacity={focused ? 0.25 : 1}
              focused={false}
              onSelect={() => setFocused(id)}
            />
          ))}
        </group>
      ))}
      {focused ? (
        <group ref={focusGroup}>
          <Panel
            model={models[focused - 1]}
            position={[0, 0, 0]}
            focused
            onSelect={() => setFocused(null)}
          />
          <SpatialControl
            label="← Назад"
            position={[-0.45, -0.5, 0]}
            width={0.35}
            height={0.12}
            focused
            disabled={focused === 1}
            onSelect={() => setFocused(Math.max(1, focused - 1))}
          />
          <SpatialControl
            label="Панорама"
            position={[0, -0.5, 0]}
            width={0.43}
            height={0.12}
            focused
            onSelect={() => setFocused(null)}
          />
          <SpatialControl
            label="Далее →"
            position={[0.45, -0.5, 0]}
            width={0.35}
            height={0.12}
            focused
            disabled={focused === 10}
            onSelect={() => setFocused(Math.min(10, focused + 1))}
          />
          <SpatialControl
            label={dataContext}
            position={[0, -0.65, 0]}
            width={1.28}
            height={0.08}
            focused
          />
        </group>
      ) : null}
      {!focused ? (
        <SpatialControl
          label={dataContext}
          position={[0, 0.78, -1.8]}
          width={1.8}
          height={0.11}
        />
      ) : null}
      {session ? (
        <SpatialControl
          label="Завершить XR-сеанс"
          position={[0, 0.56, -1.8]}
          onSelect={() => void session.end()}
        />
      ) : null}
    </>
  );
}
export default function SpatialView() {
  const [yaw, setYaw] = useState(0),
    [focused, setFocused] = useState<number | null>(null),
    [support, setSupport] = useState({ ar: false, vr: false, checked: false });
  function lookAt(nextYaw: number) {
    setFocused(null);
    setYaw(nextYaw);
  }
  const [expanded, setExpanded] = useState(false);
  const [roomOnly, setRoomOnly] = useState(false);
  const theme = useDashboardStore((s) => s.theme);
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [sessionActive, setSessionActive] = useState(false);
  useEffect(() => {
    // A focus pose belongs to its current viewing space; start each XR/preview transition in panorama.
    setFocused(null);
    setYaw(0);
    setRoomOnly(false);
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
  const dataContext = useDashboardStore(
    (s) =>
      `${formatSource(s.source, !!s.lastLive)} · ${s.data?.meta.reportDate ?? "Нет данных"}`,
  );
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
            Войти в AR
          </Button>
          <Button
            variant="primary"
            disabled={!data || !support.vr || busy || sessionActive}
            onClick={() => void enter("vr")}
            busy={busy}
          >
            Войти в VR
          </Button>
        </div>
      </div>
      <div className="xr-preview-toolbar">
        <div
          className="xr-environments"
          role="group"
          aria-label="Окружение предпросмотра"
        >
          <Button
            className={theme === "office" ? "selected" : ""}
            aria-pressed={theme === "office"}
            onClick={() => useDashboardStore.setState({ theme: "office" })}
          >
            <Sun size={15} />
            Кабинет
          </Button>
          <Button
            className={theme === "dark" ? "selected" : ""}
            aria-pressed={theme === "dark"}
            onClick={() => useDashboardStore.setState({ theme: "dark" })}
          >
            <Moon size={15} />
            Тёмное окружение
          </Button>
        </div>
        <div className="xr-preview-actions">
          <Button
            className="xr-room-toggle"
            aria-pressed={roomOnly}
            disabled={sessionActive}
            onClick={() => {
              setRoomOnly(!roomOnly);
              setFocused(null);
              setYaw(0);
            }}
          >
            {roomOnly ? <Eye size={16} /> : <EyeOff size={16} />}
            {roomOnly ? "Вернуть аналитику" : "Осмотреть комнату"}
          </Button>
          <Button
            className="xr-expand"
            aria-label={
              expanded ? "Свернуть 3D-просмотр" : "Развернуть 3D-просмотр"
            }
            aria-pressed={expanded}
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            <span>{expanded ? "Свернуть" : "Развернуть"}</span>
          </Button>
        </div>
      </div>
      <div
        className={`xr-canvas ${expanded ? "expanded" : ""}`}
        data-environment={theme}
        role="group"
        aria-label={
          roomOnly
            ? "Процедурный 3D-кабинет"
            : "Интерактивный 3D-просмотр десяти дашбордов"
        }
      >
        <GraphicsBoundary>
          <Canvas
            frameloop="demand"
            camera={{ position: [0, 1.6, 0.7], fov: 68 }}
            dpr={[1, 1.5]}
            gl={{ alpha: true, antialias: true }}
            fallback={
              <div className="graphics-error">
                WebGL недоступен. Используйте обычный обзор.
              </div>
            }
          >
            <XR store={xrStore}>
              <Scene
                yaw={yaw}
                focused={focused}
                setFocused={setFocused}
                roomOnly={roomOnly}
                dataContext={dataContext}
              />
            </XR>
          </Canvas>
        </GraphicsBoundary>
        {!data && !roomOnly ? (
          <div className="xr-no-data">
            <Database size={30} />
            <h3>
              {loading
                ? "Загружаем аналитику"
                : "Нет данных для пространственного просмотра"}
            </h3>
            <Button
              variant="primary"
              busy={loading}
              disabled={loading}
              onClick={() => void refresh()}
            >
              Повторить загрузку
            </Button>
          </div>
        ) : null}
      </div>
      {!roomOnly ? (
        <>
          <div className="xr-focus-picker">
            <label htmlFor="xr-focus">Приблизить дашборд</label>
            <NativeSelect
              id="xr-focus"
              disabled={!data}
              value={focused ?? 0}
              onChange={(e) => setFocused(Number(e.target.value) || null)}
            >
              <option value="0">Панорамный обзор</option>
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
          <div className="xr-focus-navigation">
            <p role="status" className="xr-focus-status sr-only">
              {!data
                ? "Данные недоступны"
                : focused
                  ? dashboardModel(data, focused).title
                  : "Панорамный обзор"}
            </p>
            <div className="xr-focus-actions">
              <Button
                variant="outline"
                aria-label="Предыдущий дашборд"
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
                <LayoutGrid size={16} />К панораме
              </Button>
              <Button
                variant="outline"
                aria-label="Следующий дашборд"
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
        <span>Поворот</span>
        <Button
          className="icon-button"
          aria-label="Посмотреть на кассы"
          onClick={() => lookAt(32)}
        >
          <ArrowLeft size={17} />
        </Button>
        <input
          aria-label="Поворот взгляда в градусах"
          type="range"
          min={roomOnly ? -180 : -45}
          max={roomOnly ? 180 : 45}
          value={yaw}
          onChange={(e) => lookAt(Number(e.target.value))}
        />
        <Button
          className="icon-button"
          aria-label="Посмотреть на оборудование"
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
          Центр
        </Button>
      </div>
      {error ? (
        <p role="alert" className="inline-warning">
          {error}
        </p>
      ) : null}
      {support.checked && !support.ar && !support.vr ? (
        <p className="xr-support">
          Для AR и VR откройте сайт в Meta Quest Browser.
        </p>
      ) : null}
      <p className="sr-only">{dataContext}</p>
    </div>
  );
}
