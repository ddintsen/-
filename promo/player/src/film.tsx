// The film player: one R3F root (frameloop "never") stepped by a fixed clock, rendering every
// shot of promo/SCRIPT.md through the pipeline, with the HTML overlay on top. Driven from
// render/frames.mjs through window.film.
import { Suspense, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { Canvas, advance, useFrame, useThree } from "@react-three/fiber";
import {
  BoxGeometry,
  Color,
  DoubleSide,
  MeshBasicMaterial,
  CubeCamera,
  DirectionalLight,
  Group,
  HalfFloatType,
  HemisphereLight,
  LinearMipmapLinearFilter,
  LinearFilter,
  Mesh,
  MeshDepthMaterial,
  NoBlending,
  NoColorSpace,
  Object3D,
  PerspectiveCamera,
  PlaneGeometry,
  PMREMGenerator,
  Quaternion,
  Raycaster,
  RectAreaLight,
  ShaderMaterial,
  Texture,
  Vector2,
  Vector3,
  WebGLCubeRenderTarget,
  type Intersection,
  type Scene,
  type WebGLRenderer,
} from "three";
import { RectAreaLightUniformsLib } from "three/examples/jsm/lights/RectAreaLightUniformsLib.js";
import { SpaceEnvironment } from "../../../src/spatial/SpaceEnvironment";
import { spatialStands } from "../../../src/spatial/layout";
import { colors } from "../../../src/api/model";
import { useDashboardStore } from "../../../src/store/dashboard";
// The app's own XR pointer visuals (@pmndrs/xr, installed with @react-three/xr).
import { PointerRayMaterial, updatePointerRayModel } from "../../../node_modules/@pmndrs/xr/dist/pointer/ray.js";
import { PointerCursorMaterial, updatePointerCursorModel } from "../../../node_modules/@pmndrs/xr/dist/pointer/cursor.js";
import * as TL from "../../timeline.mjs";
import { DEG, E_calm, clamp01, lerp, seg, shutterOffsets, smoothstep } from "../../timeline.mjs";
import { LayerB, layerState } from "./layerB";
import { Pipeline, displayTarget } from "./pipeline";
import { createHeadset, type Headset } from "./headset";
import { Overlay } from "./overlay";
import { createCursor } from "./cursor";
import * as PATH from "./paths";

const W = 3840,
  H4 = 2160;
const T0 = 2.0; // seconds of pre-roll before film frame 0
const EARTH_SPIN = 0.0105;
const CLOUD_SPIN = 0.016;
const SUN_DARK = new Vector3(-330, -30, -830);
// The app's SPATIAL_RAY options (src/spatial/SpatialView.tsx).
const RAY = { maxLength: 3, opacity: 0.5 };
const CURSOR = { opacity: 0.85, size: 0.05 };

type CaptureFrame = {
  subs: { t: number; scroll: number; cursor: { x: number; y: number; opacity: number; scale: number; hand: boolean }; ms: number }[];
  env: { clock: number; camera: { p: number[]; q: number[]; fov: number } } | null;
  spatialModal?: { x: number; y: number; w: number; h: number; radius: number };
};
type Capture = {
  locale: "uk" | "en";
  measure: { wordmark: ConstructorParameters<typeof Overlay>[1] };
  frames: Record<string, CaptureFrame>;
};

const ctx = {
  locale: "uk" as "uk" | "en",
  capture: null as unknown as Capture,
  gl: null as unknown as WebGLRenderer,
  scene: null as unknown as Scene,
  camera: null as unknown as PerspectiveCamera,
  pipe: null as unknown as Pipeline,
  overlay: null as unknown as Overlay,
  desktopEnv: null as Group | null,
  xrEnv: null as Group | null,
  stands: null as Group | null,
  pane: new Group(),
  paneMesh: null as unknown as Mesh,
  paneMat: null as unknown as ShaderMaterial,
  cursorMesh: null as unknown as Mesh,
  cursorMat: null as unknown as ShaderMaterial,
  cursorTex: null as unknown as { arrow: Texture; hand: Texture; arrowSize: number[]; handSize: number[]; arrowHot: number[]; handHot: number[] },
  headsetRoot: new Group(),
  headset: null as unknown as Headset,
  glassPortal: null as unknown as ShaderMaterial,
  glassHole: null as unknown as ShaderMaterial,
  depthOnly: null as unknown as MeshDepthMaterial,
  cube: null as unknown as CubeCamera,
  cubeRT: null as unknown as WebGLCubeRenderTarget,
  reflectionRig: null as unknown as Group,
  pmrem: null as PMREMGenerator | null,
  envRT: null as import("three").WebGLRenderTarget | null,
  displayRTs: [] as import("three").WebGLRenderTarget[],
  displayCam: null as unknown as PerspectiveCamera,
  glassPortals: [] as ShaderMaterial[],
  ray: { group: new Group(), mesh: null as unknown as Mesh, mat: null as unknown as PointerRayMaterial, cursor: null as unknown as Mesh, cursorMat: null as unknown as PointerCursorMaterial },
  a0: null as unknown as PATH.Pose,
  sample: null as null | { k: number; t: number; i: number; n: number; weight: number },
  setFocused: null as null | ((v: number | null) => void),
  textures: new Map<string, Promise<Texture>>(),
  loaded: new Map<string, Texture>(),
  clockNow: 0,
  stats: { samples: 0 },
};

/* ------------------------------------------------------------- textures ---- */
function domUrl(k: number, i: number) {
  return `/cache/${ctx.locale}/dom/f${String(k).padStart(5, "0")}_s${i}.png`;
}
function loadDom(k: number, i: number): Promise<Texture> {
  const key = `${k}_${i}`;
  let p = ctx.textures.get(key);
  if (!p) {
    p = fetch(domUrl(k, i))
      .then((r) => {
        if (!r.ok) throw new Error(`missing ${domUrl(k, i)}`);
        return r.blob();
      })
      .then((b) => createImageBitmap(b, { colorSpaceConversion: "none", premultiplyAlpha: "none" }))
      .then((bmp) => {
        const tex = new Texture(bmp as unknown as HTMLImageElement);
        tex.colorSpace = NoColorSpace;
        tex.flipY = false;
        tex.generateMipmaps = true;
        tex.minFilter = LinearMipmapLinearFilter;
        tex.magFilter = LinearFilter;
        tex.anisotropy = 16;
        tex.needsUpdate = true;
        ctx.loaded.set(key, tex);
        return tex;
      });
    ctx.textures.set(key, p);
  }
  return p;
}
function domSubs(k: number) {
  return ctx.capture.frames[String(k)]?.subs.length ?? 0;
}
function releaseDom(before: number, keep: Set<string>) {
  for (const [key, tex] of ctx.loaded) {
    const k = Number(key.split("_")[0]);
    if (k < before && !keep.has(key)) {
      tex.dispose();
      (tex.image as ImageBitmap | undefined)?.close?.();
      ctx.loaded.delete(key);
      ctx.textures.delete(key);
    }
  }
}

/* ----------------------------------------------------------------- pane ---- */
function buildPane() {
  const mat = new ShaderMaterial({
    uniforms: {
      mapA: { value: null },
      mapB: { value: null },
      mixB: { value: 0 },
      opacity: { value: 1 },
      outside: { value: 1 },
      rect: { value: [0, 0, 1920, 1080] },
      radius: { value: 0 },
    },
    vertexShader: /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D mapA; uniform sampler2D mapB; uniform float mixB; uniform float opacity;
      uniform float outside; uniform vec4 rect; uniform float radius; varying vec2 vUv;
      float sdRound(vec2 p, vec2 b, float r) { vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
      void main() {
        vec2 uv = vec2(vUv.x, 1.0 - vUv.y);
        vec3 a = texture2D(mapA, uv).rgb;
        vec3 c = mixB > 0.0 ? mix(a, texture2D(mapB, uv).rgb, mixB) : a;
        vec2 px = uv * vec2(1920.0, 1080.0);
        float d = sdRound(px - (rect.xy + rect.zw * 0.5), rect.zw * 0.5, radius);
        float aa = fwidth(d);
        float inside = 1.0 - smoothstep(-aa, aa, d);
        float alpha = opacity * mix(outside, 1.0, inside);
        gl_FragColor = vec4(c, alpha);
      }`,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
  mat.extensions = { derivatives: true } as never;
  const mesh = new Mesh(new PlaneGeometry(1.92, 1.08), mat);
  mesh.position.copy(PATH.P);
  mesh.renderOrder = 1;
  mesh.frustumCulled = false;
  ctx.pane.add(mesh);
  ctx.paneMesh = mesh;
  ctx.paneMat = mat;
  // The cursor lives in DOM space on the pane, so it zooms with the virtual camera.
  const c = createCursor();
  ctx.cursorTex = c;
  const cmat = new ShaderMaterial({
    uniforms: { map: { value: c.arrow }, opacity: { value: 0 } },
    vertexShader: /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `uniform sampler2D map; uniform float opacity; varying vec2 vUv;
      void main() { vec4 c = texture2D(map, vUv); gl_FragColor = vec4(c.rgb, c.a * opacity); }`,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
  const cg = new PlaneGeometry(1, 1);
  cg.translate(0.5, -0.5, 0); // anchor at the top-left; the hotspot offset is applied per frame
  const cmesh = new Mesh(cg, cmat);
  cmesh.renderOrder = 2;
  cmesh.frustumCulled = false;
  ctx.pane.add(cmesh);
  ctx.cursorMesh = cmesh;
  ctx.cursorMat = cmat;
}
function placeCursor(cur: { x: number; y: number; opacity: number; scale: number; hand: boolean } | null) {
  const m = ctx.cursorMesh;
  if (!cur || cur.opacity <= 0) {
    ctx.cursorMat.uniforms.opacity.value = 0;
    m.visible = false;
    return;
  }
  m.visible = true;
  const c = ctx.cursorTex;
  const size = cur.hand ? c.handSize : c.arrowSize;
  const hot = cur.hand ? c.handHot : c.arrowHot;
  ctx.cursorMat.uniforms.map.value = cur.hand ? c.hand : c.arrow;
  ctx.cursorMat.uniforms.opacity.value = cur.opacity;
  const s = cur.scale;
  // DOM px -> pane metres (1 px = 1 mm), the hotspot stays put while pressed.
  const x = PATH.P.x - 0.96 + (cur.x - hot[0] * s) / 1000;
  const y = PATH.P.y + 0.54 - (cur.y - hot[1] * s) / 1000;
  m.position.set(x, y, PATH.P.z + 0.0005);
  m.scale.set((size[0] * s) / 1000, (size[1] * s) / 1000, 1);
  m.updateMatrixWorld();
}

/* -------------------------------------------------------------- headset ---- */
function buildHeadset() {
  RectAreaLightUniformsLib.init();
  const hs = createHeadset(colors as unknown as Record<string, string>);
  ctx.headset = hs;
  ctx.headsetRoot.add(hs.group);
  // Lights for the headset only: the sun ahead-left, blue bounce from the night Earth, and the
  // floating window behind it.
  const sun = new DirectionalLight(new Color(colors["space-sun"]), 4.2);
  const sunDir = SUN_DARK.clone().normalize();
  sun.position.copy(PATH.H).addScaledVector(sunDir, 10);
  sun.target.position.copy(PATH.H);
  // Blue bounce from the night Earth below, a soft cool key from the camera side (the product
  // light every hardware reveal has), and the floating window rim-lighting it from behind.
  const hemi = new HemisphereLight(new Color(colors["space-night"]), new Color(colors["space-blue"]), 1.4);
  const rect = new RectAreaLight(new Color(colors.muted), 2.0, 1.28, 0.948);
  rect.position.set(0, 1.6, -3.08);
  rect.lookAt(0, 1.6, 0);
  const key = new RectAreaLight(new Color(colors.text), 6.0, 0.9, 0.6);
  key.position.copy(PATH.H).add(new Vector3(0.55, 0.42, 0.78));
  key.lookAt(PATH.H);
  // A cool rim from behind on the far side (the atmosphere's glow) separates the silhouette
  // from the dark Earth.
  const rim = new DirectionalLight(new Color(colors["space-atmosphere"]), 3.2);
  rim.position.copy(PATH.H).add(new Vector3(0.9, 0.35, -0.9));
  rim.target.position.copy(PATH.H);
  ctx.headsetRoot.add(sun, sun.target, hemi, rect, key, rim, rim.target);
  ctx.headsetRoot.userData.rect = rect;
  // Reflection rig: soft emissive panels seen only by the visor's cube camera, so the satin
  // visor reads as glass with a clean highlight band instead of a black hole.
  const rig = new Group();
  const panel = (w: number, h: number, c: string, k: number, at: Vector3) => {
    const m = new Mesh(new PlaneGeometry(w, h), new MeshBasicMaterial({ color: new Color(c).multiplyScalar(k), toneMapped: false, side: DoubleSide }));
    m.position.copy(at);
    m.lookAt(0, 0, 0);
    rig.add(m);
  };
  panel(2.4, 0.9, colors.muted, 1.1, new Vector3(0.35, 1.1, 0.9));
  panel(0.22, 1.8, colors.text, 1.6, new Vector3(1.1, 0.15, 0.55));
  panel(1.6, 0.25, colors["space-atmosphere"], 0.5, new Vector3(-0.2, -0.9, -0.6));
  // The sunrise as an area: a warm corona and a hot core in the sun's direction, so the
  // satin visor catches a broad warm sweep as it turns (the sun sprites alone are tiny).
  const sd = SUN_DARK.clone().normalize();
  panel(1.9, 0.5, colors["space-sun"], 0.55, sd.clone().multiplyScalar(1.6).add(new Vector3(0, 0.12, 0)));
  panel(0.36, 0.16, colors["space-sun-core"], 3.0, sd.clone().multiplyScalar(1.5).add(new Vector3(0, 0.06, 0)));
  panel(3.2, 1.4, colors["space-blue"], 0.9, new Vector3(-0.4, -1.2, -1.0));
  // The sunrise glow spreading along the horizon to the left: the visor's warm sweep as it turns.
  panel(1.4, 0.55, colors["space-sun"], 0.75, new Vector3(-1.45, 0.1, -0.55));
  panel(1.1, 0.35, colors["space-sun-core"], 0.5, new Vector3(-1.5, 0.12, 0.05));
  // The limb as a thin bright band on the horizon, warm toward the sun, blue elsewhere: the
  // satin visor carries it as a horizon line, like a helmet visor over the Earth.
  for (let a = -110; a <= 110; a += 10) {
    const az = (a * Math.PI) / 180;
    const dir = new Vector3(-Math.sin(az), -0.07, -Math.cos(az)).normalize();
    const sunAz = Math.atan2(-sd.x, -sd.z);
    const warm = Math.exp(-Math.pow((az - sunAz) / 0.9, 2));
    const col = new Color(colors["space-atmosphere"]).lerp(new Color(colors["space-sun"]), warm);
    const m = new Mesh(new PlaneGeometry(0.29, 0.05), new MeshBasicMaterial({ color: col.multiplyScalar(0.7 + 1.6 * warm), toneMapped: false, side: DoubleSide }));
    m.position.copy(dir.multiplyScalar(1.6));
    m.lookAt(0, 0, 0);
    rig.add(m);
  }
  rig.visible = false;
  ctx.reflectionRig = rig;
  ctx.headsetRoot.add(rig);
  // Lens glass: a see-through portal into layer B rendered from the same camera.
  ctx.glassPortal = new ShaderMaterial({
    uniforms: {
      portal: { value: null },
      res: { value: new Vector2(W, H4) },
      fx: { value: 1 },
      display: { value: null },
      displayMix: { value: 0 },
    },
    vertexShader: /* glsl */ `varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main() { vUv = uv; vec4 wp = modelMatrix * vec4(position, 1.0);
        vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - wp.xyz);
        gl_Position = projectionMatrix * viewMatrix * wp; }`,
    fragmentShader: /* glsl */ `uniform sampler2D portal; uniform vec2 res; uniform float fx;
      uniform sampler2D display; uniform float displayMix;
      varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main() {
        vec3 c = texture2D(portal, gl_FragCoord.xy / res).rgb;
        // Seen from a distance, a lens shows its display: the wearer's view, magnified.
        if (displayMix > 0.0) c = mix(c, texture2D(display, vUv).rgb, displayMix);
        float r = length(vUv - 0.5) * 2.0;
        float shade = 0.97 * (1.0 - 0.25 * smoothstep(0.7, 1.0, r));
        float f = 0.02 + 0.98 * pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 5.0);
        vec3 lens = c * shade + vec3(0.075, 0.105, 0.16) * f * 0.6;
        gl_FragColor = vec4(mix(c, lens, fx), 1.0);
      }`,
    toneMapped: false,
    depthWrite: true,
    blending: NoBlending,
  });
  ctx.glassHole = new ShaderMaterial({
    vertexShader: /* glsl */ `void main() { gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `void main() { gl_FragColor = vec4(0.0); }`,
    blending: NoBlending,
    depthWrite: true,
    toneMapped: false,
  });
  ctx.displayRTs = [displayTarget(2048, 2048), displayTarget(2048, 2048)];
  ctx.displayCam = new PerspectiveCamera(95, 1, 0.05, 1000);
  ctx.glassPortals = [ctx.glassPortal, ctx.glassPortal.clone()];
  ctx.depthOnly = new MeshDepthMaterial();
  ctx.depthOnly.colorWrite = false;
  ctx.cubeRT = new WebGLCubeRenderTarget(512, { type: HalfFloatType, generateMipmaps: false });
  ctx.cube = new CubeCamera(0.05, 1000, ctx.cubeRT);
  ctx.headsetRoot.add(ctx.cube);
  hs.setEnvMap(ctx.cubeRT.texture);
}

/* ------------------------------------------------------------------ ray ---- */
function buildRay() {
  const mat = new PointerRayMaterial();
  const mesh = new Mesh(new BoxGeometry(), mat);
  mesh.matrixAutoUpdate = false;
  mesh.renderOrder = 30;
  mesh.visible = false;
  mesh.raycast = () => {};
  const cmat = new PointerCursorMaterial();
  const cursor = new Mesh(new PlaneGeometry(), cmat);
  cursor.matrixAutoUpdate = false;
  cursor.renderOrder = 31;
  cursor.visible = false;
  cursor.raycast = () => {};
  ctx.ray.group.add(mesh);
  ctx.ray.mesh = mesh;
  ctx.ray.mat = mat;
  ctx.ray.cursor = cursor;
  ctx.ray.cursorMat = cmat;
}
const raycaster = new Raycaster();
const equipment = spatialStands.find((s) => s.key === "equipment")!;
function aimWorld(t: number): Vector3 | null {
  const aim = PATH.aimAt(t);
  if (aim.space === "none") return null;
  if (aim.space === "world") return aim.p.clone();
  if (aim.space === "equipment") {
    const o = new Object3D();
    o.position.set(equipment.x, 1.6, equipment.z);
    o.rotation.set(0, equipment.angle, 0);
    o.updateMatrixWorld();
    return aim.p.clone().applyMatrix4(o.matrixWorld);
  }
  const pose = layerState.focusPose;
  if (!pose) return null;
  return aim.p.clone().applyQuaternion(pose.q).add(pose.p);
}
/** The hand ray's current hit against layer B (with lifted surfaces), as the app would see it. */
function rayHit(t: number): { hand: Vector3; hit: Intersection | null } {
  const hand = PATH.handAt(t);
  const target = aimWorld(t);
  if (!target || !ctx.stands) return { hand, hit: null };
  ctx.stands.updateMatrixWorld(true);
  raycaster.set(hand, target.clone().sub(hand).normalize());
  raycaster.far = 10;
  const hits = raycaster.intersectObject(ctx.stands, true).filter((h) => h.object !== ctx.ray.mesh && h.object !== ctx.ray.cursor);
  return { hand, hit: hits[0] ?? null };
}
function updateRay(t: number) {
  const { hand, hit } = rayHit(t);
  const pressed = PATH.pressedAt(t);
  const stub = {
    getEnabled: () => true,
    getButtonsDown: () => (pressed ? new Set([0]) : new Set()),
    getIntersection: () =>
      hit
        ? { distance: hit.distance, pointOnFace: hit.point, normal: hit.face?.normal ?? new Vector3(0, 0, 1), object: hit.object }
        : undefined,
  };
  if (hit) {
    ctx.ray.group.position.copy(hand);
    ctx.ray.group.quaternion.copy(PATH.lookQuat(hand, hit.point));
    ctx.ray.group.updateMatrixWorld(true);
  }
  updatePointerRayModel(ctx.ray.mesh, ctx.ray.mat, stub as never, RAY);
  updatePointerCursorModel(ctx.ray.group, ctx.ray.cursor, ctx.ray.cursorMat, stub as never, CURSOR);
  ctx.ray.mesh.updateMatrixWorld(true);
  ctx.ray.cursor.updateMatrixWorld(true);
}

/* --------------------------------------------------------- environment ---- */
function envParts(g: Group | null) {
  const env = g?.getObjectByName("space-environment");
  if (!env) return null;
  const [, stars, earth, sun] = env.children;
  const spin = earth.children[0];
  const cloud = earth.children.length > 2 ? earth.children[1] : null;
  const halo = earth.children[earth.children.length - 1] as Mesh;
  return { env, stars, earth, spin, cloud, halo, sun };
}
/**
 * The cold-open camera is the app's own backdrop camera, read from the capture (lens, position
 * and per-frame orientation at f129-150), so the dissolve into the DOM registers whatever the
 * app's lens is. Before f129 the view lifts from the night side (4.5° lower) to that pose.
 */
function s01Pose(t: number): PATH.Pose {
  const f = ctx.capture.frames;
  const at = (k: number) => f[String(Math.min(150, Math.max(129, Math.round(k))))].env!.camera;
  const c129 = at(129);
  const pos = new Vector3(...(c129.p as [number, number, number]));
  if (t >= 129) {
    const c = at(t);
    return { pos, quat: new Quaternion(...(c.q as [number, number, number, number])), fov: c.fov };
  }
  const end = new Quaternion(...(c129.q as [number, number, number, number]));
  const start = end.clone().multiply(new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), -4.5 * DEG));
  return { pos, quat: start.slerp(end, E_calm(seg(t, 0, 120))), fov: c129.fov };
}
/** Desktop world time registered to the DOM backdrop (clock at DOM frame 150). */
function desktopClock(t: number) {
  const env150 = ctx.capture.frames["150"]?.env;
  const c150 = env150 ? env150.clock : 4.0;
  return c150 + (t - 150) / 30;
}
function setEnvState(g: Group | null, time: number) {
  const p = envParts(g);
  if (!p) return;
  p.spin.rotation.y = EARTH_SPIN * time;
  if (p.cloud) p.cloud.rotation.y = CLOUD_SPIN * time;
  if (p.sun) p.sun.scale.setScalar(1 + 0.04 * Math.sin(time * 0.7));
}
/** S01: the sunrise flare grows on the limb (product values from f108). */
function flare(g: Group | null, t: number) {
  const p = envParts(g);
  if (!p || !p.sun) return;
  const k = t >= 108 ? 1 : t < 15 ? 0 : TL.MJ(clamp01((t / 30 - 0.5) / 3.1));
  const [glow, wide, core, streak] = p.sun.children as Mesh[];
  (glow.material as { opacity: number }).opacity = 0.55 * k;
  (wide.material as { opacity: number }).opacity = 0.42 * k;
  (core.material as { opacity: number }).opacity = 1.0 * k;
  (streak.material as { opacity: number }).opacity = 0.35 * k;
  streak.scale.x = 1500 * (0.4 + 0.6 * k);
  const u = (p.halo.material as ShaderMaterial).uniforms;
  if (u?.strength) u.strength.value = 0.35 + 0.65 * k;
}

