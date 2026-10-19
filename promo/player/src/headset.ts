// A stylised, logo-free standalone headset of the Quest 3S class, modelled procedurally
// (promo/SCRIPT.md §7). Generic shapes only: superellipsoid front shell with a wrapped satin
// visor, foam facial interface with a nose relief, two circular lenses, a soft strap.
// Local frame: origin at the eye midpoint, −z toward the visor, +x the wearer's right. Metres.
import {
  BufferAttribute,
  BufferGeometry,
  CatmullRomCurve3,
  CircleGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshPhysicalMaterial,
  RingGeometry,
  Vector3,
  type Material,
  type Texture,
} from "three";

const CM = 0.01;
const sgnPow = (v: number, e: number) => Math.sign(v) * Math.pow(Math.abs(v), e);

type Grid = { pos: Float32Array; rows: number; cols: number };

/** Make normals point away from the geometry's centroid (flip the winding if needed). */
function orientOutward(g: BufferGeometry, centre?: Vector3) {
  g.computeVertexNormals();
  const p = g.getAttribute("position") as BufferAttribute;
  const n = g.getAttribute("normal") as BufferAttribute;
  const c = centre ?? new Vector3();
  if (!centre) {
    for (let i = 0; i < p.count; i++) c.add(new Vector3(p.getX(i), p.getY(i), p.getZ(i)));
    c.multiplyScalar(1 / p.count);
  }
  let score = 0;
  const v = new Vector3();
  for (let i = 0; i < p.count; i += 7) {
    v.set(p.getX(i), p.getY(i), p.getZ(i)).sub(c);
    score += v.x * n.getX(i) + v.y * n.getY(i) + v.z * n.getZ(i);
  }
  if (score < 0) {
    const idx = g.getIndex()!;
    const a = idx.array as Uint32Array | Uint16Array;
    for (let i = 0; i < a.length; i += 3) {
      const t = a[i + 1];
      a[i + 1] = a[i + 2];
      a[i + 2] = t;
    }
    idx.needsUpdate = true;
    g.computeVertexNormals();
  }
  return g;
}

/** Indexed grid with a wrapping column seam; rows×cols vertices. */
function gridGeometry({ pos, rows, cols }: Grid, uvs?: Float32Array) {
  const g = new BufferGeometry();
  g.setAttribute("position", new BufferAttribute(pos, 3));
  if (uvs) g.setAttribute("uv", new BufferAttribute(uvs, 2));
  const index: number[] = [];
  for (let r = 0; r < rows - 1; r++)
    for (let c = 0; c < cols; c++) {
      const c1 = (c + 1) % cols;
      const a = r * cols + c,
        b = r * cols + c1,
        d = (r + 1) * cols + c,
        e = (r + 1) * cols + c1;
      index.push(a, d, b, b, d, e);
    }
  g.setIndex(index);
  // Outward from the shell's centre (the visor offset relies on it).
  return orientOutward(g, new Vector3(0, 0, -7.6 * CM));
}

/**
 * The front shell: a superellipsoid 19 × 10 × 7.2 cm whose front face bulges 1 cm and whose
 * sides sweep back (wrap). Rows run from the front pole (η = −90°) to the back pole (η = +90°).
 * Returns the full shell and the visor (front region, proud by 0.5 mm).
 */
function shellPoint(eta: number, omega: number, out: Vector3) {
  const a = 9.5,
    b = 5.0,
    c = 3.6,
    zc = -7.6;
  const e1 = 0.58,
    e2 = 0.4;
  const ce = sgnPow(Math.cos(eta), e1);
  const x = a * ce * sgnPow(Math.cos(omega), e2);
  const y = b * ce * sgnPow(Math.sin(omega), e2);
  let z = zc + c * sgnPow(Math.sin(eta), e1);
  // Front weighting: 1 on the front face, 0 behind the equator.
  const front = Math.max(0, Math.min(1, (zc - z) / c));
  const fx = x / a,
    fy = y / b;
  // The face bulges forward at its centre and the visor wraps back at the sides.
  z -= 1.0 * front * Math.max(0, 1 - fx * fx) * Math.max(0, 1 - 0.6 * fy * fy);
  z += (0.6 + 1.6 * front) * Math.pow(Math.abs(fx), 2.6);
  out.set(x * CM, y * CM, z * CM);
  return out;
}

function shellGrid(eta0: number, eta1: number, rows: number, cols: number, offset = 0): Grid {
  const pos = new Float32Array(rows * cols * 3);
  const p = new Vector3();
  for (let r = 0; r < rows; r++) {
    // Denser rows near the rounded edges: sample η with a sine warp.
    const u = r / (rows - 1);
    const eta = eta0 + (eta1 - eta0) * u;
    for (let col = 0; col < cols; col++) {
      const omega = -Math.PI + (2 * Math.PI * col) / cols;
      shellPoint(eta, omega, p);
      pos.set([p.x, p.y, p.z], (r * cols + col) * 3);
    }
  }
  const grid = { pos, rows, cols };
  if (offset) {
    const g = gridGeometry(grid);
    const n = g.getAttribute("normal") as BufferAttribute;
    for (let i = 0; i < rows * cols; i++) {
      pos[i * 3] += n.getX(i) * offset;
      pos[i * 3 + 1] += n.getY(i) * offset;
      pos[i * 3 + 2] += n.getZ(i) * offset;
    }
    g.dispose();
  }
  return grid;
}

