import { useEffect, useMemo } from "react";
import {
  BackSide,
  BoxGeometry,
  BufferGeometry,
  CanvasTexture,
  Color,
  CylinderGeometry,
  Euler,
  ExtrudeGeometry,
  Matrix4,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  Quaternion,
  RepeatWrapping,
  Shape,
  SphereGeometry,
  SRGBColorSpace,
  Vector3,
  type Material,
} from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { colors } from "../api/model";

type Vec3 = [number, number, number];
type Finish = "plaster" | "oak" | "stone" | "fabric" | "metal" | "leaf";

// All textures are generated locally and deterministically. No model or image downloads.
function texture(kind: "oak" | "fabric" | "plaster" | "sky" | "shadow") {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  let seed = 137;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  if (kind === "sky") {
    const gradient = ctx.createLinearGradient(0, 0, 0, 256);
    gradient.addColorStop(0, colors["room-sky"]);
    gradient.addColorStop(0.55, colors["room-horizon"]);
    gradient.addColorStop(1, colors["room-landscape"]);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 256, 256);
  } else if (kind === "shadow") {
    const gradient = ctx.createRadialGradient(128, 128, 12, 128, 128, 128);
    gradient.addColorStop(0, "rgba(0, 0, 0, 0.28)");
    gradient.addColorStop(0.45, "rgba(0, 0, 0, 0.14)");
    gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 256, 256);
  } else {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 5000; i++) {
      const x = random() * 256;
      const y = random() * 256;
      ctx.fillStyle = `rgba(0, 0, 0, ${random() * (kind === "oak" ? 0.045 : 0.065)})`;
      if (kind === "oak") {
        ctx.fillRect(x, y, 0.5 + random(), 8 + random() * 70);
      } else {
        ctx.fillRect(x, y, kind === "fabric" ? 0.6 : 2, 0.7);
      }
    }
    if (kind === "oak") {
      ctx.fillStyle = "rgba(0, 0, 0, 0.1)";
      for (let x = 0; x < 256; x += 64) {
        ctx.fillRect(x, 0, 0.7, 256);
        ctx.fillRect(x, (x * 1.7) % 256, 64, 0.7);
      }
    }
  }
  const map = new CanvasTexture(canvas);
  map.colorSpace = SRGBColorSpace;
  map.wrapS = map.wrapT = RepeatWrapping;
  map.anisotropy = 4;
  if (kind === "oak") map.repeat.set(3, 3);
  if (kind === "fabric") map.repeat.set(5, 5);
  return map;
}

function roundedBox(w: number, h: number, d: number, radius = 0.07) {
  const r = Math.min(radius, w / 3, h / 3, d / 3);
  const x = -w / 2 + r;
  const y = -h / 2 + r;
  const shape = new Shape();
  shape.moveTo(x, y);
  shape.lineTo(-x, y);
  shape.lineTo(-x, -y);
  shape.lineTo(x, -y);
  shape.closePath();
  const geometry = new ExtrudeGeometry(shape, {
    depth: d - 2 * r,
    bevelEnabled: true,
    bevelSize: r,
    bevelThickness: r,
    bevelSegments: 3,
    steps: 1,
  });
  geometry.translate(0, 0, -d / 2 + r);
  return geometry;
}