/* --------------------------------------------------------------- shots ---- */
type Mode = "desktop" | "dom" | "headset" | "xr";
export function modeOf(k: number): Mode {
  if (k < 150) return "desktop";
  if (k <= TL.DOM_LAST) return "dom";
  // From the floating window on, shots run on the script's frame numbers.
  const s = k - TL.XR_SHIFT;
  if (s < 750) return "headset";
  if (s < 1170) return "xr";
  return "headset";
}
function show(groups: Partial<Record<"desktop" | "xrEnv" | "stands" | "pane" | "headset", boolean>>) {
  if (ctx.desktopEnv) ctx.desktopEnv.visible = !!groups.desktop;
  if (ctx.xrEnv) ctx.xrEnv.visible = !!groups.xrEnv;
  if (ctx.stands) ctx.stands.visible = !!groups.stands;
  ctx.pane.visible = !!groups.pane;
  ctx.headsetRoot.visible = !!groups.headset;
}
function applyPose(pose: PATH.Pose, near = 0.1, far = 1000) {
  const c = ctx.camera;
  c.position.copy(pose.pos);
  c.quaternion.copy(pose.quat);
  c.fov = pose.fov;
  c.near = near;
  c.far = far;
  c.aspect = 16 / 9;
  c.updateProjectionMatrix();
  c.updateMatrixWorld(true);
}
function draw(target: import("three").WebGLRenderTarget | null, clear: boolean, clearAlpha = 1) {
  const gl = ctx.gl;
  gl.setRenderTarget(target);
  if (clear) {
    gl.setClearColor(0x000000, clearAlpha);
    gl.clear(true, true, true);
  }
  gl.render(ctx.scene, ctx.camera);
}

