// Render targets and post passes. Scene layers render into "display" targets that encode
// exactly like the canvas (tone mapping + sRGB output in the shader, float storage), so the
// product's look is identical to the app's; post passes work on display values; motion blur
// accumulates in linear light.
import {
  AdditiveBlending,
  Color,
  FloatType,
  HalfFloatType,
  LinearFilter,
  NoBlending,
  SRGBColorSpace,
  ShaderMaterial,
  Vector2,
  WebGLRenderTarget,
  type Texture,
  type WebGLRenderer,
} from "three";
import { FullScreenQuad } from "three/examples/jsm/postprocessing/Pass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";

export function displayTarget(w: number, h: number, samples = 4) {
  const rt = new WebGLRenderTarget(w, h, {
    type: HalfFloatType,
    samples,
    depthBuffer: true,
    minFilter: LinearFilter,
    magFilter: LinearFilter,
    generateMipmaps: false,
  });
  rt.texture.colorSpace = SRGBColorSpace;
  // three applies tone mapping and output encoding only for the canvas or XR targets; this
  // flag makes a float target behave like the canvas (see WebGLPrograms outputColorSpace).
  (rt as unknown as { isXRRenderTarget: boolean }).isXRRenderTarget = true;
  return rt;
}
export function postTarget(w: number, h: number, type = HalfFloatType) {
  return new WebGLRenderTarget(w, h, {
    type,
    samples: 0,
    depthBuffer: false,
    minFilter: LinearFilter,
    magFilter: LinearFilter,
    generateMipmaps: false,
  });
}

const vertex = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;
const srgb = /* glsl */ `
  vec3 toLinear(vec3 c) { return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c)); }
  vec3 toSrgb(vec3 c) { c = max(c, 0.0); return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
`;

function material(fragmentShader: string, uniforms: Record<string, { value: unknown }>, blending = NoBlending) {
  return new ShaderMaterial({
    vertexShader: vertex,
    fragmentShader,
    uniforms,
    depthTest: false,
    depthWrite: false,
    blending,
    transparent: blending !== NoBlending,
    toneMapped: false,
  });
}

export class Pipeline {
  w: number;
  h: number;
  gl: WebGLRenderer;
  quad = new FullScreenQuad();
  scene: WebGLRenderTarget; // layer render (BG, layer B direct, desktop world)
  portal: WebGLRenderTarget; // layer B from camera A (lens portal)
  head: WebGLRenderTarget; // headset without glass (premultiplied)
  glass: WebGLRenderTarget; // lens glass showing the portal
  comp: WebGLRenderTarget;
  accum: WebGLRenderTarget;
  tmpA: WebGLRenderTarget;
  tmpB: WebGLRenderTarget;
  halfA: WebGLRenderTarget;
  halfB: WebGLRenderTarget;
  blurs: Record<string, WebGLRenderTarget>;
  bloom: UnrealBloomPass;
  m: Record<string, ShaderMaterial>;

