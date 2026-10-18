import { useEffect, useMemo, useRef } from "react";
import { useFrame, useLoader, useThree } from "@react-three/fiber";
import {
  AdditiveBlending,
  BackSide,
  BufferGeometry,
  CanvasTexture,
  Color,
  type Group,
  Float32BufferAttribute,
  NoColorSpace,
  SRGBColorSpace,
  TextureLoader,
  Vector3,
} from "three";
import { colors } from "../api/model";
// NASA Blue Marble Next Generation, October 2004 (topography and bathymetry) and Black Marble
// 2016 night lights; public domain (NASA Earth Observatory), resized to 4096×2048.
import earthDay from "../assets/earth-day-4096.jpg";
import earthNight from "../assets/earth-night-4096.jpg";

/**
 * Low orbit: Earth fills the lower field, its limb sits just below eye level and
 * the sun rises from behind it (dark) or lights the day side from behind the viewer (light).
 * The stands in VR float above the limb; the DOM backdrop looks slightly upward at the same scene.
 */
const EARTH_CENTER = new Vector3(0, -417, -249);
const EARTH_RADIUS = 400;
// Ukraine (about 48° N, 30° E) faces the limb; the sun stands just above it, left of centre.
const EARTH_ROTATION: [number, number, number] = [-0.38, -2.09, 0];
const SUN_DARK = new Vector3(-330, -30, -830);
const SUN_LIGHT = new Vector3(-500, 700, 600);

function skyTexture(dark: boolean) {
  const canvas = document.createElement("canvas");
  canvas.width = 32;
  canvas.height = 1024;
  const ctx = canvas.getContext("2d")!;
  const base = ctx.createLinearGradient(0, 0, 0, 1024);
  if (dark) {
    base.addColorStop(0, colors["space-night"]);
    base.addColorStop(0.36, colors["space-night"]);
    base.addColorStop(0.52, colors["space-blue"]);
    base.addColorStop(0.7, colors["space-night"]);
    base.addColorStop(1, colors["space-night"]);
  } else {
    base.addColorStop(0, colors["space-day-sky"]);
    base.addColorStop(0.3, colors["space-day-sky"]);
    base.addColorStop(0.44, colors["space-light"]);
    base.addColorStop(0.52, colors["space-day-haze"]);
    base.addColorStop(1, colors["space-light-mid"]);
  }
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 32, 1024);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

function glowTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.08, "rgba(255,255,255,.75)");
  g.addColorStop(0.3, "rgba(255,255,255,.16)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
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
    shades: number[] = [],
    phases: number[] = [];
  for (let i = 0; i < 1800; i++) {
    const y = random() * 2 - 1,
      angle = random() * Math.PI * 2,
      r = 820 + random() * 80;
    const horizontal = Math.sqrt(1 - y * y);
    positions.push(
      Math.cos(angle) * horizontal * r,
      y * r,
      Math.sin(angle) * horizontal * r,
    );
    const brightness = 0.25 + random() ** 3 * 0.75;
    const color = new Color(colors["space-star"]).multiplyScalar(brightness);
    shades.push(color.r, color.g, color.b);
    phases.push(random());
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("starColor", new Float32BufferAttribute(shades, 3));
  geometry.setAttribute("phase", new Float32BufferAttribute(phases, 1));
  return geometry;
}

// Each star breathes on its own slow period (4-10 s); the field never repeats in step.
const starVertex = /* glsl */ `
  attribute vec3 starColor;
  attribute float phase;
  uniform float time;
  uniform float size;
  varying vec3 vColor;
  void main() {
    float speed = 0.6 + fract(phase * 7.31) * 0.9;
    float breath = 0.7 + 0.3 * sin(time * speed + phase * 6.2832);
    vColor = starColor * breath;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = size;
  }
`;
const starFragment = /* glsl */ `
  uniform float opacity;
  varying vec3 vColor;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    gl_FragColor = vec4(vColor, smoothstep(0.5, 0.0, d) * 1.35 * opacity);
  }
`;

const earthVertex = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vTangent;
  varying vec3 vBitangent;
  varying vec3 vView;
  void main() {
    vUv = uv;
    vec4 world = modelMatrix * vec4(position, 1.0);
    vec3 n = normalize(normal);
    // East and north on the sphere, for relief derived from the photograph.
    vec3 east = normalize(vec3(-n.z, 0.0, n.x) + vec3(1e-5, 0.0, 0.0));
    vec3 north = cross(n, east);
    vNormal = normalize(mat3(modelMatrix) * n);
    vTangent = normalize(mat3(modelMatrix) * east);
    vBitangent = normalize(mat3(modelMatrix) * north);
    vView = normalize(cameraPosition - world.xyz);
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;
const earthFragment = /* glsl */ `
  uniform sampler2D map;
  uniform sampler2D lights;
  uniform vec2 texel;
  uniform vec3 sunDir;
  uniform vec3 atmosphere;
  uniform vec3 sunColor;
  uniform vec3 lightsColor;
  uniform float lightsStrength;
  uniform float relief;
  uniform float dayBoost;
  uniform float hazeAmount;
  uniform vec3 hazeTint;
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vTangent;
  varying vec3 vBitangent;
  varying vec3 vView;
  float height(vec2 uv) {
    return dot(texture2D(map, uv).rgb, vec3(0.299, 0.587, 0.114));
  }
  void main() {
    vec3 albedo = texture2D(map, vUv).rgb;
    float h0 = dot(albedo, vec3(0.299, 0.587, 0.114));
    vec2 slope = vec2(height(vUv + vec2(texel.x, 0.0)) - h0, height(vUv + vec2(0.0, texel.y)) - h0);
    vec3 n = normalize(vNormal);
    vec3 nr = normalize(n - (vTangent * slope.x + vBitangent * slope.y) * relief);
    float ndl = dot(n, sunDir);
    float shade = dot(nr, sunDir);
    float day = smoothstep(-0.12, 0.35, ndl);
    vec3 night = albedo * 0.025 + vec3(0.004, 0.009, 0.022);
    vec3 lit = albedo * (0.2 + 1.08 * max(shade, 0.0)) * dayBoost;
    vec3 color = mix(night, lit, day);
    // Sun glint on open water: the photograph's oceans are blue-dominant and smooth.
    float water = smoothstep(0.02, 0.09, albedo.b - max(albedo.r, albedo.g));
    vec3 mirrored = reflect(-sunDir, n);
    float glint = pow(max(dot(mirrored, vView), 0.0), 80.0) * water * day;
    color += sunColor * glint * 1.6;
    // City lights only where the night is deep enough.
    float cities = smoothstep(0.2, 0.85, texture2D(lights, vUv).r);
    color += lightsColor * cities * lightsStrength * (1.0 - smoothstep(-0.02, 0.24, ndl));
    float fresnel = pow(1.0 - max(dot(n, vView), 0.0), 5.0);
    float facing = pow(max(dot(-vView, sunDir), 0.0), 24.0);
    vec3 rim = mix(atmosphere, sunColor, clamp(facing * 1.3, 0.0, 1.0));
    float haze = pow(1.0 - max(dot(n, vView), 0.0), 1.6);
    color = mix(color, atmosphere * hazeTint, haze * hazeAmount);
    color += rim * fresnel * (smoothstep(-0.3, 0.3, ndl) * 0.9 + facing * 2.2);
    gl_FragColor = vec4(color, 1.0);
  }
`;
const haloVertex = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vNormal = normalize(mat3(modelMatrix) * normal);
    vView = normalize(cameraPosition - world.xyz);
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;
const haloFragment = /* glsl */ `
  uniform vec3 sunDir;
  uniform vec3 atmosphere;
  uniform vec3 sunColor;
  uniform float strength;
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    vec3 n = normalize(vNormal);
    float edge = pow(max(0.0, 0.2 + dot(n, vView)) / 0.2, 3.0);
    float lit = smoothstep(-0.6, 0.4, dot(-n, sunDir));
    float facing = pow(max(dot(-vView, sunDir), 0.0), 18.0);
    vec3 color = mix(atmosphere, sunColor, clamp(facing * 1.5, 0.0, 1.0));
    float alpha = clamp(edge, 0.0, 1.0) * (lit * 0.7 + 0.12 + facing * 1.8) * strength;
    gl_FragColor = vec4(color * alpha, alpha);
  }
`;

// Procedural cloud deck: value-noise fbm on the unit sphere, lit by the same sun as the
// surface. It drifts faster than the ground, so the planet visibly lives even at a glance.
const cloudVertex = /* glsl */ `
  varying vec3 vObject;
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    vObject = normalize(position);
    vec4 world = modelMatrix * vec4(position, 1.0);
    vNormal = normalize(mat3(modelMatrix) * normal);
    vView = normalize(cameraPosition - world.xyz);
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;
const cloudFragment = /* glsl */ `
  uniform float time;
  uniform vec3 sunDir;
  uniform vec3 sunColor;
  uniform float opacity;
  uniform vec3 nightTint;
  varying vec3 vObject;
  varying vec3 vNormal;
  varying vec3 vView;
  float hash(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }
  float noise(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash(i), hash(i + vec3(1, 0, 0)), f.x),
          mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y),
      mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x),
          mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x), f.y),
      f.z);
  }
  float fbm(vec3 p) {
    float sum = 0.0, amp = 0.5;
    for (int i = 0; i < 5; i++) {
      sum += amp * noise(p);
      p = p * 2.03 + vec3(1.7, 9.2, 3.1);
      amp *= 0.5;
    }
    return sum;
  }
  void main() {
    vec3 p = vObject * 7.0 + vec3(time * 0.012, 0.0, time * 0.006);
    float warp = fbm(p * 0.5 + vec3(0.0, time * 0.004, 0.0));
    float density = smoothstep(0.47, 0.72, fbm(p + warp * 1.6));
    vec3 n = normalize(vNormal);
    float light = smoothstep(-0.25, 0.45, dot(n, sunDir));
    float facing = pow(max(dot(-vView, sunDir), 0.0), 10.0);
    vec3 color = mix(nightTint, vec3(1.0), light) + sunColor * facing * 0.6;
    float limb = smoothstep(0.0, 0.18, dot(n, vView));
    gl_FragColor = vec4(color, density * opacity * (0.18 + 0.82 * max(light, 0.25)) * limb);
  }