/** Pane and cursor state for DOM film time t within frame k (sub-frame i). */
function domFrameState(k: number, t: number, i: number) {
  const n = domSubs(k);
  const si = n >= 4 ? i : 0;
  const keyA = `${k}_${si}`;
  const texA = ctx.loaded.get(keyA);
  const sub = ctx.capture.frames[String(k)].subs[si];
  let held: Texture | null = null,
    mixB = 0;
  for (const d of TL.DOM_DISSOLVES) {
    if (k >= d.start && k <= d.end) {
      held = ctx.loaded.get(`${d.held}_0`) ?? null;
      mixB = 1 - clamp01((t - d.held) / (d.end - d.held));
    }
  }
  return { texA, held, mixB, cursor: sub.cursor };
}

const sunColor = new Color(colors["space-sun-core"]);
function sunScreen(): Vector2 {
  const p = ctx.camera.position.clone().add(SUN_DARK.clone().normalize().multiplyScalar(800)).project(ctx.camera);
  return new Vector2(((p.x + 1) / 2) * W, ((p.y + 1) / 2) * H4);
}
function bloomStrength(t: number) {
  if (t < 600) return 0;
  if (t < 630) return 0.5 * smoothstep(600, 630, t);
  if (t < 737) return 0.5;
  if (t < 749) return lerp(0.5, 0.9, smoothstep(737, 749, t));
  if (t < 770) return 0.9 * (1 - smoothstep(749, 770, t));
  if (t < 1170) return 0;
  return 0.5 * smoothstep(1170, 1190, t);
}
function glowOpacity(t: number) {
  if (t >= 737 && t < 749) return 0.45 * smoothstep(737, 749, t);
  if (t >= 749 && t < 770) return 0.45 * (1 - smoothstep(749, 770, t));
  if (t >= 1170 && t < 1172) return 0.3 * smoothstep(1170, 1172, t);
  if (t >= 1172 && t < 1190) return 0.3 * (1 - smoothstep(1172, 1190, t));
  return 0;
}
/** Depth of field (σ in 1080p px). */
function sigmaBG(t: number) {
  if (t < 600) return 0;
  if (t < 700) return 6 * E_calm(seg(t, 600, 630));
  if (t < 750) return 6 * (1 - E_calm(seg(t, 700, 740)));
  if (t < 1170) return 0;
  return 3 * E_calm(seg(t, 1194, 1218));
}
function sigmaHead(t: number) {
  if (t < 750) return 8 * E_calm(seg(t, 720, 745));
  return 8 * (1 - E_calm(seg(t, 1176, 1196)));
}
/**
 * Lens content. From a distance a lens shows its display: the wearer's view, wide (w = 0). As the
 * camera nears, the display view narrows to exactly the see-through view of the aperture (w = 1),
 * then hands over to the screen-space portal, which the cut to layer B needs.
 */
