import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
  Color,
  type CanvasTexture,
  type Group,
  type MeshBasicMaterial,
} from "three";
import { drawLabel, drawWing } from "./drawPanel";
import { useLocale } from "../i18n";

const surfaceColor = new Color(1, 1, 1);
const hoverColor = new Color(1.16, 1.16, 1.16);
const pressedColor = new Color(0.78, 0.78, 0.9);
// A hovered surface rises toward the viewer, like a visionOS window, so the ray target reads in depth.
const HOVER_LIFT = 0.035;
const APPEAR_SECONDS = 0.7;
const reducedMotion =
  typeof matchMedia === "function" &&
  matchMedia("(prefers-reduced-motion: reduce)").matches;

/** @dashboard Д1–Д10. Shared XR surface: fill feedback, pointer and disabled controls. */
export function SpatialSurface({
  texture,
  position = [0, 0, 0],
  width,
  height,
  opacity = 1,
  onSelect,
  disabled = false,
  focused = false,
  selected = false,
  renderOrder,
  appearDelay = 0,
}: {
  texture: CanvasTexture;
  position?: [number, number, number];
  width: number;
  height: number;
  opacity?: number;
  onSelect?: () => void;
  disabled?: boolean;
  focused?: boolean;
  selected?: boolean;
  renderOrder?: number;
  /** Seconds before the surface rises out of depth on mount; 0 still animates. */
  appearDelay?: number;
}) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);
  const { gl, invalidate } = useThree();
  const interactive = !!onSelect && !disabled;
  const lift = useRef<Group>(null);
  const material = useRef<MeshBasicMaterial>(null);
  const appear = useRef(reducedMotion ? APPEAR_SECONDS : -appearDelay);
  const baseOpacity = opacity * (disabled ? 0.4 : 1);
  useFrame((_, delta) => {
    const group = lift.current;
    if (!group) return;
    if (appear.current < APPEAR_SECONDS) {
      appear.current += Math.min(delta, 0.05);
      const k = Math.max(0, Math.min(1, appear.current / APPEAR_SECONDS));
      const eased = 1 - Math.pow(1 - k, 3);
      group.position.y = (1 - eased) * -0.05;
      if (material.current) material.current.opacity = baseOpacity * eased;
      invalidate();
      return;
    }
    if (material.current) material.current.opacity = baseOpacity;
    group.position.y = 0;
    const target =
      hovered && interactive ? (pressed ? HOVER_LIFT * 0.4 : HOVER_LIFT) : 0;
    const gap = target - group.position.z;
    if (Math.abs(gap) < 0.0005) {
      group.position.z = target;
      return;
    }
    group.position.z += gap * Math.min(1, delta * 14);
    invalidate();
  });
  useEffect(() => {
    if (!hovered || !interactive) return;
    const canvas = gl.domElement;
    canvas.style.cursor = "pointer";
    return () => {
      canvas.style.cursor = "";
    };
  }, [hovered, interactive, gl]);
  return (
    <group position={position}>
      <group ref={lift}>
        <mesh
          renderOrder={renderOrder ?? (focused ? 10 : 2)}
          onPointerOver={
            interactive
              ? (e) => {
                  e.stopPropagation();
                  setHovered(true);
                }
              : undefined
          }
          onPointerOut={() => {
            setHovered(false);
            setPressed(false);
          }}
          onPointerDown={
            interactive
              ? (e) => {
                  e.stopPropagation();
                  setPressed(true);
                }
              : undefined
          }
          onPointerUp={() => setPressed(false)}
          onClick={
            interactive
              ? (e) => {
                  e.stopPropagation();
                  onSelect?.();
                }
              : undefined
          }
        >
          <planeGeometry args={[width, height]} />
          <meshBasicMaterial
            ref={material}
            map={texture}
            transparent
            // Re-renders during arrival must not reset the eased opacity.
            opacity={appear.current >= APPEAR_SECONDS ? baseOpacity : 0}
            // Brighten the whole surface on hover, without a decorative rim or scale jump.
            color={
              pressed
                ? pressedColor
                : (hovered && interactive) || selected
                  ? hoverColor
                  : surfaceColor
            }
            toneMapped={false}
            depthTest={false}
            depthWrite={false}
          />
        </mesh>
      </group>
    </group>
  );
}

/** @dashboard Д1–Д10. The shared group surface carries its subject heading. */
export function SpatialWing({
  title,
  width,
  height,
  position,
  opacity = 1,
  appearDelay = 0,
}: {
  appearDelay?: number;
  title: string;
  width: number;
  height: number;
  position: [number, number, number];
  opacity?: number;
}) {
  const locale = useLocale();
  const texture = useMemo(
    () => drawWing(title, width / height),
    [title, width, height, locale],
  );
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <SpatialSurface
      texture={texture}
      width={width}
      height={height}
      position={position}
      opacity={opacity}
      renderOrder={1}
      appearDelay={appearDelay}
    />
  );
}

/** @dashboard Д1–Д10. Actions are real XR meshes, also available as native DOM buttons. */
export function SpatialControl({
  label,
  position,
  onSelect,
  width = 0.9,
  height = 0.14,
  disabled = false,
  focused = false,
  selected = false,
}: {
  label: string;
  position: [number, number, number];
  onSelect?: () => void;
  width?: number;
  height?: number;
  disabled?: boolean;
  focused?: boolean;
  selected?: boolean;
}) {
  const locale = useLocale();
  const texture = useMemo(
    () => drawLabel(label, width / height, selected),
    [label, width, height, locale, selected],
  );
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <SpatialSurface
      texture={texture}
      position={position}
      width={width}
      height={height}
      onSelect={onSelect}
      disabled={disabled}
      focused={focused}
      selected={selected}
    />
  );
}