/** Superellipse outline (front view) of half-sizes a × b, exponent from e. */
function outline(a: number, b: number, e: number, omega: number) {
  return [a * sgnPow(Math.cos(omega), e), b * sgnPow(Math.sin(omega), e)] as const;
}

/** Foam facial interface: a soft ring from the shell's back to the face, with a nose relief. */
function foamGeometry() {
  const cols = 160,
    ring = 14;
  const pos = new Float32Array(cols * ring * 3);
  // Cross-section: a rounded rectangle 1.7 cm wide (radial) × 3.0 cm deep, sampled as a loop.
  const section: [number, number][] = [];
  for (let i = 0; i < ring; i++) {
    const a = (i / ring) * Math.PI * 2;
    const cx = sgnPow(Math.cos(a), 0.45) * 0.85; // radial half-width
    const cz = sgnPow(Math.sin(a), 0.45) * 1.5; // depth half
    section.push([cx, cz]);
  }
  for (let col = 0; col < cols; col++) {
    const omega = -Math.PI + (2 * Math.PI * col) / cols;
    const [ox, oy] = outline(8.9 - 0.85, 4.4 - 0.85, 0.34, omega);
    // 2D outward normal of the outline (finite difference).
    const [px, py] = outline(8.05, 3.55, 0.34, omega + 0.001);
    const [qx, qy] = outline(8.05, 3.55, 0.34, omega - 0.001);
    let nx = py - qy,
      ny = -(px - qx);
    const nl = Math.hypot(nx, ny) || 1;
    nx /= nl;
    ny /= nl;
    // Nose relief at the bottom centre: the ring rises and recedes toward the shell.
    const nose = oy < 0 ? Math.exp(-Math.pow(ox / 2.0, 4)) : 0;
    for (let i = 0; i < ring; i++) {
      const [sx, sz] = section[i];
      const lift = nose * 1.5;
      const x = ox + nx * sx;
      const y = oy + ny * sx + lift;
      // Depth: z −4.0 (shell) to −1.0 (face); the nose region is 1.2 cm shallower.
      let z = -2.5 + sz;
      if (sz > 0) z -= nose * 1.2 * (sz / 1.5);
      // Follow the shell's wrap so the ring meets its back edge.
      z += 0.6 * Math.pow(Math.abs(x / 9.5), 2.6);
      pos.set([x * CM, y * CM, z * CM], (col * ring + i) * 3);
    }
  }
  // Rows = columns of the outline, wrapping section index: build manually (both directions wrap).
  const g = new BufferGeometry();
  g.setAttribute("position", new BufferAttribute(pos, 3));
  const index: number[] = [];
  for (let c = 0; c < cols; c++)
    for (let i = 0; i < ring; i++) {
      const c1 = (c + 1) % cols,
        i1 = (i + 1) % ring;
      const a = c * ring + i,
        b = c * ring + i1,
        d = c1 * ring + i,
        e = c1 * ring + i1;
      index.push(a, b, d, b, e, d);
    }
  g.setIndex(index);
  g.computeVertexNormals();
  return g;
}