function displayW(t: number) {
  if (t < 1170) return E_calm(seg(t, 706, 726));
  return 1 - E_calm(seg(t, 1194, 1216));
}
// Hand-overs happen while the aperture is smaller than the display texture on screen.
function displayMixAt(t: number) {
  if (t < 1170) return 1 - seg(t, 726, 730);
  return seg(t, 1190, 1194);
}
function updateDisplay(kf: number) {
  const k = kf - TL.XR_SHIFT;
  if (modeOf(kf) !== "headset" || displayMixAt(k) <= 0) return;
  const hs = PATH.headsetAt(k);
  const g = ctx.headset.group;
  g.position.copy(hs.pos);
  g.quaternion.copy(hs.quat);
  g.updateMatrixWorld(true);
  const camA = PATH.filmCameraXR(k, ctx.a0);
  const w = displayW(k);
  const m = g.matrixWorld;
  const right = new Vector3().setFromMatrixColumn(m, 0).normalize();
  const up = new Vector3().setFromMatrixColumn(m, 1).normalize();
  const fwd = new Vector3().setFromMatrixColumn(m, 2).normalize().negate();
  setEnvState(ctx.xrEnv, (k - 900) / 30);
  show({ xrEnv: true, stands: true });
  ctx.ray.mesh.visible = false;
  ctx.ray.cursor.visible = false;
  const gl = ctx.gl;
  const cam = ctx.displayCam;
  const R = 0.024,
    near = 0.005,
    wide = Math.tan(47.5 * DEG);
  ctx.headset.glass.forEach((glass, i) => {
    // An off-axis frustum through the aperture: the image maps exactly onto the lens disc, so at
    // w = 1 the lens shows precisely what the screen-space portal shows.
    const centre = glass.getWorldPosition(new Vector3());
    const eye = new Vector3(i === 0 ? -0.0315 : 0.0315, 0, 0).applyMatrix4(m);
    const pos = eye.lerp(camA.pos, w);
    const rel = centre.clone().sub(pos);
    const dx = rel.dot(right),
      dy = rel.dot(up),
      dz = Math.max(1e-4, rel.dot(fwd));
    const l = lerp(-wide, (dx - R) / dz, w),
      r = lerp(wide, (dx + R) / dz, w),
      bt = lerp(-wide, (dy - R) / dz, w),
      tp = lerp(wide, (dy + R) / dz, w);
    cam.position.copy(pos);
    cam.quaternion.copy(hs.quat);
    cam.near = near;
    cam.far = 1000;
    cam.updateMatrixWorld(true);
    cam.projectionMatrix.makePerspective(l * near, r * near, tp * near, bt * near, near, 1000);
    cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
    gl.setRenderTarget(ctx.displayRTs[i]);
    gl.setClearColor(0x000000, 1);
    gl.clear(true, true, true);
    gl.render(ctx.scene, cam);
  });
}
function lensFx(t: number) {
  if (t < 1170) return 1 - smoothstep(738, 749, t);
  return smoothstep(1170, 1186, t);
}

