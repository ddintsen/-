import { useEffect, useMemo, useState } from "react";
import { useThree } from "@react-three/fiber";
import { Path, Shape, ShapeGeometry, type CanvasTexture } from "three";
import { colors } from "../api/model";
import { drawLabel, drawWing } from "./drawPanel";

function roundedPath<T extends Path>(
  path: T,
  w: number,
  h: number,
  r: number,
): T {
  const x = -w / 2,
    y = -h / 2;
  path.moveTo(x + r, y);
  path.lineTo(x + w - r, y);
  path.quadraticCurveTo(x + w, y, x + w, y + r);
  path.lineTo(x + w, y + h - r);
  path.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  path.lineTo(x + r, y + h);
  path.quadraticCurveTo(x, y + h, x, y + h - r);
  path.lineTo(x, y + r);
  path.quadraticCurveTo(x, y, x + r, y);
  path.closePath();
  return path;
}

/** @dashboard Д1–Д10. Shared XR surface: cursor, hover frame and disabled controls. */
export function SpatialSurface({
  texture,
  position = [0, 0, 0],
  width,
  height,
  opacity = 1,
  onSelect,
  disabled = false,
  focused = false,
}: {
  texture: CanvasTexture;
  position?: [number, number, number];
  width: number;
  height: number;
  opacity?: number;
  onSelect?: () => void;
  disabled?: boolean;
  focused?: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const { gl } = useThree();
  const interactive = !!onSelect && !disabled;
  const frame = useMemo(() => {
    const r = Math.min(width, height) * 0.045;
    const shape = roundedPath(new Shape(), width, height, r);
    shape.holes.push(
      roundedPath(
        new Path(),
        width - 0.008,
        height - 0.008,
        Math.max(0.001, r - 0.004),
      ),
    );
    return new ShapeGeometry(shape);
  }, [width, height]);
  useEffect(() => () => frame.dispose(), [frame]);
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
        renderOrder={focused ? 10 : 0}
        onPointerOver={
          interactive
            ? (e) => {
                e.stopPropagation();
                setHovered(true);
              }
            : undefined
        }
        onPointerOut={() => setHovered(false)}
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
          toneMapped={false}
          depthTest={!focused}
          depthWrite={false}
        />
      </mesh>
      {hovered && interactive ? (
        <mesh
          geometry={frame}
          position={[0, 0, 0.002]}
          renderOrder={focused ? 11 : 1}
          raycast={() => {}}
        >
          <meshBasicMaterial
            color={colors.purple}
            transparent
            opacity={opacity}
            toneMapped={false}
            depthTest={!focused}
            depthWrite={false}
          />
        </mesh>
      ) : null}
    </group>
  );
}

/** @dashboard Д1–Д10. Group frame gives the cockpit three named glass wings. */
export function SpatialWing({
  title,
  subtitle,
  width,
  height,
  position,
  opacity = 1,
}: {
  title: string;
  subtitle: string;
  width: number;
  height: number;
  position: [number, number, number];
  opacity?: number;
}) {
  const texture = useMemo(
    () => drawWing(title, subtitle, width / height),
    [title, subtitle, width, height],
  );
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <SpatialSurface
      texture={texture}
      width={width}
      height={height}
      position={position}
      opacity={opacity}
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
}: {
  label: string;
  position: [number, number, number];
  onSelect?: () => void;
  width?: number;
  height?: number;
  disabled?: boolean;
  focused?: boolean;
}) {
  const texture = useMemo(
    () => drawLabel(label, width / height),
    [label, width, height],
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
    />
  );
}
