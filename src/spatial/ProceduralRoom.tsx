import { useEffect, useMemo } from "react";
import {
  BackSide,
  BoxGeometry,
  BufferGeometry,
  CanvasTexture,
  Color,
  CylinderGeometry,
  Euler,
  Matrix4,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  Quaternion,
  RepeatWrapping,
  SphereGeometry,
  SRGBColorSpace,
  Vector3,
  type Material,
} from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { colors } from "../api/model";

type Vec3 = [number, number, number];
type Finish = "plaster" | "oak" | "stone" | "metal";

// Local, deterministic textures keep both the overview and XR room available offline.
function texture(kind: "oak" | "plaster" | "sky") {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  if (kind === "sky") {
    const gradient = ctx.createLinearGradient(0, 0, 0, 256);
    gradient.addColorStop(0, colors["room-sky"]);
    gradient.addColorStop(0.55, colors["room-horizon"]);
    gradient.addColorStop(1, colors["room-landscape"]);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 256, 256);
  } else {
    let seed = 137;
    const random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 3500; i++) {
      ctx.fillStyle = `rgba(0, 0, 0, ${random() * 0.035})`;
      ctx.fillRect(
        random() * 256,
        random() * 256,
        kind === "oak" ? 0.6 : 2,
        kind === "oak" ? 10 + random() * 60 : 0.7,
      );
    }
    if (kind === "oak") {
      ctx.fillStyle = "rgba(0, 0, 0, 0.06)";
      for (let x = 0; x < 256; x += 64) ctx.fillRect(x, 0, 0.5, 256);
    }
  }
  const map = new CanvasTexture(canvas);
  map.colorSpace = SRGBColorSpace;
  map.wrapS = map.wrapT = RepeatWrapping;
  map.anisotropy = 4;
  if (kind === "oak") map.repeat.set(3, 3);
  return map;
}