function renderSample(s: { k: number; t: number; i: number; n: number; weight: number }) {
  const { k, t, i, weight } = s;
  const pipe = ctx.pipe;
  const gl = ctx.gl;
  const mode = modeOf(k);
  gl.autoClear = false;
  if (mode === "desktop") {
    setEnvState(ctx.desktopEnv, desktopClock(t));
    flare(ctx.desktopEnv, t);
    applyPose(s01Pose(t));
    show({ desktop: true });
    draw(pipe.scene, true);
    const g = pipe.m.grade.uniforms;
    g.tex.value = pipe.scene.texture;
    g.fade.value = clamp01(t / 18);
    // The backdrop's ::after gradient, rgba(6, 12, 22, 0.18 -> 0.06), as in the DOM.
    g.gradTop.value = [6 / 255, 12 / 255, 22 / 255, 0.18];
    g.gradBottom.value = [6 / 255, 12 / 255, 22 / 255, 0.06];
    pipe.pass(pipe.m.grade, pipe.comp);
    if (k >= TL.DOM_DISSOLVE[0]) {
      const st = domFrameState(k, t, i);
      ctx.paneMat.uniforms.mapA.value = st.texA;
      ctx.paneMat.uniforms.mixB.value = 0;
      ctx.paneMat.uniforms.opacity.value = clamp01((t - TL.DOM_DISSOLVE[0]) / (TL.DOM_DISSOLVE[1] - TL.DOM_DISSOLVE[0]));
      ctx.paneMat.uniforms.outside.value = 1;
      placeCursor(null);
      applyPose(PATH.domPose(t), 0.05);
      show({ pane: true });
      draw(pipe.comp, false);
    }
    pipe.accumulate(pipe.comp.texture, weight);
    return;
  }
  if (mode === "dom") {
    const st = domFrameState(k, t, i);
    const u = ctx.paneMat.uniforms;
    u.mapA.value = st.texA;
    u.mapB.value = st.held;
    u.mixB.value = st.held ? st.mixB : 0;
    u.opacity.value = 1;
    u.outside.value = 1;
    const cur = { ...st.cursor };
    placeCursor(cur);
    applyPose(PATH.domPose(t), 0.05);
    show({ pane: true });
    draw(pipe.comp, true);
    pipe.accumulate(pipe.comp.texture, weight);
    return;
  }
  render3D(mode, k - TL.XR_SHIFT, t - TL.XR_SHIFT, weight);
}

