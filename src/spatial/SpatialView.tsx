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
import { Quaternion, Vector3, type Group } from "three";
import {
  Glasses,
  RotateCcw,
  ArrowLeft,
  ArrowRight,
  MoveHorizontal,
} from "lucide-react";
import { useDashboardStore } from "../store/dashboard";
import { colors, dashboardModel, type DashboardModel } from "../api/model";
import { drawLabel, drawPanel, drawOverviewPanel } from "./drawPanel";
import { Button, NativeSelect } from "../components/ui";

// No remote hand/controller model download. Local profile JSON resolves controller buttons.
const xrStore = createXRStore({
  emulate: false,
  offerSession: false,
  enterGrantedSession: false,
  handTracking: true,
  hand: { model: false },
  controller: { model: false },
  baseAssetPath: new URL("/xr-profiles/", window.location.href).href,
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
  const compact = useDashboardStore((s) => s.compact),
    source = useDashboardStore((s) => s.source);
  const label =
    source === "live"
      ? "API"
      : source === "fallback"
        ? "РЕЗЕРВНЫЕ ДАННЫЕ"
        : source === "error"
          ? "ОШИБКА API"
          : source === "simulation"
            ? "СИМУЛЯЦИЯ"
            : "ДЕМОДАННЫЕ";
  const texture = useMemo(
    () =>
      focused
        ? drawPanel(model, compact, label)
        : drawOverviewPanel(model, label),
    [model, compact, label, focused],
  );
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <mesh
      position={position}
      scale={scale}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
    >
      <planeGeometry args={[1.28, 0.8]} />
      <meshBasicMaterial
        map={texture}
        transparent
        opacity={opacity}
        toneMapped={false}
        depthTest={!focused}
      />
    </mesh>
  );
}
function Control({
  label,
  position,
  onClick,
}: {
  label: string;
  position: [number, number, number];
  onClick: () => void;
}) {
  const texture = useMemo(() => drawLabel(label), [label]);
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <mesh
      position={position}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      <planeGeometry args={[0.9, 0.14]} />
      <meshBasicMaterial map={texture} transparent toneMapped={false} />
    </mesh>
  );
}
function Scene({
  yaw,
  setFocused,
  focused,
}: {
  yaw: number;
  focused: number | null;
  setFocused: (v: number | null) => void;
}) {
  const data = useDashboardStore((s) => s.data);
  const { camera, gl } = useThree();
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
    if (!session) {
      camera.position.set(0, 1.6, 0.7);
      camera.rotation.set(0, (yaw * Math.PI) / 180, 0);
    }
  }, [camera, yaw, session]);
  useEffect(() => {
    if (focused) {
      const p = camera.getWorldPosition(new Vector3());
      const dir = camera.getWorldDirection(new Vector3());
      p.addScaledVector(dir, 1.1);
      focusPose.current = { p, q: camera.getWorldQuaternion(new Quaternion()) };
    } else focusPose.current = null;
  }, [focused, camera]);
  useFrame(() => {
    if (focusGroup.current && focusPose.current) {
      focusGroup.current.position.copy(focusPose.current.p);
      focusGroup.current.quaternion.copy(focusPose.current.q);
    }
  });
  if (!data) return null;
  return (
    <>
      <XROrigin />
      {mode !== "immersive-ar" ? (
        <>
          <gridHelper
            args={[16, 32, colors.scrollbar, colors.elevated]}
            position={[0, -0.1, 0]}
          />
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.11, 0]}>
            <planeGeometry args={[30, 30]} />
            <meshBasicMaterial color={colors.background} />
          </mesh>
        </>
      ) : null}
      <group position={[0, 1.6, -1.8]}>
        {[1, 2, 3, 4].map((id, i) => (
          <Panel
            key={id}
            model={models[id - 1]}
            position={[
              ((i % 2) - 0.5) * 0.82,
              0.28 - Math.floor(i / 2) * 0.53,
              0,
            ]}
            scale={0.62}
            opacity={focused ? 0.25 : 1}
            focused={false}
            onSelect={() => setFocused(id)}
          />
        ))}
      </group>
      {[
        { ids: [5, 6, 7], x: -1.55, angle: 0.48 },
        { ids: [8, 9, 10], x: 1.55, angle: -0.48 },
      ].map((wing) => (
        <group
          key={wing.x}
          position={[wing.x, 1.6, -1.45]}
          rotation={[0, wing.angle, 0]}
        >
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
          <Control
            label="Вернуть панель"
            position={[0, -0.53, 0]}
            onClick={() => setFocused(null)}
          />
        </group>
      ) : null}
      <Control
        label={session ? "Завершить XR-сеанс" : "Выберите панель для фокуса"}
        position={[0, 0.78, -1.8]}
        onClick={() => {
          if (session) void session.end();
          else setFocused(1);
        }}
      />
    </>
  );
}
export default function SpatialView() {
  const [yaw, setYaw] = useState(0),
    [focused, setFocused] = useState<number | null>(null),
    [support, setSupport] = useState({ ar: false, vr: false, checked: false });
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [sessionActive, setSessionActive] = useState(false);
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
  return (
    <div className="spatial-view">
      <div className="xr-toolbar">
        <div>
          <h3>Пространственный обзор</h3>
          <p>Три панели вокруг вас. Выберите карточку, чтобы приблизить.</p>
        </div>
        <div>
          <Button
            variant="outline"
            disabled={!support.ar || busy || sessionActive}
            onClick={() => void enter("ar")}
          >
            <Glasses size={18} />
            AR · окружение
          </Button>
          <Button
            variant="primary"
            disabled={!support.vr || busy || sessionActive}
            onClick={() => void enter("vr")}
            busy={busy}
          >
            Войти в VR
          </Button>
        </div>
      </div>
      <div className="xr-canvas">
        <GraphicsBoundary>
          <Canvas
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
              <Scene yaw={yaw} focused={focused} setFocused={setFocused} />
            </XR>
          </Canvas>
        </GraphicsBoundary>
      </div>
      <div className="xr-focus-picker">
        <label htmlFor="xr-focus">Приблизить дашборд</label>
        <NativeSelect
          id="xr-focus"
          value={focused ?? 0}
          onChange={(e) => setFocused(Number(e.target.value) || null)}
        >
          <option value="0">Панорамный обзор</option>
          {data
            ? Array.from({ length: 10 }, (_, i) => {
                const m = dashboardModel(data, i + 1);
                return (
                  <option key={m.id} value={m.id}>
                    Д{m.id} · {m.title}
                  </option>
                );
              })
            : null}
        </NativeSelect>
      </div>
      <div className="xr-controls">
        <MoveHorizontal size={18} />
        <span>Поворот взгляда</span>
        <Button
          className="icon-button"
          aria-label="Посмотреть на кассы"
          onClick={() => setYaw(32)}
        >
          <ArrowLeft size={17} />
        </Button>
        <input
          aria-label="Поворот взгляда в градусах"
          type="range"
          min="-45"
          max="45"
          value={yaw}
          onChange={(e) => setYaw(Number(e.target.value))}
        />
        <Button
          className="icon-button"
          aria-label="Посмотреть на оборудование"
          onClick={() => setYaw(-32)}
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
      <p className="xr-support">
        {support.checked && !support.ar && !support.vr
          ? "Этот браузер не поддерживает immersive WebXR. Выше работает 3D-просмотр; вход в AR/VR доступен в совместимом шлеме по HTTPS."
          : "В шлеме: луч контроллера + курок или луч руки + pinch. Повторное нажатие возвращает панель."}
      </p>
    </div>
  );
}
