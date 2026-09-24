import {
  HalfFloatType,
  WebGLRenderTarget,
  type Camera,
  type Scene,
  type WebGLRenderer,
} from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";

/** Vignette and a touch of color grading, applied in linear HDR before tone mapping. */
const GradeShader = {
  name: "GradeShader",
  uniforms: {
    tDiffuse: { value: null },
    uVignette: { value: 0.32 },
    uSaturation: { value: 1.08 },
    uWater: { value: 0 },
    uTime: { value: 0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uVignette;
    uniform float uSaturation;
    uniform float uWater;
    uniform float uTime;
    varying vec2 vUv;
    void main() {
      // Underwater the picture wobbles slowly and turns blue-green.
      vec2 uv = vUv + uWater * 0.004 * vec2(sin(vUv.y * 24.0 + uTime * 2.0), cos(vUv.x * 20.0 + uTime * 1.6));
      vec4 color = texture2D(tDiffuse, uv);
      color.rgb = mix(color.rgb, color.rgb * vec3(0.5, 0.92, 1.05) + vec3(0.0, 0.015, 0.03), uWater);
      float luma = dot(color.rgb, vec3(0.2126, 0.7152, 0.0722));
      color.rgb = mix(vec3(luma), color.rgb, uSaturation);
      float dist = length(vUv - 0.5) * 1.25;
      color.rgb *= mix(1.0 - uVignette, 1.0, smoothstep(0.95, 0.35, dist));
      gl_FragColor = color;
    }
  `,
};

/** Multisampled HDR pipeline: scene, color grade, then tone mapping + sRGB output. */
export class PostProcessing {
  enabled = true;
  private readonly composer: EffectComposer;

  constructor(
    private readonly renderer: WebGLRenderer,
    private readonly scene: Scene,
    private readonly camera: Camera
  ) {
    const target = new WebGLRenderTarget(1, 1, { type: HalfFloatType, samples: 4 });
    this.composer = new EffectComposer(renderer, target);
    this.composer.addPass(new RenderPass(scene, camera));
    this.grade = new ShaderPass(GradeShader);
    this.composer.addPass(this.grade);
    this.composer.addPass(new OutputPass());
  }

  private readonly grade: ShaderPass;

  /** 0 = above water, 1 = fully submerged. */
  setUnderwater(amount: number, time: number): void {
    this.grade.uniforms.uWater.value = amount;
    this.grade.uniforms.uTime.value = time;
  }

  setSize(width: number, height: number, pixelRatio: number): void {
    this.composer.setPixelRatio(pixelRatio);
    this.composer.setSize(width, height);
  }

  render(dt: number): void {
    if (this.enabled) this.composer.render(dt);
    else this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    this.composer.dispose();
  }
}