/** 3D shots on script frames (k, t = film frame − XR_SHIFT). */
function render3D(mode: Mode, k: number, t: number, weight: number) {
  const pipe = ctx.pipe;
  // 3D worlds share the XR environment (clouds off, as in a session).
  setEnvState(ctx.xrEnv, (t - 900) / 30);
  const pose = PATH.filmCameraXR(t, ctx.a0);
  if (mode === "xr") {
    updateRay(t);
    applyPose(pose);
    show({ xrEnv: true, stands: true });
    draw(pipe.scene, true);
    const bs = bloomStrength(t),
      go = glowOpacity(t);
    if (bs > 0.001 || go > 0.0005) {
      pipe.copy(pipe.scene.texture, pipe.comp, 0);
      pipe.applyBloom(bs);
      pipe.glow(sunScreen(), 0.9 * W, go, sunColor);
      pipe.accumulate(pipe.comp.texture, weight);
    } else pipe.accumulate(pipe.scene.texture, weight);
    return;
  }
  // Headset world: background (environment + floating window) -> portal -> headset.
  const withPane = k < 750;
  if (withPane) {
    const u = ctx.paneMat.uniforms;
    u.mapA.value = ctx.loaded.get(`${TL.DOM_LAST}_0`);
    u.mixB.value = 0;
    u.opacity.value = 1;
    u.outside.value = 1 - clamp01((t - 540) / 18);
    const m = ctx.capture.frames[String(TL.DOM_LAST)].spatialModal!;
    u.rect.value = [m.x, m.y, m.w, m.h];
    u.radius.value = m.radius;
    placeCursor(null);
  }
  const hs = PATH.headsetAt(t);
  const headsetIn = t >= 600 || k >= 1170;
  ctx.headset.group.position.copy(hs.pos);
  ctx.headset.group.quaternion.copy(hs.quat);
  ctx.headset.group.updateMatrixWorld(true);
  ctx.ray.mesh.visible = false;
  ctx.ray.cursor.visible = false;
  applyPose(pose);
  show({ xrEnv: true, pane: withPane });
  draw(pipe.scene, true);
  const sBG = sigmaBG(t) * 2;
  const bgTex = pipe.blur(pipe.scene, sBG, pipe.blurs.bg);
  const cu = pipe.m.composite.uniforms;
  cu.bg.value = bgTex;
  cu.useHead.value = 0;
  if (headsetIn) {
    // Portal: layer B from camera A, blurred like the background.
    show({ xrEnv: true, stands: true });
    draw(pipe.portal, true);
    const portalTex = pipe.blur(pipe.portal, sBG, pipe.blurs.portal);
    // Headset with the lens apertures cut out (alpha 0).
    const body = ctx.headset.body,
      glass = ctx.headset.glass;
    for (const g of glass) g.material = ctx.glassHole;
    applyPose(pose, 0.005, 5);
    show({ headset: true });
    draw(pipe.head, true, 0);
    const headTex = pipe.blur(pipe.head, sigmaHead(t) * 2, pipe.blurs.head);
    // Lens glass only, depth-tested against the body.
    const saved = body.map((m) => m.material);
    for (const m of body) m.material = ctx.depthOnly;
    glass.forEach((g, j) => {
      const m = ctx.glassPortals[j];
      m.uniforms.portal.value = portalTex;
      m.uniforms.fx.value = lensFx(t);
      m.uniforms.display.value = ctx.displayRTs[j].texture;
      m.uniforms.displayMix.value = displayMixAt(k);
      g.material = m;
    });
    draw(pipe.glass, true, 0);
    body.forEach((m, j) => (m.material = saved[j]));
    cu.glass.value = pipe.glass.texture;
    cu.head.value = headTex;
    cu.useHead.value = 1;
  }
  pipe.pass(pipe.m.composite, pipe.comp);
  applyPose(pose);
  pipe.applyBloom(bloomStrength(t));
  pipe.glow(sunScreen(), 0.9 * W, glowOpacity(t), sunColor);
  pipe.accumulate(pipe.comp.texture, weight);
}

