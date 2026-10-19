// Camera, headset, head and hand paths for the 3D shots (promo/SCRIPT.md §4, §8.2).
import { Euler, Matrix4, Quaternion, Vector3 } from "three";
import { DEG, E_arrive, E_calm, MJ, keyed, lerp, monotoneCubic, seg, vCameraAt } from "../../timeline.mjs";

export const P = new Vector3(0, 1.6, -3.08); // the DOM pane centre (1 CSS px = 1 mm)
export const H = new Vector3(0, 1.6, 0); // headset = viewer's eye midpoint
const NECK = new Vector3(0, 1.525, 0.095);
/** Head pitch in the headset: a little up, so the session pills sit low in frame (they are real UI, not the hero). */
export const HEAD_PITCH = 1.5;
const EYE = new Vector3(-0.0315, 0.075, -0.095);
// Long lens everywhere outside the headset: a wide angle stretches the planet into an egg near the
// frame edges. The DOM pane is a flat plane seen head-on, so any lens reproduces V exactly.
export const PANE_FOV = 30;
const PANE_D = 1.08 / (2 * Math.tan((PANE_FOV / 2) * DEG)); // 2.0153 m: pane fills the frame

export type Pose = { pos: Vector3; quat: Quaternion; fov: number };

const up = new Vector3(0, 1, 0);
const m4 = new Matrix4();
export function lookQuat(pos: Vector3, target: Vector3, out = new Quaternion()) {
  m4.lookAt(pos, target, up);
  return out.setFromRotationMatrix(m4);
}
export function eulerQuat(psiDeg: number, thetaDeg: number, out = new Quaternion()) {
  return out.setFromEuler(new Euler(thetaDeg * DEG, psiDeg * DEG, 0, "YXZ"));
}

/** The DOM virtual camera V = (s, cx, cy) as a camera looking at the pane head-on. */
export function vPose(v: number[]): Pose {
  const [s, cx, cy] = v;
  return {
    pos: new Vector3(P.x + (cx - 960) / 1000, P.y + (540 - cy) / 1000, P.z + PANE_D / s),
    quat: new Quaternion(),
    fov: PANE_FOV,
  };
}
export const domPose = (t: number) => vPose(vCameraAt(t));

/** S01: the app's backdrop camera, lifting from the night side to the limb. */
export function s01Pose(t: number, clockAt: (t: number) => number): Pose {
  const pos = new Vector3(0, 1.6, 0.7);
  const xOrb = 0.09 * Math.sin(clockAt(t) * 0.157);
  const to = new Vector3(xOrb, 2.45, -9);
  const from = new Vector3(0, 0.95, -9);
  const target = t >= 120 ? to : from.clone().lerp(to, E_calm(seg(t, 0, 120)));
  return { pos, quat: lookQuat(pos, target), fov: 68 };
}

/** Neck model: head yaw ψ (+ left) and pitch θ, left eye. */
export function eyePose(psi: number, theta: number, fov = 52): Pose {
  const q = eulerQuat(psi, theta);
  const pos = EYE.clone().applyQuaternion(q).add(NECK);
  return { pos, quat: q, fov };
}

/* ------------------------------------------------------------ S08 - S10 ---- */
const A1 = new Vector3(0, 1.62, 0.52);
function slerpDir(a: Vector3, b: Vector3, u: number) {
  const qa = new Quaternion().setFromUnitVectors(new Vector3(0, 0, -1), a.clone().normalize());
  const qb = new Quaternion().setFromUnitVectors(new Vector3(0, 0, -1), b.clone().normalize());
  return new Vector3(0, 0, -1).applyQuaternion(qa.slerp(qb, u));
}
// Eye offset of the neck model at the landing pitch (ψ 0, θ HEAD_PITCH).
const EYE_LAND = EYE.clone().applyQuaternion(eulerQuat(0, HEAD_PITCH)).add(NECK);
const EYE_Y_AT_PITCH = EYE_LAND.y - 1.6;
const S10 = {
  f: [690, 726, 738, 749, 756],
  x: [0, -0.0315, -0.0315, -0.0315, -0.0315],
  y: [1.615, 1.6, 1.6, 1.6, 1.6 + EYE_Y_AT_PITCH],
  z: [0.5, 0.075, 0.05, 0.004, EYE_LAND.z],
  fov: [34, 40, 44, 51.5, 52],
};
const s10x = keyed(S10.f.map((f, i) => [f, S10.x[i]]));
const s10y = keyed(S10.f.map((f, i) => [f, S10.y[i]]));
const s10z = monotoneCubic(S10.f, S10.z, 0, 0);
const s10fov = monotoneCubic(S10.f, S10.fov, 0, 0);
const S17 = {
  f: [1170, 1180, 1194, 1218, 1320],
  x: [-0.0315, -0.0315, -0.0315, 0, 0],
  // The end card on a long lens (30°), pulled back to keep the headset's size.
  y: [1.6 + EYE_Y_AT_PITCH, 1.601, 1.605, 1.75, 1.748],
  z: [EYE_LAND.z, 0.012, 0.065, 0.83, 0.81],
  fov: [52, 49, 44, 30, 30],
};
const s17x = keyed(S17.f.map((f, i) => [f, S17.x[i]]));
const s17y = keyed(S17.f.map((f, i) => [f, S17.y[i]]));
const s17z = monotoneCubic(S17.f, S17.z, 0, 0);
const s17fov = monotoneCubic(S17.f, S17.fov, 0, 0);
const END_TARGET = new Vector3(0, 1.7, -2.0);