  constructor(gl: WebGLRenderer, w: number, h: number) {
    this.gl = gl;
    this.w = w;
    this.h = h;
    this.scene = displayTarget(w, h);
    this.portal = displayTarget(w, h);
    this.head = displayTarget(w, h);
    this.glass = displayTarget(w, h);
    this.comp = postTarget(w, h);
    const floatBlend = !!gl.getContext().getExtension("EXT_float_blend");
    this.accum = postTarget(w, h, floatBlend ? FloatType : HalfFloatType);
    this.tmpA = postTarget(w, h);
    this.tmpB = postTarget(w, h);
    this.halfA = postTarget(w / 2, h / 2);
    this.halfB = postTarget(w / 2, h / 2);
    this.blurs = { bg: postTarget(w, h), portal: postTarget(w, h), head: postTarget(w, h) };
    // Threshold above display white: only the sun's additive core (HDR) blooms, never UI text.
    this.bloom = new UnrealBloomPass(new Vector2(w, h), 0.5, 0.35, 1.0);
    this.m = {
      copy: material(
        /* glsl */ `uniform sampler2D tex; uniform float clampTo; varying vec2 vUv;
        void main() { vec4 c = texture2D(tex, vUv); gl_FragColor = clampTo > 0.0 ? clamp(c, 0.0, clampTo) : c; }`,
        { tex: { value: null }, clampTo: { value: 1 } },
      ),
      blur: material(
        /* glsl */ `uniform sampler2D tex; uniform vec2 step; uniform float sigma; varying vec2 vUv;
        void main() {
          float r = ceil(sigma * 3.0);
          vec4 sum = vec4(0.0); float wsum = 0.0;
          for (int i = -64; i <= 64; i++) {
            float x = float(i);
            if (abs(x) > r) continue;
            float w = exp(-0.5 * x * x / (sigma * sigma));
            sum += texture2D(tex, vUv + step * x) * w;
            wsum += w;
          }
          gl_FragColor = sum / wsum;
        }`,
        { tex: { value: null }, step: { value: new Vector2() }, sigma: { value: 1 } },
      ),
      composite: material(
        /* glsl */ `uniform sampler2D bg; uniform sampler2D glass; uniform sampler2D head;
        uniform float useHead; varying vec2 vUv;
        void main() {
          vec3 base = max(texture2D(bg, vUv).rgb, 0.0); // HDR kept for the bloom threshold
          if (useHead > 0.5) {
            vec4 g = texture2D(glass, vUv);
            // The lens keeps HDR: the sun seen through it blooms exactly as after the cut.
            base = mix(base, max(g.rgb, 0.0), clamp(g.a, 0.0, 1.0));
            vec4 h = texture2D(head, vUv);
            base = base * (1.0 - clamp(h.a, 0.0, 1.0)) + clamp(h.rgb, 0.0, 1.0);
          }
          gl_FragColor = vec4(base, 1.0);
        }`,
        { bg: { value: null }, glass: { value: null }, head: { value: null }, useHead: { value: 0 } },
      ),
      grade: material(
        /* glsl */ `uniform sampler2D tex; uniform float fade; uniform vec4 gradTop; uniform vec4 gradBottom;
        varying vec2 vUv;
        void main() {
          vec3 c = clamp(texture2D(tex, vUv).rgb, 0.0, 1.0);
          vec4 g = mix(gradBottom, gradTop, vUv.y);
          c = mix(c, g.rgb, g.a);
          gl_FragColor = vec4(c * fade, 1.0);
        }`,
        {
          tex: { value: null },
          fade: { value: 1 },
          gradTop: { value: [0, 0, 0, 0] },
          gradBottom: { value: [0, 0, 0, 0] },
        },
      ),
      glow: material(
        /* glsl */ `uniform vec2 centre; uniform float radius; uniform float opacity; uniform vec3 color;
        uniform vec2 size; varying vec2 vUv;
        void main() {
          vec2 p = vUv * size;
          float d = length(p - centre) / radius;
          float a = opacity * pow(max(0.0, 1.0 - d), 2.2);
          gl_FragColor = vec4(color * a, 1.0);
        }`,
        {
          centre: { value: new Vector2() },
          radius: { value: 1 },
          opacity: { value: 0 },
          color: { value: new Color(1, 1, 1) },
          size: { value: new Vector2(w, h) },
        },
        AdditiveBlending,
      ),
      accumulate: material(
        srgb +
          /* glsl */ `uniform sampler2D tex; uniform float weight; varying vec2 vUv;
        void main() { gl_FragColor = vec4(toLinear(clamp(texture2D(tex, vUv).rgb, 0.0, 1.0)) * weight, 1.0); }`,
        { tex: { value: null }, weight: { value: 1 } },
        AdditiveBlending,
      ),
      output: material(
        srgb +
          /* glsl */ `uniform sampler2D tex; uniform float dither; varying vec2 vUv;
        float ign(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
        void main() {
          vec3 c = toSrgb(texture2D(tex, vUv).rgb);
          // ±0.5 LSB triangular dither from two interleaved-gradient samples (static pattern).
          float n = ign(gl_FragCoord.xy) + ign(gl_FragCoord.xy + vec2(47.0, 17.0)) - 1.0;
          c += n * dither / 255.0;
          gl_FragColor = vec4(c, 1.0);
        }`,
        { tex: { value: null }, dither: { value: 0.5 } },
      ),
    };
    // The additive passes must add into the target, not blend with alpha.
    for (const k of ["glow", "accumulate"]) {
      const mm = this.m[k];
      mm.blending = AdditiveBlending;
      mm.transparent = true;
    }
  }

