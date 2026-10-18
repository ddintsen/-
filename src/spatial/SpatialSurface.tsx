import { useEffect, useMemo, useState } from "react";
import { useThree } from "@react-three/fiber";
import { Color, type CanvasTexture } from "three";
import { drawLabel, drawWing } from "./drawPanel";
import { useLocale } from "../i18n";

const surfaceColor = new Color(1, 1, 1);
const hoverColor = new Color(1.16, 1.16, 1.16);
const pressedColor = new Color(0.78, 0.78, 0.9);

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
}) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);
  const { gl } = useThree();
  const interactive = !!onSelect && !disabled;
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
          map={texture}
          transparent
          opacity={opacity * (disabled ? 0.4 : 1)}
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
  );
}

/** @dashboard Д1–Д10. The shared group surface carries its subject heading. */
export function SpatialWing({
  title,
  width,
  height,
  position,
  opacity = 1,
}: {
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