`;

// About one revolution in ten minutes: the surface drifts visibly, the limb and the stands stay still.
const EARTH_SPIN = 0.0105;
const CLOUD_SPIN = 0.016;

/** A distant environment with slow motion (Earth and clouds spin, star breathing, sunrise breathing); no remote runtime resources. AR omits it. */
export function SpaceEnvironment({
  dark,
  motion = true,
  clouds = true,
}: {
  dark: boolean;
  motion?: boolean;
  /** The cloud deck is fill-heavy; an active headset session renders without it. */
  clouds?: boolean;
}) {
  const spin = useRef<Group>(null);
  const cloudSpin = useRef<Group>(null);
  const sun = useRef<Group>(null);
  const pixelRatio = useThree((state) => state.gl.getPixelRatio());
  const starUniforms = useMemo(
    () => ({
      time: { value: 0 },
      size: { value: 3.2 * pixelRatio },
      opacity: { value: dark ? 0.95 : 0.2 },
    }),
    [dark, pixelRatio],
  );
  const cloudUniforms = useMemo(
    () => ({
      time: { value: 0 },
      sunDir: {
        value: (dark ? SUN_DARK : SUN_LIGHT)
          .clone()
          .sub(EARTH_CENTER)
          .normalize(),
      },
      sunColor: { value: new Color(colors["space-sun"]) },
      opacity: { value: dark ? 0.72 : 0.9 },
      nightTint: {
        value: dark ? new Color(0.06, 0.1, 0.18) : new Color(0.62, 0.7, 0.8),
      },
    }),
    [dark],
  );
  useFrame((_, delta) => {
    if (!motion) return;
    const step = Math.min(delta, 0.2);
    if (spin.current) spin.current.rotation.y += step * EARTH_SPIN;
    if (cloudSpin.current) cloudSpin.current.rotation.y += step * CLOUD_SPIN;
    starUniforms.time.value += step;
    cloudUniforms.time.value += step;
    // The sunrise breathes: about ±4% over nine seconds.
    if (sun.current)
      sun.current.scale.setScalar(
        1 + 0.04 * Math.sin(starUniforms.time.value * 0.7),
      );
  });
  const sky = useMemo(() => skyTexture(dark), [dark]);
  const glow = useMemo(glowTexture, []);
  const stars = useMemo(starsGeometry, []);
  const [earth, nightLights] = useLoader(TextureLoader, [earthDay, earthNight]);
  // The shader writes display colour directly, so the photos are sampled without decoding.
  for (const texture of [earth, nightLights]) {
    texture.colorSpace = NoColorSpace;
    texture.anisotropy = 8;
  }
  const sunPosition = dark ? SUN_DARK : SUN_LIGHT;
  const uniforms = useMemo(() => {
    const sunDir = sunPosition.clone().sub(EARTH_CENTER).normalize();
    const atmosphere = new Color(colors["space-atmosphere"]);
    const sunColor = new Color(colors["space-sun"]);
    return {
      earth: {
        map: { value: earth },
        lights: { value: nightLights },
        texel: { value: [1 / 4096, 1 / 2048] },
        lightsColor: { value: new Color(colors["space-sun"]) },
        lightsStrength: { value: dark ? 1.7 : 0 },
        relief: { value: dark ? 4.5 : 3.5 },
        sunDir: { value: sunDir },
        atmosphere: { value: atmosphere },
        sunColor: { value: sunColor },
        dayBoost: { value: dark ? 1 : 1.12 },
        hazeAmount: { value: dark ? 0.45 : 0.62 },
        hazeTint: {
          value: dark ? new Color(0.22, 0.32, 0.5) : new Color(1.25, 1.3, 1.35),
        },
      },
      halo: {
        sunDir: { value: sunDir },
        atmosphere: { value: atmosphere },
        sunColor: { value: sunColor },
        strength: { value: dark ? 1 : 0.85 },
      },
    };
  }, [earth, nightLights, dark, sunPosition]);
  useEffect(() => () => sky.dispose(), [sky]);
  useEffect(
    () => () => {
      stars.dispose();
      glow.dispose();
    },
    [stars, glow],
  );
  return (
    <group name="space-environment">
      <mesh raycast={() => {}} renderOrder={-10}>
        <sphereGeometry args={[950, 32, 24]} />
        <meshBasicMaterial map={sky} side={BackSide} toneMapped={false} />
      </mesh>
      <points geometry={stars} raycast={() => {}} renderOrder={-9}>
        <shaderMaterial
          uniforms={starUniforms}
          vertexShader={starVertex}
          fragmentShader={starFragment}
          transparent
          depthWrite={false}
          toneMapped={false}
        />
      </points>
      <group position={EARTH_CENTER.toArray()} rotation={EARTH_ROTATION}>
        <group ref={spin}>
          <mesh raycast={() => {}} renderOrder={-8}>
            <sphereGeometry args={[EARTH_RADIUS, 192, 128]} />
            <shaderMaterial
              uniforms={uniforms.earth}
              vertexShader={earthVertex}
              fragmentShader={earthFragment}
              toneMapped={false}
            />
          </mesh>
        </group>
        {clouds ? (
          <group ref={cloudSpin}>
            <mesh raycast={() => {}} renderOrder={-7.5}>
              <sphereGeometry args={[EARTH_RADIUS * 1.004, 192, 128]} />
              <shaderMaterial
                uniforms={cloudUniforms}
                vertexShader={cloudVertex}
                fragmentShader={cloudFragment}
                transparent
                depthWrite={false}
                toneMapped={false}
              />
            </mesh>
          </group>
        ) : null}
        <mesh raycast={() => {}} renderOrder={-7}>
          <sphereGeometry args={[EARTH_RADIUS * 1.014, 192, 128]} />
          <shaderMaterial
            uniforms={uniforms.halo}
            vertexShader={haloVertex}
            fragmentShader={haloFragment}
            side={BackSide}
            transparent
            depthWrite={false}
            blending={AdditiveBlending}
            toneMapped={false}
          />
        </mesh>
      </group>
      {dark && (
        <group position={SUN_DARK.toArray()} ref={sun}>
          <sprite scale={[520, 520, 1]} renderOrder={-6}>
            <spriteMaterial
              map={glow}
              color={colors["space-sun"]}
              transparent
              opacity={0.55}
              depthWrite={false}
              depthTest={false}
              blending={AdditiveBlending}
              toneMapped={false}
            />
          </sprite>
          <sprite scale={[1700, 380, 1]} renderOrder={-6}>
            <spriteMaterial
              map={glow}
              color={colors["space-sun"]}
              transparent
              opacity={0.42}
              depthWrite={false}
              depthTest={false}
              blending={AdditiveBlending}
              toneMapped={false}
            />
          </sprite>
          <sprite scale={[60, 60, 1]} renderOrder={-5}>
            <spriteMaterial
              map={glow}
              color={colors["space-sun-core"]}
              transparent
              depthWrite={false}
              depthTest={false}
              blending={AdditiveBlending}
              toneMapped={false}
            />
          </sprite>
          <sprite scale={[1500, 18, 1]} renderOrder={-5}>
            <spriteMaterial
              map={glow}
              color={colors["space-sun"]}
              transparent
              opacity={0.35}
              depthWrite={false}
              depthTest={false}
              blending={AdditiveBlending}
              toneMapped={false}
            />
          </sprite>
        </group>
      )}
    </group>
  );
}