/** A soft band along a curve: rounded rectangular section, width along the head surface. */
function strapGeometry() {
  const pts = [
    [9.4, 0.3, -6.6],
    [10.1, -0.8, -1.4],
    [9.6, -2.5, 3.0],
    [7.8, -4.7, 7.2],
    [4.8, -6.6, 10.0],
    [0, -7.4, 11.3],
    [-4.8, -6.6, 10.0],
    [-7.8, -4.7, 7.2],
    [-9.6, -2.5, 3.0],
    [-10.1, -0.8, -1.4],
    [-9.4, 0.3, -6.6],
  ].map(([x, y, z]) => new Vector3(x, y, z));
  const curve = new CatmullRomCurve3(pts, false, "centripetal");
  const steps = 220,
    sec = 12;
  const centre = new Vector3(0, -3.5, 6.5);
  const pos = new Float32Array((steps + 1) * sec * 3);
  const T = new Vector3(),
    N = new Vector3(),
    W = new Vector3(),
    P = new Vector3(),
    tmp = new Vector3();
  for (let s = 0; s <= steps; s++) {
    const u = s / steps;
    curve.getPointAt(u, P);
    curve.getTangentAt(u, T);
    N.copy(P).sub(centre);
    N.addScaledVector(T, -N.dot(T)).normalize();
    W.crossVectors(T, N).normalize();
    // Wider back pad around the middle of the loop.
    const pad = Math.exp(-Math.pow((u - 0.5) / 0.09, 2));
    const halfW = 1.0 + 0.8 * pad;
    const halfT = 0.18 + 0.18 * pad;
    for (let i = 0; i < sec; i++) {
      const a = (i / sec) * Math.PI * 2;
      const cw = sgnPow(Math.cos(a), 0.3) * halfW;
      const ct = sgnPow(Math.sin(a), 0.3) * halfT;
      tmp.copy(P).addScaledVector(W, cw).addScaledVector(N, ct);
      pos.set([tmp.x * CM, tmp.y * CM, tmp.z * CM], (s * sec + i) * 3);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute("position", new BufferAttribute(pos, 3));
  const index: number[] = [];
  for (let s = 0; s < steps; s++)
    for (let i = 0; i < sec; i++) {
      const i1 = (i + 1) % sec;
      const a = s * sec + i,
        b = s * sec + i1,
        d = (s + 1) * sec + i,
        e = (s + 1) * sec + i1;
      index.push(a, d, b, b, d, e);
    }
  g.setIndex(index);
  g.computeVertexNormals();
  return g;
}

export type Headset = {
  group: Group;
  /** Every mesh except the lens glass. */
  body: Mesh[];
  /** The two lens glass discs (portal surfaces). */
  glass: Mesh[];
  materials: Record<string, MeshPhysicalMaterial>;
  setEnvMap(texture: Texture | null): void;
};

export function createHeadset(tokens: Record<string, string>): Headset {
  const group = new Group();
  group.name = "headset";
  const c = (k: string) => new Color(tokens[k] ?? k);
  const materials = {
    shell: new MeshPhysicalMaterial({ color: new Color("#2c2d33"), roughness: 0.5, metalness: 0, clearcoat: 0.2, clearcoatRoughness: 0.45, envMapIntensity: 0.9 }),
    visor: new MeshPhysicalMaterial({ color: c("background"), roughness: 0.24, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.13, ior: 1.5, envMapIntensity: 2.1 }),
    seam: new MeshPhysicalMaterial({ color: c("space-night"), roughness: 0.6, metalness: 0 }),
    foam: new MeshPhysicalMaterial({ color: c("elevated"), roughness: 0.95, metalness: 0, sheen: 0.4, sheenRoughness: 0.7, sheenColor: new Color("#3a4252"), envMapIntensity: 0.4 }),
    bezel: new MeshPhysicalMaterial({ color: c("space-night"), roughness: 0.45, metalness: 0.1, envMapIntensity: 0.6 }),
    strap: new MeshPhysicalMaterial({ color: c("background"), roughness: 0.92, metalness: 0, sheen: 0.3, sheenRoughness: 0.85, sheenColor: new Color("#2a3140"), envMapIntensity: 0.25 }),
  };

  // Shell (seam colour on the front region, graphite elsewhere).
  const rows = 120,
    cols = 192;
  const etaVisor = (-27 * Math.PI) / 180;
  const etaSeam = (-24.5 * Math.PI) / 180;
  const front = new Mesh(gridGeometry(shellGrid(-Math.PI / 2 + 1e-4, etaSeam, 70, cols)), materials.seam);
  const back = new Mesh(gridGeometry(shellGrid(etaSeam, Math.PI / 2 - 1e-4, rows - 70, cols)), materials.shell);
  const visor = new Mesh(gridGeometry(shellGrid(-Math.PI / 2 + 1e-4, etaVisor, 80, cols, 0.0005)), materials.visor);
  // The visor's rim rolls under its edge so the seam reads as a fine dark line.
  const foam = new Mesh(foamGeometry(), materials.foam);
  const strap = new Mesh(strapGeometry(), materials.strap);

  // Lenses: barrel and bezel lip; the glass sits 1 mm behind the lip.
  const body: Mesh[] = [front, back, visor, foam, strap];
  const glass: Mesh[] = [];
  for (const side of [-1, 1]) {
    const x = side * 0.0315;
    const barrel = new Mesh(new CylinderGeometry(0.029, 0.029, 0.025, 64, 1, true), materials.bezel);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(x, 0, -0.0275);
    const lip = new Mesh(new RingGeometry(0.024, 0.029, 64, 1), materials.bezel);
    lip.position.set(x, 0, -0.015);
    const inner = new Mesh(new CylinderGeometry(0.024, 0.024, 0.004, 64, 1, true), materials.bezel);
    inner.rotation.x = Math.PI / 2;
    inner.position.set(x, 0, -0.017);
    const disc = new Mesh(new CircleGeometry(0.024, 96), undefined as unknown as Material);
    disc.position.set(x, 0, -0.016);
    disc.name = side < 0 ? "lens-left" : "lens-right";
    body.push(barrel, lip, inner);
    glass.push(disc);
  }
  for (const m of [...body, ...glass]) group.add(m);
  for (const m of body) {
    (m.material as Material).side = DoubleSide;
    m.renderOrder = 0;
  }
  // The glass draws after the body so the body's depth occludes it in the portal pass.
  for (const g of glass) g.renderOrder = 1;
  return {
    group,
    body,
    glass,
    materials,
    setEnvMap(texture) {
      for (const m of Object.values(materials)) {
        const recompile = !m.envMap !== !texture;
        m.envMap = texture;
        if (recompile) m.needsUpdate = true;
      }
    },
  };
}