function buildRoom(dark: boolean) {
  const maps = {
    oak: texture("oak"),
    plaster: texture("plaster"),
    fabric: texture("fabric"),
    sky: texture("sky"),
    shadow: texture("shadow"),
  };
  const batches = new Map<Material, BufferGeometry[]>();
  const finish = Object.fromEntries(
    (["plaster", "oak", "stone", "fabric", "metal", "leaf"] as const).map(
      (name) => [
        name,
        new MeshStandardMaterial({
          color: new Color(colors[`room-${name}`]).multiplyScalar(
            dark ? 0.56 : 1,
          ),
          map:
            name === "oak" || name === "fabric" || name === "plaster"
              ? maps[name]
              : null,
          roughness: name === "metal" ? 0.55 : 0.92,
          metalness: name === "metal" ? 0.25 : 0,
        }),
      ],
    ),
  ) as Record<Finish, MeshStandardMaterial>;
  const sky = new MeshBasicMaterial({
    map: maps.sky,
    color: dark ? colors["room-night"] : "white",
    side: BackSide,
    toneMapped: false,
  });
  const landscape = new MeshStandardMaterial({
    color: new Color(colors["room-landscape"]).multiplyScalar(dark ? 0.45 : 1),
    roughness: 1,
  });
  const glow = new MeshBasicMaterial({ color: colors["room-light"] });
  const contact = new MeshBasicMaterial({
    map: maps.shadow,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  });
  const sunlight = new MeshBasicMaterial({
    color: colors["room-light"],
    transparent: true,
    opacity: dark ? 0 : 0.15,
    depthWrite: false,
  });
  function add(
    geometry: BufferGeometry,
    material: Material,
    p: Vec3,
    rotation: Vec3 = [0, 0, 0],
    scale: Vec3 = [1, 1, 1],
  ) {
    const q = new Quaternion().setFromEuler(new Euler(...rotation));
    geometry.applyMatrix4(
      new Matrix4().compose(new Vector3(...p), q, new Vector3(...scale)),
    );
    const flat = geometry.index ? geometry.toNonIndexed() : geometry;
    if (flat !== geometry) geometry.dispose();
    const batch = batches.get(material) ?? [];
    batch.push(flat);
    batches.set(material, batch);
  }
  const box = (
    p: Vec3,
    dimensions: Vec3,
    material: Finish = "plaster",
    rotation: Vec3 = [0, 0, 0],
    soft = false,
  ) =>
    add(
      soft ? roundedBox(...dimensions) : new BoxGeometry(...dimensions),
      finish[material],
      p,
      rotation,
    );
  const cylinder = (
    p: Vec3,
    top: number,
    bottom: number,
    height: number,
    material: Finish = "metal",
    rotation: Vec3 = [0, 0, 0],
  ) =>
    add(
      new CylinderGeometry(top, bottom, height, 16),
      finish[material],
      p,
      rotation,
    );
  const ellipsoid = (
    p: Vec3,
    scale: Vec3,
    material: Finish,
    rotation: Vec3 = [0, 0, 0],
  ) => add(new SphereGeometry(1, 12, 8), finish[material], p, rotation, scale);
  const shadow = (p: Vec3, w: number, d: number) =>
    add(new PlaneGeometry(w, d), contact, p, [-Math.PI / 2, 0, 0]);

  // An enclosed, metre-scaled room. Openings are real gaps between wall sections.
  box([0, -0.09, -0.8], [8.4, 0.18, 9.6], "oak");
  box([0, 3.5, -0.8], [8.5, 0.16, 9.7]);
  box([4.2, 1.75, -0.8], [0.18, 3.5, 9.6]);
  box([0, 1.75, 4], [8.4, 3.5, 0.18]);
  box([1.9, 1.75, -5.6], [4.6, 3.5, 0.18]);
  box([-2.3, 0.28, -5.6], [3.8, 0.56, 0.18]);
  box([-2.3, 3.39, -5.6], [3.8, 0.22, 0.18]);
  box([-4.2, 0.28, -0.8], [0.18, 0.56, 9.6]);
  box([-4.2, 3.39, -0.8], [0.18, 0.22, 9.6]);
  for (const z of [-5.5, -3.15, -0.8, 1.55, 3.9]) {
    box([-4.14, 1.94, z], [0.09, 2.76, 0.07], "metal");
  }
  for (const x of [-4.1, -2.3, -0.45]) {
    box([x, 1.94, -5.53], [0.07, 2.76, 0.09], "metal");
  }
  box([-4.08, 0.58, -0.8], [0.28, 0.07, 9.6], "stone");
  box([-2.3, 0.58, -5.45], [3.8, 0.07, 0.3], "stone");
  box([4.08, 1.7, -3.75], [0.12, 3.4, 3.5], "oak");
  box([0, 0.07, 3.88], [8.3, 0.14, 0.04], "oak");

  // Outdoor geometry remains behind the glazing, not an image fixed to the camera.
  add(new SphereGeometry(35, 24, 12), sky, [0, 0, 0]);
  for (let i = 0; i < 9; i++) {
    add(
      new SphereGeometry(1, 16, 8),
      landscape,
      [-15 + i * 4.1, -2.1 + (i % 3) * 0.3, -14 - (i % 2) * 4],
      [0, 0, 0],
      [6, 3.6, 5],
    );
  }
  for (let i = 0; i < 5; i++) {
    add(
      new PlaneGeometry(1.5, 4.4),
      sunlight,
      [-2.7 + i * 1.35, 0.006, -2.5 + i * 0.16],
      [-Math.PI / 2, 0, -0.55],
    );
  }

  // Low credenza, a stone top and quiet ceramic objects against the rear wall.
  box([1.5, 0.44, -5.1], [4.35, 0.67, 0.65], "oak", [0, 0, 0], true);
  box([1.5, 0.8, -5.1], [4.5, 0.07, 0.74], "stone", [0, 0, 0], true);
  for (const x of [-0.35, 1.5, 3.35])
    box([x, 0.12, -5.1], [0.08, 0.22, 0.48], "metal");
  cylinder([0.25, 1.02, -5.1], 0.08, 0.14, 0.37, "stone");
  ellipsoid([0.25, 1.2, -5.1], [0.085, 0.035, 0.085], "metal");
  box([2.8, 0.88, -5.1], [0.48, 0.08, 0.34], "fabric", [0, 0.12, 0]);
  box([2.8, 0.95, -5.1], [0.43, 0.06, 0.3], "metal", [0, -0.06, 0]);
  shadow([1.5, 0.007, -4.9], 5.1, 1.5);

  // Upholstered lounge: rounded geometry and woven texture, no outlined meshes.
  box([3.23, 0.36, -2.8], [1.25, 0.33, 2.65], "oak", [0, 0, 0], true);
  box([3.7, 0.93, -2.8], [0.24, 0.83, 2.6], "fabric", [0, 0, -0.08], true);
  for (let i = 0; i < 3; i++) {
    box(
      [3.14, 0.62, -3.61 + i * 0.8],
      [1.02, 0.28, 0.77],
      "fabric",
      [0, 0, 0],
      true,
    );
    box(
      [3.48, 0.99, -3.61 + i * 0.8],
      [0.21, 0.58, 0.75],
      "fabric",
      [0, 0, -0.16],
      true,
    );
  }
  for (const z of [-4.12, -1.48]) {
    box([3.2, 0.76, z], [1.18, 0.53, 0.17], "fabric", [0, 0, 0], true);
    box([3.2, 0.16, z + (z < -2 ? 0.15 : -0.15)], [0.9, 0.2, 0.07], "metal");
  }
  shadow([3.15, 0.008, -2.8], 2.3, 3.9);
  box([1.65, 0.014, -2.95], [3.4, 0.018, 3.3], "fabric", [0, -0.1, 0], true);
  box([1.4, 0.43, -3.5], [1.4, 0.09, 0.88], "stone", [0, -0.12, 0], true);
  cylinder([1.4, 0.23, -3.5], 0.25, 0.3, 0.4, "oak");
  shadow([1.4, 0.036, -3.5], 1.9, 1.4);
  cylinder([1.6, 0.52, -3.53], 0.1, 0.07, 0.09, "stone");

  // Side reading chair by the window.
  box([-3.2, 0.53, -0.1], [0.82, 0.16, 0.85], "fabric", [0, -0.3, 0], true);
  box(
    [-3.31, 0.96, 0.22],
    [0.82, 0.81, 0.15],
    "fabric",
    [-0.12, -0.3, 0],
    true,
  );
  for (const x of [-3.58, -2.85]) {
    box([x, 0.3, -0.1], [0.055, 0.5, 0.68], "oak");
    box([x, 0.76, -0.12], [0.065, 0.07, 0.75], "oak");
  }
  shadow([-3.2, 0.008, -0.05], 1.8, 1.8);

  // A compact shelf and books are part of the architecture, outside the dashboard arc.
  for (const y of [1.25, 2.05, 2.85]) {
    box([3.96, y, -4.3], [0.42, 0.055, 1.85], "oak");
    for (let i = 0; i < 7; i++) {
      box(
        [3.91, y + 0.17 + (i % 3) * 0.025, -4.9 + i * 0.16],
        [0.23, 0.28 + (i % 3) * 0.05, 0.06 + (i % 2) * 0.025],
        i % 3 === 0 ? "metal" : i % 3 === 1 ? "fabric" : "stone",
      );
    }
  }

  function plant(p: Vec3, size: number) {
    const [x, y, z] = p;
    cylinder(
      [x, y + 0.24 * size, z],
      0.22 * size,
      0.17 * size,
      0.47 * size,
      "stone",
    );
    cylinder(
      [x, y + 0.45 * size, z],
      0.19 * size,
      0.19 * size,
      0.025 * size,
      "metal",
    );
    cylinder(
      [x, y + 1.04 * size, z],
      0.018 * size,
      0.034 * size,
      1.25 * size,
      "oak",
    );
    for (let i = 0; i < 24; i++) {
      const angle = i * 2.39996;
      const reach = (0.18 + (i % 4) * 0.055) * size;
      const height = y + (0.86 + (i / 24) * 1.08) * size;
      const px = x + Math.cos(angle) * reach;
      const pz = z + Math.sin(angle) * reach;
      cylinder(
        [(x + px) / 2, height - 0.065 * size, (z + pz) / 2],
        0.006 * size,
        0.009 * size,
        reach,
        "oak",
        [Math.sin(angle) * 0.8, 0, -Math.cos(angle) * 0.8],
      );
      ellipsoid(
        [px, height, pz],
        [0.12 * size, 0.025 * size, 0.24 * size],
        "leaf",
        [0.25, -angle, 0.25],
      );
    }
    shadow([x, y + 0.009, z], 1.25 * size, 1.25 * size);
  }
  plant([-3.35, 0, -4.5], 1.1);
  plant([3.25, 0, 0.5], 0.85);

  // Practical light fittings; no bloom, postprocessing or realtime shadow maps.
  cylinder([2.85, 0.04, -0.5], 0.23, 0.23, 0.06, "metal");
  cylinder([2.85, 1.01, -0.5], 0.018, 0.018, 1.94, "metal");
  cylinder([2.85, 1.98, -0.5], 0.16, 0.32, 0.4, "fabric");
  add(new CylinderGeometry(0.27, 0.27, 0.012, 24), glow, [2.85, 1.78, -0.5]);
  for (const x of [-1.4, 1.4]) {
    cylinder([x, 3.38, -2.5], 0.055, 0.055, 0.03, "metal");
    add(new CylinderGeometry(0.042, 0.042, 0.008, 12), glow, [x, 3.36, -2.5]);
  }
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

/** Static geometry is batched by material. AR never mounts this opaque room. */
export function ProceduralRoom({ dark }: { dark: boolean }) {
  const room = useMemo(() => buildRoom(dark), [dark]);
  useEffect(() => () => room.dispose(), [room]);
  return (
    <group name="procedural-room" dispose={null}>
      <hemisphereLight
        args={[colors["room-horizon"], colors["room-stone"], dark ? 0.55 : 2.2]}
      />
      <directionalLight
        position={[-3, 4, -1]}
        color={colors["room-light"]}
        intensity={dark ? 0.2 : 2.6}
      />
      {dark ? (
        <pointLight
          position={[2.85, 1.9, -0.5]}
          color={colors["room-light"]}
          intensity={14}
          distance={6}
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
