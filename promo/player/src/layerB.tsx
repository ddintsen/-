// Layer B: the in-headset scene, composed exactly like `Scene` in src/spatial/SpatialView.tsx in
// session mode (stands on the arc, session-only controls, focus group), from the product's own
// exported modules. Only `Panel` is copied verbatim because the app does not export it.
import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Quaternion, Vector3, type Group } from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { useDashboardStore } from "../../../src/store/dashboard";
import { colors, dashboardModel, type DashboardModel } from "../../../src/api/model";
import { drawOverviewPanel, drawFocusPanel } from "../../../src/spatial/drawPanel";
import { SpatialSurface, SpatialControl, SpatialWing, useBrandFontReady } from "../../../src/spatial/SpatialSurface";
import { spatialStands, FOCUS_ROWS, focusSurfaceHeight } from "../../../src/spatial/layout";
import { formatReportDate, t, useLocale } from "../../../src/i18n";

const standSlab = new RoundedBoxGeometry(1.26, 1.1, 0.03, 4, 0.07);
const STAND_ORDER = [1, 0, 1];

/* ---- copied verbatim from src/spatial/SpatialView.tsx (not exported there) ---- */
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
  appearDelay = 0,
  period = "",
}: {
  period?: string;
  appearDelay?: number;
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
  const dark = useDashboardStore((s) => s.theme === "dark");
  const locale = useLocale();
  const fontReady = useBrandFontReady();
  const texture = useMemo(
    () =>
      focused
        ? drawFocusPanel(model, compact, factsOffset, dark, period)
        : drawOverviewPanel(model, wide, dark),
    [
      model,
      compact,
      focused,
      locale,
      factsOffset,
      wide,
      fontReady,
      dark,
      period,
    ],
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
        appearDelay={appearDelay}
      />
    </group>
  );
}
/* ---- end of copy ---- */

/** Shared with the film director: the focus group's pose and the current state. */
export const layerState = {
  focused: null as number | null,
  focusPose: null as { p: Vector3; q: Quaternion } | null,
  focusHeight: 0,
};

export function LayerB({
  focused,
  setFocused,
}: {
  focused: number | null;
  setFocused: (v: number | null) => void;
}) {
  const data = useDashboardStore((s) => s.data);
  const locale = useLocale();
  const theme = useDashboardStore((s) => s.theme);
  const { camera } = useThree();
  const focusGroup = useRef<Group>(null);
  const focusPose = useRef<{ p: Vector3; q: Quaternion } | null>(null);
  const models = useMemo(
    () => (data ? Array.from({ length: 10 }, (_, i) => dashboardModel(data, i + 1)) : []),
    [data, locale],
  );
  const period = data ? formatReportDate(data.meta.reportDate) : "";
  const hasFocus = focused !== null;
  // As in SpatialView: the focus pose is taken once from the viewer at the moment of focus.
  useEffect(() => {
    if (hasFocus) {
      const p = camera.getWorldPosition(new Vector3());
      const dir = camera.getWorldDirection(new Vector3());
      dir.y = 0;
      dir.normalize();
      p.addScaledVector(dir, 1.5);
      const q = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), Math.atan2(-dir.x, -dir.z));
      focusPose.current = { p, q };
    } else focusPose.current = null;
    layerState.focusPose = focusPose.current;
  }, [hasFocus, camera]);
  useFrame(() => {
    if (focusGroup.current && focusPose.current) {
      focusGroup.current.position.copy(focusPose.current.p);
      focusGroup.current.quaternion.copy(focusPose.current.q);
    }
  });
  const focusHeight = focused && data ? focusSurfaceHeight(models[focused - 1].facts.length) : 0.9;
  const maxOffset = focused && data ? Math.max(0, models[focused - 1].facts.length - FOCUS_ROWS) : 0;
  layerState.focused = focused;
  layerState.focusHeight = focusHeight;
  const noop = () => {};
  return (
    <>
      <ambientLight intensity={theme === "dark" ? 0.35 : 0.8} />
      <directionalLight position={[-3, 4, 2]} intensity={theme === "dark" ? 1.4 : 1.8} />
      {/* The anchor of a session started at the origin. */}
      <group>
        {!hasFocus && data
          ? spatialStands.map((stand, standIndex) => (
              <group key={stand.key} name={`stand-${stand.key}`} position={[stand.x, 1.6, stand.z]} rotation={[0, stand.angle, 0]}>
                <mesh position={[0, 0, -0.05]} renderOrder={0} raycast={() => {}}>
                  <primitive object={standSlab} attach="geometry" />
                  <meshStandardMaterial
                    color={theme === "dark" ? colors["space-blue"] : colors["light-elevated"]}
                    roughness={0.35}
                    metalness={0.15}
                    transparent
                    opacity={0.55}
                    depthWrite={false}
                  />
                </mesh>
                <SpatialWing
                  appearDelay={STAND_ORDER[standIndex] * 0.12}
                  aside={stand.key === "payments" ? period : undefined}
                  title={t(stand.title)}
                  width={1.28}
                  height={1.12}
                  position={[0, 0, -0.025]}
                />
                {stand.panels.map((panel, panelIndex) => (
                  <Panel
                    appearDelay={STAND_ORDER[standIndex] * 0.12 + 0.18 + panelIndex * 0.07}
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
        {/* Session-only actions (the app shows them only while an XR session runs). */}
        {!hasFocus ? (
          <group position={[0, 1.04, -1.35]} rotation={[-0.31, 0, 0]}>
            <SpatialControl label={t("Центрировать пространство")} position={[-0.5, 0, 0]} width={0.94} height={0.16} onSelect={noop} />
            <SpatialControl label={t("Завершить XR-сеанс")} position={[0.5, 0, 0]} width={0.94} height={0.16} onSelect={noop} />
          </group>
        ) : null}
      </group>
      {focused && data ? (
        <group ref={focusGroup} key={focused} name="focus-group">
          <Panel model={models[focused - 1]} position={[0, 0, 0]} focused factsOffset={0} period={period} />
          <SpatialControl label={t("← Назад")} position={[-0.79, -focusHeight / 2 - 0.12, 0]} width={0.44} height={0.16} focused disabled={focused === 1} onSelect={() => setFocused(focused - 1)} />
          <SpatialControl label={t("Панорама")} position={[-0.26, -focusHeight / 2 - 0.12, 0]} width={0.54} height={0.16} focused onSelect={() => setFocused(null)} />
          <SpatialControl label={t("Далее →")} position={[0.27, -focusHeight / 2 - 0.12, 0]} width={0.44} height={0.16} focused disabled={focused === 10} onSelect={() => setFocused(focused + 1)} />
          <SpatialControl label={t("Центрировать пространство")} position={[0.79, -focusHeight / 2 - 0.12, 0]} width={0.5} height={0.16} focused onSelect={noop} />
          {maxOffset > 0 ? null : null}
        </group>
      ) : null}
    </>
  );
}