function updateEnvMap(kf: number) {
  if (modeOf(kf) !== "headset") return;
  const k = kf - TL.XR_SHIFT;
  setEnvState(ctx.xrEnv, (k - 900) / 30);
  const hsp = PATH.headsetAt(k);
  ctx.cube.position.copy(hsp.pos);
  ctx.cube.updateMatrixWorld(true);
  show({ xrEnv: true, pane: k < 750 });
  ctx.headsetRoot.visible = true;
  ctx.headset.group.visible = false;
  ctx.reflectionRig.visible = true;
  ctx.reflectionRig.position.copy(hsp.pos);
  const autoClear = ctx.gl.autoClear;
  ctx.gl.autoClear = true;
  ctx.cube.update(ctx.gl, ctx.scene);
  ctx.gl.autoClear = autoClear;
  ctx.reflectionRig.visible = false;
  ctx.headset.group.visible = true;
  // A fresh prefiltered map every frame: three's cached PMREM target carries history between
  // frames, which made a frame depend on whether the previous one was rendered.
  const pm = ctx.pmrem ?? (ctx.pmrem = new PMREMGenerator(ctx.gl));
  const next = pm.fromCubemap(ctx.cubeRT.texture);
  ctx.headset.setEnvMap(next.texture);
  ctx.envRT?.dispose();
  ctx.envRT = next;
}

/* ---------------------------------------------------------------- scene ---- */
function FilmScene() {
  const [focused, setFocused] = useState<number | null>(null);
  const { gl, scene, camera } = useThree();
  useMemo(() => {
    // Suspense may render this component more than once before it commits: build once.
    if (ctx.pipe) return;
    ctx.gl = gl;
    ctx.scene = scene;
    ctx.camera = camera as PerspectiveCamera;
    ctx.pipe = new Pipeline(gl, W, H4);
    buildPane();
    buildHeadset();
    buildRay();
    scene.add(ctx.pane, ctx.headsetRoot);
    ctx.pane.visible = false;
    ctx.headsetRoot.visible = false;
  }, [gl, scene, camera]);
  ctx.setFocused = setFocused;
  useFrame(() => {
    if (ctx.sample) renderSample(ctx.sample);
  }, 1);
  return (
    <>
      <group ref={(r) => void (ctx.desktopEnv = r)}>
        <SpaceEnvironment dark motion clouds />
      </group>
      <group ref={(r) => void (ctx.xrEnv = r)}>
        <SpaceEnvironment dark clouds={false} />
      </group>
      <group ref={(r) => void (ctx.stands = r)}>
        <LayerB focused={focused} setFocused={setFocused} />
        <primitive object={ctx.ray.group} />
        <primitive object={ctx.ray.cursor} />
      </group>
    </>
  );
}

/* ------------------------------------------------------------------ API ---- */
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));
function tick(seconds: number, sample: typeof ctx.sample) {
  if (seconds < ctx.clockNow - 1e-9) throw new Error(`clock must be monotonic (${seconds} < ${ctx.clockNow})`);
  ctx.sample = sample;
  advance(seconds);
  ctx.sample = null;
  ctx.clockNow = seconds;
}
const secondsOf = (t: number) => T0 + t / 30;

function samplesFor(k: number): number[] {
  const mode = modeOf(k);
  if (mode === "dom") {
    if (domSubs(k) >= 4) return shutterOffsets(4);
    const a = TL.vCameraAt(k - 0.25),
      b = TL.vCameraAt(k + 0.25);
    const moving = a.some((v: number, j: number) => Math.abs(v - b[j]) > 1e-6);
    return moving ? shutterOffsets(4) : [0];
  }
  if (mode === "desktop") return shutterOffsets(4);
  return shutterOffsets(6);
}

async function ensureTextures(k: number) {
  const need: Promise<Texture>[] = [];
  const mode = modeOf(k);
  if ((mode === "desktop" && k >= TL.DOM_DISSOLVE[0]) || mode === "dom") {
    const n = Math.max(1, domSubs(k));
    for (let i = 0; i < n; i++) need.push(loadDom(k, i));
    for (const d of TL.DOM_DISSOLVES) if (k >= d.start && k <= d.end) need.push(loadDom(d.held, 0));
    // Prefetch ahead.
    for (let j = 1; j <= 3; j++) {
      const kk = k + j;
      if (kk > TL.DOM_LAST) break;
      const nn = Math.max(1, domSubs(kk));
      for (let i = 0; i < nn; i++) void loadDom(kk, i);
    }
  }
  if (k >= TL.DOM_LAST - 2) need.push(loadDom(TL.DOM_LAST, 0));
  await Promise.all(need);
  const keep = new Set<string>([`${TL.DOM_LAST}_0`, ...TL.DOM_DISSOLVES.map((d) => `${d.held}_0`)]);
  releaseDom(k - 1, keep);
}

