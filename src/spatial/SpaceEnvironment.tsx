import { useEffect, useMemo, useRef } from "react";
import { useFrame, useLoader } from "@react-three/fiber";
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
import earthImage from "../assets/earth-atmosphere.jpg";

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
  canvas.height = 512;
  const ctx = canvas.getContext("2d")!;
  const base = ctx.createLinearGradient(0, 0, 0, 512);
  if (dark) {
    base.addColorStop(0, colors["space-night"]);
    base.addColorStop(0.46, colors["space-night"]);
    base.addColorStop(0.53, colors["space-blue"]);
    base.addColorStop(1, colors["space-night"]);
  } else {
    base.addColorStop(0, colors["space-day-sky"]);
    base.addColorStop(0.3, colors["space-day-sky"]);
    base.addColorStop(0.44, colors["space-light"]);
    base.addColorStop(0.52, colors["space-day-haze"]);
    base.addColorStop(1, colors["space-light-mid"]);
  }
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 32, 512);
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
    shades: number[] = [];
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
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new Float32BufferAttribute(shades, 3));
  return geometry;
}

const earthVertex = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    vUv = uv;
    vec4 world = modelMatrix * vec4(position, 1.0);
    vNormal = normalize(mat3(modelMatrix) * normal);
    vView = normalize(cameraPosition - world.xyz);
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;
const earthFragment = /* glsl */ `
  uniform sampler2D map;
  uniform vec3 sunDir;
  uniform vec3 atmosphere;
  uniform vec3 sunColor;
  uniform float dayBoost;
  uniform float hazeAmount;
  uniform vec3 hazeTint;
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    vec3 n = normalize(vNormal);
    float ndl = dot(n, sunDir);
    vec3 albedo = texture2D(map, vUv).rgb;
    float day = smoothstep(-0.12, 0.35, ndl);
    vec3 night = albedo * 0.025 + vec3(0.004, 0.009, 0.022);
    vec3 lit = albedo * (0.22 + 1.05 * max(ndl, 0.0)) * dayBoost;
    vec3 color = mix(night, lit, day);
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

// One revolution in about 40 minutes: the surface drifts, the limb and the stands stay still.
const EARTH_SPIN = 0.0026;

/** A distant environment with one slow motion (Earth spin); no remote runtime resources. AR omits it. */
export function SpaceEnvironment({
  dark,
  motion = true,
}: {
  dark: boolean;
  motion?: boolean;
}) {
  const spin = useRef<Group>(null);
  useFrame((_, delta) => {
    if (motion && spin.current)
      spin.current.rotation.y += Math.min(delta, 0.2) * EARTH_SPIN;
  });
  const sky = useMemo(() => skyTexture(dark), [dark]);
  const glow = useMemo(glowTexture, []);
  const stars = useMemo(starsGeometry, []);
  const earth = useLoader(TextureLoader, earthImage);
  // The shader writes display colour directly, so the photo is sampled without decoding.
  earth.colorSpace = NoColorSpace;
  earth.anisotropy = 8;
  const sunPosition = dark ? SUN_DARK : SUN_LIGHT;
  const uniforms = useMemo(() => {
    const sunDir = sunPosition.clone().sub(EARTH_CENTER).normalize();
    const atmosphere = new Color(colors["space-atmosphere"]);
    const sunColor = new Color(colors["space-sun"]);
    return {
      earth: {
        map: { value: earth },
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
  }, [earth, dark, sunPosition]);
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
        <pointsMaterial
          vertexColors
          size={1.6}
          sizeAttenuation={false}
          transparent
          opacity={dark ? 0.95 : 0.18}
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
        <group position={SUN_DARK.toArray()}>
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
