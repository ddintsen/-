import { useEffect, useMemo } from "react";
import { useLoader } from "@react-three/fiber";
import {
  BackSide,
  BufferGeometry,
  CanvasTexture,
  Color,
  Float32BufferAttribute,
  SRGBColorSpace,
  TextureLoader,
} from "three";
import { colors } from "../api/model";
import earthImage from "../assets/earth-atmosphere.jpg";

function skyTexture(dark: boolean) {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext("2d")!;
  const base = ctx.createLinearGradient(0, 0, 0, 512);
  base.addColorStop(0, dark ? colors["space-night"] : colors["space-light"]);
  base.addColorStop(
    0.5,
    dark ? colors["space-blue"] : colors["space-light-mid"],
  );
  base.addColorStop(
    1,
    dark ? colors["space-night"] : colors["space-light-horizon"],
  );
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 1024, 512);
  for (const [x, y, radius] of [
    [180, 190, 280],
    [470, 250, 320],
    [760, 150, 260],
  ]) {
    const cloud = ctx.createRadialGradient(x, y, 0, x, y, radius);
    cloud.addColorStop(
      0,
      dark ? "rgba(62, 110, 177, .14)" : "rgba(227, 243, 255, .25)",
    );
    cloud.addColorStop(1, "rgba(110, 170, 235, 0)");
    ctx.fillStyle = cloud;
    ctx.fillRect(0, 0, 1024, 512);
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}
function starsGeometry() {
  let seed = 137;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const positions: number[] = [],
    shades: number[] = [];
  for (let i = 0; i < 1400; i++) {
    const y = random() * 2 - 1,
      angle = random() * Math.PI * 2,
      r = 85 + random() * 30;
    const horizontal = Math.sqrt(1 - y * y);
    positions.push(
      Math.cos(angle) * horizontal * r,
      y * r,
      Math.sin(angle) * horizontal * r,
    );
    const brightness = 0.5 + random() * 0.5;
    const color = new Color(colors["space-star"]).multiplyScalar(brightness);
    shades.push(color.r, color.g, color.b);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new Float32BufferAttribute(shades, 3));
  return geometry;
}

/** A static, distant environment; no animation, camera movement or remote runtime resources. AR omits it. */
export function SpaceEnvironment({ dark }: { dark: boolean }) {
  const sky = useMemo(() => skyTexture(dark), [dark]);
  const stars = useMemo(starsGeometry, []);
  const orbit = useMemo(() => {
    const points: number[] = [];
    for (let i = 0; i < 180; i++) {
      const angle = (i / 180) * Math.PI * 2;
      points.push(Math.cos(angle) * 15, 0, Math.sin(angle) * 15);
    }
    return new BufferGeometry().setAttribute(
      "position",
      new Float32BufferAttribute(points, 3),
    );
  }, []);
  const earth = useLoader(TextureLoader, earthImage);
  earth.colorSpace = SRGBColorSpace;
  earth.anisotropy = 4;
  useEffect(() => () => sky.dispose(), [sky]);
  useEffect(
    () => () => {
      stars.dispose();
      orbit.dispose();
    },
    [stars, orbit],
  );
  return (
    <group name="space-environment">
      <mesh raycast={() => {}}>
        <sphereGeometry args={[140, 32, 16]} />
        <meshBasicMaterial map={sky} side={BackSide} toneMapped={false} />
      </mesh>
      <points geometry={stars} raycast={() => {}}>
        <pointsMaterial
          vertexColors
          size={dark ? 1.9 : 1.6}
          sizeAttenuation={false}
          transparent
          opacity={dark ? 0.9 : 0.8}
          depthWrite={false}
          toneMapped={false}
        />
      </points>
      <ambientLight intensity={dark ? 0.16 : 0.45} />
      <directionalLight
        position={[-20, 16, 8]}
        intensity={2.5}
        color={colors["space-star"]}
      />
      <group position={[15, -7.5, -36]} rotation={[0, -1.5, 0.18]}>
        <mesh raycast={() => {}}>
          <sphereGeometry args={[10, 64, 40]} />
          <meshStandardMaterial map={earth} roughness={0.94} metalness={0} />
        </mesh>
        <mesh raycast={() => {}}>
          <sphereGeometry args={[10.16, 64, 40]} />
          <meshBasicMaterial
            color={colors["space-atmosphere"]}
            side={BackSide}
            transparent
            opacity={0.2}
            depthWrite={false}
          />
        </mesh>
        <lineLoop
          geometry={orbit}
          rotation={[0.55, 0, 0.2]}
          scale={[1.2, 1, 1]}
          raycast={() => {}}
        >
          <lineBasicMaterial
            color={colors["space-orbit"]}
            transparent
            opacity={dark ? 0.13 : 0.22}
            depthWrite={false}
          />
        </lineLoop>
      </group>
    </group>
  );
}