/** Camera A for the headset world, f540-756 and f1170-1320. a0: V(539) as a pose. */
export function cameraA(t: number, a0: Pose): Pose {
  if (t < 690) {
    const u = E_calm(seg(t, 540, 612));
    const pos = a0.pos.clone().lerp(A1, u);
    pos.add(new Vector3(0, -0.005, -0.02).multiplyScalar(E_calm(seg(t, 600, 690))));
    const dP = P.clone().sub(pos).normalize();
    const dH = H.clone().sub(pos).normalize();
    let d = slerpDir(new Vector3(0, 0, -1), dP, u);
    d = slerpDir(d, dH, E_calm(seg(t, 600, 660)));
    return { pos, quat: lookQuat(pos, pos.clone().add(d)), fov: lerp(PANE_FOV, 34, u) };
  }
  if (t <= 756) {
    const pos = new Vector3(s10x(t), s10y(t), s10z(t));
    const q0 = lookQuat(new Vector3(0, 1.615, 0.5), H);
    const qB = eulerQuat(0, HEAD_PITCH);
    const quat = q0.clone().slerp(qB, E_calm(seg(t, 690, 726)));
    return { pos, quat, fov: s10fov(t) };
  }
  // S17
  const pos = new Vector3(s17x(t), s17y(t), s17z(t));
  const keysQ = [
    eulerQuat(0, HEAD_PITCH),
    eulerQuat(0, HEAD_PITCH),
    eulerQuat(0, HEAD_PITCH),
    lookQuat(new Vector3(0, 1.75, 0.83), END_TARGET),
    lookQuat(new Vector3(0, 1.748, 0.81), END_TARGET),
  ];
  let quat = keysQ[keysQ.length - 1].clone();
  for (let i = 0; i < S17.f.length - 1; i++) {
    if (t <= S17.f[i + 1]) {
      quat = keysQ[i].clone().slerp(keysQ[i + 1], E_calm(seg(t, S17.f[i], S17.f[i + 1])));
      break;
    }
  }
  return { pos, quat, fov: s17fov(t) };
}

/* ------------------------------------------------------------ head path ---- */
export function headAt(t: number) {
  let psi = 0,
    theta = -2;
  if (t < 810) psi = 0.8 * E_calm(seg(t, 756, 810));
  else if (t < 858) psi = lerp(0.8, 40, MJ(seg(t, 810, 858)));
  else if (t < 873) psi = lerp(40, 40.5, E_calm(seg(t, 858, 873)));
  else if (t < 951) psi = lerp(40.5, -40, MJ(seg(t, 873, 951)));
  else if (t < 1006) psi = lerp(-40, -40.6, E_calm(seg(t, 951, 1006)));
  else if (t < 1122) psi = -40.6;
  else if (t < 1164) psi = lerp(-40.6, 0, MJ(seg(t, 1122, 1164)));
  else psi = 0;
  // The head lifts to take in the stands (the session pills sit low in frame), settles as the focus
  // panel opens (the pills are gone then), looks down at the focus controls, lands level for the pull-out.
  const LIFT = HEAD_PITCH;
  theta = LIFT;
  if (t >= 1006 && t < 1034) theta = lerp(LIFT, -2, E_calm(seg(t, 1006, 1034)));
  else if (t >= 1034 && t < 1086) theta = -2;
  else if (t >= 1086 && t < 1122) theta = lerp(-2, -5, E_calm(seg(t, 1086, 1104)));
  else if (t >= 1122 && t < 1164) theta = lerp(-5, LIFT, MJ(seg(t, 1122, 1164)));
  return { psi, theta };
}