  pass(mat: ShaderMaterial, target: WebGLRenderTarget | null, clear = false) {
    const gl = this.gl;
    gl.setRenderTarget(target);
    if (clear) {
      gl.setClearColor(0x000000, 0);
      gl.clear(true, false, false);
    }
    this.quad.material = mat;
    this.quad.render(gl);
  }

  copy(tex: Texture, target: WebGLRenderTarget | null, clampTo = 1) {
    this.m.copy.uniforms.tex.value = tex;
    this.m.copy.uniforms.clampTo.value = clampTo;
    this.pass(this.m.copy, target);
  }

  /** Separable Gaussian, σ in output (4K) pixels. Large σ runs at half resolution. */
  blur(src: WebGLRenderTarget, sigma: number, out: WebGLRenderTarget): Texture {
    if (sigma < 0.35) return src.texture;
    const b = this.m.blur;
    if (sigma > 6) {
      this.copy(src.texture, this.halfA, 0);
      const s = sigma / 2;
      b.uniforms.sigma.value = s;
      b.uniforms.tex.value = this.halfA.texture;
      b.uniforms.step.value.set(1 / (this.w / 2), 0);
      this.pass(b, this.halfB);
      b.uniforms.tex.value = this.halfB.texture;
      b.uniforms.step.value.set(0, 1 / (this.h / 2));
      this.pass(b, this.halfA);
      this.copy(this.halfA.texture, out, 0);
      return out.texture;
    }
    b.uniforms.sigma.value = sigma;
    b.uniforms.tex.value = src.texture;
    b.uniforms.step.value.set(1 / this.w, 0);
    this.pass(b, this.tmpA);
    b.uniforms.tex.value = this.tmpA.texture;
    b.uniforms.step.value.set(0, 1 / this.h);
    this.pass(b, out);
    return out.texture;
  }

  beginAccumulation() {
    this.gl.setRenderTarget(this.accum);
    this.gl.setClearColor(0x000000, 0);
    this.gl.clear(true, false, false);
  }
  accumulate(tex: Texture, weight: number) {
    this.m.accumulate.uniforms.tex.value = tex;
    this.m.accumulate.uniforms.weight.value = weight;
    this.pass(this.m.accumulate, this.accum);
  }
  output(dither: number) {
    this.m.output.uniforms.tex.value = this.accum.texture;
    this.m.output.uniforms.dither.value = dither;
    this.pass(this.m.output, null);
  }
  /** UnrealBloom in place on comp. */
  applyBloom(strength: number) {
    if (strength <= 0.001) return;
    this.bloom.strength = strength;
    const gl = this.gl;
    const autoClear = gl.autoClear;
    this.bloom.render(gl, this.tmpB, this.comp, 0, false);
    gl.autoClear = autoClear;
  }
  glow(centre: Vector2, radius: number, opacity: number, color: Color) {
    if (opacity <= 0.0005) return;
    const u = this.m.glow.uniforms;
    u.centre.value.copy(centre);
    u.radius.value = radius;
    u.opacity.value = opacity;
    u.color.value.copy(color);
    this.pass(this.m.glow, this.comp);
  }
}