const film = {
  ready: false,
  info: {} as Record<string, unknown>,
  /** Pointer for frame k: sets the camera to the frame-centre pose and returns the mouse target. */
  pointer(kf: number) {
    // No pointer events at all before the ray appears: a parked mouse over a stand would hover it.
    const out: { x: number; y: number; skip?: boolean; down?: boolean; up?: boolean; settle?: boolean } = { x: 0, y: 0 };
    if (modeOf(kf) !== "xr") return { ...out, skip: true };
    const k = kf - TL.XR_SHIFT;
    if (k < 951 || k > 1140) return { ...out, skip: true };
    applyPose(PATH.filmCameraXR(k, ctx.a0));
    const press = PATH.XR_PRESSES.find(([f]) => f === k);
    const { hit } = rayHit(k);
    const lockRef = film as unknown as { lock?: { x: number; y: number } };
    if (hit) {
      const p = hit.point.clone().project(ctx.camera);
      out.x = ((p.x + 1) / 2) * 1920;
      out.y = ((1 - p.y) / 2) * 1080;
    } else {
      // Park where a camera ray hits nothing (sky above the stands).
      const candidates = [[960, 4], [40, 4], [1880, 4], [960, 30]];
      const rc = new Raycaster();
      for (const [x, y] of candidates) {
        rc.setFromCamera(new Vector2((x / 1920) * 2 - 1, -(y / 1080) * 2 + 1), ctx.camera);
        const any = ctx.stands ? rc.intersectObject(ctx.stands, true).filter((h) => h.object !== ctx.ray.mesh && h.object !== ctx.ray.cursor) : [];
        if (!any.length) {
          out.x = x;
          out.y = y;
          break;
        }
      }
    }
    // Hold the pixel while the trigger is down so R3F reads a click (≤ 2 px).
    if (((k > 1002 && k <= 1006) || (k > 1112 && k <= 1116)) && lockRef.lock) {
      out.x = lockRef.lock.x;
      out.y = lockRef.lock.y;
    }
    if (press) {
      if (press[1] === "down") lockRef.lock = { x: out.x, y: out.y };
      out[press[1]] = true;
      out.settle = true;
    }
    return out;
  },
  async settle() {
    await sleep(0);
    await nextFrame();
    await sleep(0);
  },
  /** QA: the desktop world alone (environment + backdrop gradient) at film time t, to the canvas. */
  async probeDesktop(t: number) {
    const pipe = ctx.pipe;
    setEnvState(ctx.desktopEnv, desktopClock(t));
    flare(ctx.desktopEnv, t);
    applyPose(s01Pose(t));
    show({ desktop: true });
    ctx.gl.autoClear = false;
    draw(pipe.scene, true);
    const g = pipe.m.grade.uniforms;
    g.tex.value = pipe.scene.texture;
    g.fade.value = 1;
    g.gradTop.value = [6 / 255, 12 / 255, 22 / 255, 0.18];
    g.gradBottom.value = [6 / 255, 12 / 255, 22 / 255, 0.06];
    pipe.pass(pipe.m.grade, pipe.comp);
    pipe.beginAccumulation();
    pipe.accumulate(pipe.comp.texture, 1);
    pipe.output(0);
    ctx.overlay.hideAll();
    await nextFrame();
  },
  /** Advance to frame k without rendering (for partial renders). */
  skip(k: number) {
    tick(secondsOf(k), null);
  },
  async render(k: number, opts: { samples?: number } = {}) {
    await ensureTextures(k);
    updateEnvMap(k);
    updateDisplay(k);
    const offs = opts.samples === 1 ? [0] : samplesFor(k);
    ctx.pipe.beginAccumulation();
    offs.forEach((o, i) => {
      const t = k + o;
      tick(secondsOf(t), { k, t, i, n: offs.length, weight: 1 / offs.length });
      ctx.stats.samples++;
    });
    ctx.pipe.output(modeOf(k) === "dom" ? 0 : 0.5);
    ctx.overlay.update(k);
    await nextFrame();
    return { k, samples: offs.length, mode: modeOf(k), focused: layerState.focused };
  },
};
(window as unknown as { film: typeof film }).film = film;
(window as unknown as { __filmCtx: typeof ctx }).__filmCtx = ctx;

export async function start(locale: "uk" | "en") {
  ctx.locale = locale;
  const cap = await fetch(`/cache/${locale}/dom/capture.json`).then((r) => r.json());
  ctx.capture = cap;
  useDashboardStore.setState({ theme: "dark", compact: true });
  ctx.overlay = new Overlay(document.getElementById("overlay")!, cap.measure.wordmark, locale);
  const camera = new PerspectiveCamera(68, 16 / 9, 0.1, 1000);
  (camera as unknown as { manual: boolean }).manual = true;
  const stage = document.getElementById("stage")!;
  createRoot(stage).render(
    <Canvas
      frameloop="never"
      dpr={2}
      camera={camera}
      gl={{ antialias: true, alpha: false, preserveDrawingBuffer: true, powerPreference: "high-performance" }}
      style={{ width: 1920, height: 1080 }}
    >
      <Suspense fallback={null}>
        <FilmScene />
      </Suspense>
    </Canvas>,
  );
  // Wait until both environments (Earth photographs) and the stands are mounted.
  for (let i = 0; i < 600; i++) {
    const ok = envParts(ctx.desktopEnv) && envParts(ctx.xrEnv) && ctx.stands && ctx.stands.getObjectByName("stand-equipment");
    if (ok && ctx.pipe) break;
    await sleep(50);
    if (ctx.gl) advance(0);
  }
  // Pre-roll: the stands' appear cascade completes, textures redraw once the brand font is ready.
  for (let s = 0; s <= (T0 - 0.5) * 30; s++) tick(s / 30, null);
  await sleep(200);
  for (let j = 0; j < 3; j++) {
    await sleep(50);
  }
  ctx.a0 = PATH.domPose(TL.DOM_LAST);
  const glc = ctx.gl.getContext();
  const ext = glc.getExtension("WEBGL_debug_renderer_info");
  film.info = {
    renderer: glc.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : glc.RENDERER),
    floatBlend: !!glc.getExtension("EXT_float_blend"),
    fonts: {
      display500: document.fonts.check('500 64px "Pryvat Sans Display"'),
      text400: document.fonts.check('400 48px "Pryvat Sans"'),
      text600: document.fonts.check('600 28px "Pryvat Sans"'),
      text700: document.fonts.check('700 28px "Pryvat Sans"'),
    },
    clock: ctx.clockNow,
  };
  film.ready = true;
}