/** The film camera for 3D frames (≥ 540). */
export function filmCameraXR(t: number, a0: Pose): Pose {
  if (t < 756 || t >= 1170) return cameraA(t, a0);
  const h = headAt(t);
  return eyePose(h.psi, h.theta);
}

/* --------------------------------------------------------------- headset ---- */
const H0 = new Vector3(0.48, 1.68, -0.12),
  C1 = new Vector3(0.36, 1.665, -0.09),
  C2 = new Vector3(0.1, 1.615, -0.02);
function bezier3(a: Vector3, b: Vector3, c: Vector3, d: Vector3, u: number) {
  const v = 1 - u;
  return a
    .clone()
    .multiplyScalar(v * v * v)
    .addScaledVector(b, 3 * v * v * u)
    .addScaledVector(c, 3 * v * u * u)
    .addScaledVector(d, u * u * u);
}
export function headsetAt(t: number) {
  let pos: Vector3, yaw: number, roll: number, pitch: number;
  if (t <= 684) {
    const ua = E_arrive(seg(t, 600, 684));
    pos = bezier3(H0, C1, C2, H, ua);
    yaw = lerp(145, 70, E_calm(seg(t, 600, 684)));
    roll = lerp(5, 0, ua);
    pitch = lerp(-6, 0, ua);
  } else {
    pos = H.clone();
    yaw = lerp(70, 0, E_calm(seg(t, 684, 720)));
    roll = 0;
    pitch = 0;
  }
  if (t >= 1170) yaw = 0;
  const quat = new Quaternion().setFromEuler(new Euler(pitch * DEG, yaw * DEG, roll * DEG, "YXZ"));
  return { pos, quat };
}

/* ------------------------------------------------------------ hand & aim ---- */
const HAND_KEYS: [number, number[]][] = [
  [951, [0.32, 1.12, -0.1]],
  [972, [0.331, 1.22, -0.114]],
  [1006, [0.331, 1.22, -0.114]],
  [1008, [0.331, 1.22, -0.114]],
  [1026, [0.3, 1.02, -0.1]],
  [1086, [0.3, 1.02, -0.1]],
  [1104, [0.3, 1.1, -0.12]],
  [1118, [0.3, 1.1, -0.12]],
  [1134, [0.26, 1.02, -0.18]],
];
export function handAt(t: number) {
  const k = HAND_KEYS;
  if (t <= k[0][0]) return new Vector3(...k[0][1]);
  for (let i = 0; i < k.length - 1; i++) {
    if (t <= k[i + 1][0]) {
      const u = MJ(seg(t, k[i][0], k[i + 1][0]));
      return new Vector3(...k[i][1]).lerp(new Vector3(...k[i + 1][1]), u);
    }
  }
  return new Vector3(...k[k.length - 1][1]);
}

/**
 * The aim point the ray passes through, in a named space:
 * "equipment" = equipment-stand local, "focus" = focus-group local, "world".
 */
export function aimAt(t: number): { space: "equipment" | "focus" | "world" | "none"; p: Vector3 } {
  if (t < 951) return { space: "none", p: new Vector3() };
  if (t < 1006) {
    const u = MJ(seg(t, 951, 972));
    return { space: "equipment", p: new Vector3(0.3, -0.5, -0.025).lerp(new Vector3(0.131, -0.263, 0), u) };
  }
  if (t < 1086) {
    // After the select the ray slides straight down off the new panel (past the disabled
    // "next" control) and stays below it, where nothing is hit.
    const u = MJ(seg(t, 1006, 1018));
    const x = t < 1030 ? 0.142 : lerp(0.142, -0.3, MJ(seg(t, 1030, 1060)));
    return { space: "focus", p: new Vector3(x, lerp(-0.286, -0.95, u), 0) };
  }
  if (t < 1116) {
    const u = MJ(seg(t, 1086, 1104));
    return { space: "focus", p: new Vector3(lerp(-0.3, -0.26, u), lerp(-0.95, -0.6788, u), 0) };
  }
  return { space: "world", p: new Vector3(0.8184, lerp(0.9178, 0.4, MJ(seg(t, 1116, 1124))), -1.3078) };
}
/** Mouse buttons for the in-headset select: [frame, "down" | "up"]. */
export const XR_PRESSES: [number, "down" | "up"][] = [
  [1002, "down"],
  [1006, "up"],
  [1112, "down"],
  [1116, "up"],
];
export const pressedAt = (t: number) => (t >= 1002 && t < 1006) || (t >= 1112 && t < 1116);