function buildRoom(dark: boolean) {
  const maps = {
    oak: texture("oak"),
    plaster: texture("plaster"),
    sky: texture("sky"),
  };
  const batches = new Map<Material, BufferGeometry[]>();
  const finish = Object.fromEntries(
    (["plaster", "oak", "stone", "metal"] as const).map((name) => [
      name,
      new MeshStandardMaterial({
        color: new Color(colors[`room-${name}`]).multiplyScalar(
          dark ? 0.52 : 1,
        ),
        map: name === "oak" || name === "plaster" ? maps[name] : null,
        roughness: name === "metal" ? 0.55 : 0.94,
        metalness: name === "metal" ? 0.2 : 0,
      }),
    ]),
  ) as Record<Finish, MeshStandardMaterial>;
  const sky = new MeshBasicMaterial({
    map: maps.sky,
    color: dark ? colors["room-night"] : "white",
    side: BackSide,
    toneMapped: false,
  });
  const landscape = new MeshStandardMaterial({
    color: new Color(colors["room-landscape"]).multiplyScalar(dark ? 0.38 : 1),
    roughness: 1,
  });
  const glow = new MeshBasicMaterial({
    color: dark ? colors["room-night-light"] : colors["room-light"],
  });
  const sunlight = new MeshBasicMaterial({
    color: colors["room-light"],
    transparent: true,
    opacity: dark ? 0.025 : 0.12,
    depthWrite: false,
  });
  function add(
    geometry: BufferGeometry,
    material: Material,
    p: Vec3,
    rotation: Vec3 = [0, 0, 0],
    scale: Vec3 = [1, 1, 1],
  ) {
    geometry.applyMatrix4(
      new Matrix4().compose(
        new Vector3(...p),
        new Quaternion().setFromEuler(new Euler(...rotation)),
        new Vector3(...scale),
      ),
    );
    const flat = geometry.index ? geometry.toNonIndexed() : geometry;
    if (flat !== geometry) geometry.dispose();
    const batch = batches.get(material) ?? [];
    batch.push(flat);
    batches.set(material, batch);
  }
  const box = (p: Vec3, dimensions: Vec3, material: Finish = "plaster") =>
    add(new BoxGeometry(...dimensions), finish[material], p);

  // Empty architecture: floor, ceiling, wall openings and glazing. No furniture or props.
  box([0, -0.09, -0.8], [8.4, 0.18, 9.6], "oak");
  box([0, 3.5, -0.8], [8.5, 0.16, 9.7]);
  box([4.2, 1.75, -0.8], [0.18, 3.5, 9.6]);
  box([0, 1.75, 4], [8.4, 3.5, 0.18]);
  box([1.9, 1.75, -5.6], [4.6, 3.5, 0.18]);
  box([-2.3, 0.28, -5.6], [3.8, 0.56, 0.18]);
  box([-2.3, 3.39, -5.6], [3.8, 0.22, 0.18]);
  box([-4.2, 0.28, -0.8], [0.18, 0.56, 9.6]);
  box([-4.2, 3.39, -0.8], [0.18, 0.22, 9.6]);
  for (const z of [-5.5, -3.15, -0.8, 1.55, 3.9])
    box([-4.14, 1.94, z], [0.055, 2.76, 0.055], "metal");
  for (const x of [-4.1, -2.3, -0.45])
    box([x, 1.94, -5.53], [0.055, 2.76, 0.055], "metal");
  box([-4.08, 0.58, -0.8], [0.24, 0.045, 9.6], "stone");
  box([-2.3, 0.58, -5.45], [3.8, 0.045, 0.24], "stone");
  // A shallow wall recess and continuous skirting give the room depth without objects.
  box([4.085, 1.75, -3.85], [0.025, 3.25, 2.6], "stone");
  box([0, 0.055, -5.49], [8.25, 0.11, 0.035], "stone");
  box([4.09, 0.055, -0.8], [0.035, 0.11, 9.4], "stone");

  add(new SphereGeometry(35, 24, 12), sky, [0, 0, 0]);
  for (let i = 0; i < 9; i++)
    add(
      new SphereGeometry(1, 16, 8),
      landscape,
      [-15 + i * 4.1, -2.1 + (i % 3) * 0.3, -14 - (i % 2) * 4],
      [0, 0, 0],
      [6, 3.6, 5],
    );
  for (let i = 0; i < 4; i++)
    add(
      new PlaneGeometry(1.55, 4.4),
      sunlight,
      [-2.7 + i * 1.45, 0.006, -2.5 + i * 0.16],
      [-Math.PI / 2, 0, -0.55],
    );
  // Recessed ceiling lights, no bloom, postprocessing or realtime shadow maps.
  for (const x of [-1.4, 1.4]) {
    box([x, 3.4, -2.4], [0.045, 0.018, 3.1], "metal");
    add(new BoxGeometry(0.025, 0.008, 2.95), glow, [x, 3.385, -2.4]);
  }
  for (const x of [-2.7, 2.7])
    add(new CylinderGeometry(0.036, 0.036, 0.008, 12), glow, [x, 3.39, 0.5]);

  const meshes = Array.from(batches, ([material, geometries]) => {
    const geometry = mergeGeometries(geometries, false)!;
    geometries.forEach((g) => g.dispose());
    return { geometry, material };
  });
  return {
    meshes,
    dispose() {
      meshes.forEach(({ geometry, material }) => {
        geometry.dispose();
        material.dispose();
      });
      Object.values(maps).forEach((map) => map.dispose());
    },
  };
}

/** Shared empty, metre-scaled room for the overview and VR. AR never mounts it. */
export function ProceduralRoom({ dark }: { dark: boolean }) {
  const room = useMemo(() => buildRoom(dark), [dark]);
  useEffect(() => () => room.dispose(), [room]);
  return (
    <group name="empty-room" dispose={null}>
      <hemisphereLight
        args={[colors["room-horizon"], colors["room-stone"], dark ? 0.85 : 2.2]}
      />
      <directionalLight
        position={[-3, 4, -1]}
        color={colors["room-light"]}
        intensity={dark ? 0.24 : 2.6}
      />
      {dark ? (
        <pointLight
          position={[1.5, 3.1, -2.4]}
          color={colors["room-night-light"]}
          intensity={9}
          distance={9}
          decay={2}
        />
      ) : null}
      {room.meshes.map(({ geometry, material }, i) => (
        <mesh
          key={i}
          geometry={geometry}
          material={material}
          raycast={() => {}}
        />
      ))}
    </group>
  );
}
